// ═══════════════════════════════════════════════════════════════
//  ENGINE — État du jeu & logique métier
// ═══════════════════════════════════════════════════════════════

const SELL_PRICE_MULT = 1.5;   // Vente à +50% du prix d'achat
const MIN_SELL_RATE   = 0.08;  // Minimum garanti (jamais zéro revenu)
const BASE_SELL_RATE  = 0.35;  // Taux de base sans modificateurs
const SEASON_END_WARN = 10;    // Semaine à partir de laquelle on alerte (>=10/13)

// ── État global ─────────────────────────────────────────────
const G = {
  week:         1,
  seasonIdx:    0,
  weekInSeason: 1,
  money:        5000,
  phase:        'supplier', // 'supplier' | 'market' | 'results'

  // sectionId → { owned, slots (6-12), stock:[], reserve:[] }
  // stock item  : { id, productId, qty, buyPrice, discount }
  // reserve item: { productId, qty, buyPrice }
  sections: {},

  supplierOffers: {},
  cart:           {},
  weeklyResults:  null,
  log:            [],
  nextItemId:     1,
};

// ── Helpers ──────────────────────────────────────────────────
function season()          { return SEASONS[G.seasonIdx]; }
function nearEndOfSeason() { return G.weekInSeason >= SEASON_END_WARN; }
function sectionDef(sid)   { return SECTIONS_DEF[sid]; }
function productDef(pid)   { return CATALOG[pid]; }

// Capacité = nombre de slots (1 slot = 1 type de produit)
function sectionCapacity(sid) { return G.sections[sid].slots; }

// Nombre de slots occupés = types distincts avec qty > 0
function occupiedSlots(sid) {
  const ids = new Set(G.sections[sid].stock.filter(s => s.qty > 0).map(s => s.productId));
  return ids.size;
}

// Slots libres (pour de nouveaux types)
function freeSlots(sid) {
  return sectionCapacity(sid) - occupiedSlots(sid);
}

// Un type est-il déjà sur les rayons ?
function typeOnShelf(sid, productId) {
  return G.sections[sid].stock.some(s => s.productId === productId && s.qty > 0);
}

// Rayon saturé = la réserve n'est pas vide après le réapprovisionnement auto
// Cela signifie qu'il n'y avait plus de slot libre pour les nouveaux types en réserve
function isSaturated(sid) {
  return G.sections[sid].reserve.length > 0;
}

function sellPrice(buyPrice, discount = 0) {
  return buyPrice * SELL_PRICE_MULT * (1 - discount);
}

function addLog(msg, type = 'info') {
  G.log.unshift({ msg, type, week: G.week });
  if (G.log.length > 80) G.log.pop();
}

// Coût du prochain slot supplémentaire
function nextSlotCost(sid) {
  const sec = G.sections[sid];
  const def = sectionDef(sid);
  const extraAlreadyBought = sec.slots - BASE_SLOTS; // 0 si on est au niveau de base
  return def.slotCost * (extraAlreadyBought + 1);
}

// ── Initialisation ──────────────────────────────────────────
function initGame() {
  G.sections = {};
  Object.keys(SECTIONS_DEF).forEach(sid => {
    G.sections[sid] = {
      owned:   SECTIONS_DEF[sid].unlockCost === 0,
      slots:   BASE_SLOTS,
      stock:   [],
      reserve: [],
    };
  });
  G.week = 1; G.seasonIdx = 0; G.weekInSeason = 1;
  G.money = 5000;
  G.phase = 'supplier';
  G.log = [];
  G.nextItemId = 1;
  addLog('🌱 Bienvenue dans votre jardinerie ! Bonne saison !', 'info');
  startSupplierPhase();
}

// ── Phase fournisseurs ───────────────────────────────────────
function startSupplierPhase() {
  autoRestockFromReserve();
  generateSupplierOffers();
  G.cart = {};
  Object.keys(G.sections).forEach(sid => {
    if (G.sections[sid].owned) G.cart[sid] = [];
  });
  G.phase = 'supplier';
  checkEndOfSeasonWarnings();
}

function autoRestockFromReserve() {
  ownedSections().forEach(sid => {
    const sec = G.sections[sid];

    // Passe 1 : types déjà sur le rayon → on ajoute les quantités sans utiliser de slot
    sec.reserve.forEach(r => {
      if (r.qty <= 0) return;
      if (typeOnShelf(sid, r.productId)) {
        addToStock(sid, r.productId, r.qty, r.buyPrice);
        addLog(`📦 ${sectionDef(sid).name} — réserve → rayon : ${r.qty}× ${productDef(r.productId).name}`, 'restock');
        r.qty = 0;
      }
    });
    sec.reserve = sec.reserve.filter(r => r.qty > 0);

    // Passe 2 : nouveaux types → un slot libre par type
    sec.reserve.forEach(r => {
      if (r.qty <= 0 || freeSlots(sid) <= 0) return;
      addToStock(sid, r.productId, r.qty, r.buyPrice);
      addLog(`📦 ${sectionDef(sid).name} — réserve → rayon (nouveau slot) : ${r.qty}× ${productDef(r.productId).name}`, 'restock');
      r.qty = 0;
    });
    sec.reserve = sec.reserve.filter(r => r.qty > 0);
  });
}

// Ajoute au stock rayon. Même productId = même slot (on accumule la quantité).
function addToStock(sid, productId, qty, buyPrice, discount = 0) {
  const sec = G.sections[sid];
  // On regroupe TOUS les lots du même produit dans une seule entrée (un seul slot visuel)
  const existing = sec.stock.find(s => s.productId === productId);
  if (existing) {
    // Prix moyen pondéré pour garder la cohérence comptable
    const totalQty   = existing.qty + qty;
    existing.buyPrice = (existing.buyPrice * existing.qty + buyPrice * qty) / totalQty;
    existing.qty      = totalQty;
  } else {
    sec.stock.push({ id: G.nextItemId++, productId, qty, buyPrice, discount });
  }
}

function generateSupplierOffers() {
  G.supplierOffers = {};
  ownedSections().forEach(sid => {
    const products    = Object.entries(CATALOG).filter(([, p]) => p.section === sid).map(([pid]) => pid);
    const names       = SUPPLIER_NAMES[sid];
    const numSuppliers = 2 + Math.floor(Math.random() * 2);
    const offers      = [];
    const usedProducts = new Set();

    for (let s = 0; s < numSuppliers; s++) {
      const supplierName = names[s % names.length];
      const numProducts  = 2 + Math.floor(Math.random() * 3);
      const available    = products.filter(p => !usedProducts.has(p));
      shuffle([...available]).slice(0, Math.min(numProducts, available.length)).forEach(pid => {
        usedProducts.add(pid);
        const base      = productDef(pid).price;
        const unitPrice = Math.round(base * (0.85 + Math.random() * 0.3) * 100) / 100;
        const qty       = 3 + Math.floor(Math.random() * 8);
        offers.push({ supplierName, productId: pid, qty, unitPrice });
      });
    }
    G.supplierOffers[sid] = offers;
  });
}

// ── Achat fournisseur ────────────────────────────────────────
function addToCart(sid, offerIndex) {
  const offer = G.supplierOffers[sid][offerIndex];
  if (!offer) return;
  const existing = G.cart[sid].find(c => c.productId === offer.productId);
  if (existing) {
    existing.qty += offer.qty;
  } else {
    G.cart[sid].push({ ...offer });
  }
}

function removeFromCart(sid, productId) {
  G.cart[sid] = G.cart[sid].filter(c => c.productId !== productId);
}

// Valider les achats → phase marché
function validatePurchases() {
  const owned = ownedSections();

  // Contrainte : ≥1 ligne par rayon non saturé
  for (const sid of owned) {
    if (!isSaturated(sid) && G.cart[sid].length === 0) {
      return { ok: false, error: `Vous devez commander au moins 1 produit pour "${sectionDef(sid).name}".` };
    }
  }

  // Vérif budget
  let total = 0;
  owned.forEach(sid => G.cart[sid].forEach(item => { total += item.qty * item.unitPrice; }));
  if (total > G.money) {
    return { ok: false, error: `Budget insuffisant ! Commande : ${fmt(total)} — Caisse : ${fmt(G.money)}` };
  }

  // Appliquer les achats
  G.money -= total;
  owned.forEach(sid => {
    const sec = G.sections[sid];
    G.cart[sid].forEach(item => {
      const alreadyOnShelf = typeOnShelf(sid, item.productId);

      if (alreadyOnShelf) {
        // Type déjà en rayon : on ajoute sans consommer de slot
        addToStock(sid, item.productId, item.qty, item.unitPrice);
        addLog(`🛒 ${item.qty}× ${productDef(item.productId).name} (réassort) — ${fmt(item.qty * item.unitPrice)}`, 'buy');
      } else if (freeSlots(sid) > 0) {
        // Nouveau type, slot disponible
        addToStock(sid, item.productId, item.qty, item.unitPrice);
        addLog(`🛒 ${item.qty}× ${productDef(item.productId).name} (nouveau slot) — ${fmt(item.qty * item.unitPrice)}`, 'buy');
      } else {
        // Plus de slot libre → réserve
        const existing = sec.reserve.find(r => r.productId === item.productId);
        if (existing) existing.qty += item.qty;
        else sec.reserve.push({ productId: item.productId, qty: item.qty, buyPrice: item.unitPrice });
        addLog(`📥 ${item.qty}× ${productDef(item.productId).name} → réserve (plus de slot libre) — ${fmt(item.qty * item.unitPrice)}`, 'restock');
      }
    });
  });

  G.cart = {};
  G.phase = 'market';
  return { ok: true };
}

// ── Remises saisonnières ─────────────────────────────────────
function setDiscount(sid, stockItemId, discountRate) {
  const item = G.sections[sid].stock.find(s => s.id === stockItemId);
  if (item) {
    item.discount = Math.max(0, Math.min(0.5, discountRate));
    addLog(`🏷️ Promotion ${Math.round(item.discount * 100)}% sur ${productDef(item.productId).name}`, 'discount');
  }
}

// ── Phase fin de semaine / ventes ───────────────────────────
function endWeek() {
  const results = [];

  ownedSections().forEach(sid => {
    const sec        = G.sections[sid];
    const seasonMult = SEASON_DEMAND[season()][sid] || 1.0;
    const sectionResults = [];

    sec.stock.forEach(item => {
      const prod = productDef(item.productId);
      if (item.qty <= 0) return;

      let rate = BASE_SELL_RATE + (Math.random() * 0.3 - 0.1);
      rate *= seasonMult;

      if (prod.seasonal) {
        rate *= prod.seasonal.includes(season()) ? 1.4 : 0.3;
      }
      if (item.discount > 0) {
        rate *= 1 + item.discount * 2;
      }
      rate = Math.max(MIN_SELL_RATE, Math.min(1, rate));

      const actualSold = Math.min(Math.max(1, Math.round(item.qty * rate)), item.qty);
      const revenue    = actualSold * sellPrice(item.buyPrice, item.discount);

      sectionResults.push({
        productId: item.productId, sold: actualSold, revenue,
        unitRevenue: sellPrice(item.buyPrice, item.discount),
        discount: item.discount, wasDiscounted: item.discount > 0,
      });

      item.qty -= actualSold;
      G.money  += revenue;
    });

    // Libérer les slots épuisés
    sec.stock = sec.stock.filter(i => i.qty > 0);

    results.push({ sectionId: sid, items: sectionResults });
    const secRevenue = sectionResults.reduce((a, r) => a + r.revenue, 0);
    addLog(`📊 ${sectionDef(sid).name} — ${fmt(secRevenue)} de CA`, 'sales');
  });

  G.weeklyResults = results;
  advanceWeek();
  G.phase = 'results';
  return results;
}

function advanceWeek() {
  G.week++;
  G.weekInSeason++;
  if (G.weekInSeason > WEEKS_PER_SEASON) {
    G.weekInSeason = 1;
    G.seasonIdx    = (G.seasonIdx + 1) % 4;
    addLog(`🌍 Nouvelle saison : ${season()} !`, 'season');
  }
}

function checkEndOfSeasonWarnings() {
  if (!nearEndOfSeason()) return;
  ownedSections().forEach(sid => {
    G.sections[sid].stock.forEach(item => {
      const prod = productDef(item.productId);
      if (prod.seasonal && prod.seasonal.includes(season()) && item.discount === 0) {
        addLog(`⚠️ ${prod.name} arrive en fin de saison ! Appliquez une remise pour écouler le stock.`, 'warning');
      }
    });
  });
}

// ── Débloquer un rayon ───────────────────────────────────────
function unlockSection(sid) {
  const def = sectionDef(sid);
  if (G.sections[sid].owned) return { ok: false, error: 'Rayon déjà ouvert.' };
  if (G.money < def.unlockCost) return { ok: false, error: `Budget insuffisant. Coût : ${fmt(def.unlockCost)}` };
  G.money -= def.unlockCost;
  G.sections[sid].owned = true;
  addLog(`🏪 Nouveau rayon ouvert : ${def.name} !`, 'unlock');
  return { ok: true };
}

// ── Acheter un slot supplémentaire ───────────────────────────
function buySlot(sid) {
  const sec = G.sections[sid];
  if (!sec.owned)         return { ok: false, error: 'Rayon non ouvert.' };
  if (sec.slots >= MAX_SLOTS) return { ok: false, error: `Maximum atteint (${MAX_SLOTS} emplacements).` };
  const cost = nextSlotCost(sid);
  if (G.money < cost)     return { ok: false, error: `Budget insuffisant. Coût : ${fmt(cost)}` };
  G.money   -= cost;
  sec.slots  += 1;
  addLog(`📐 ${sectionDef(sid).name} — emplacement acheté (${sec.slots}/${MAX_SLOTS})`, 'unlock');
  return { ok: true };
}

// ── Utilitaires ──────────────────────────────────────────────
function ownedSections() {
  return Object.keys(G.sections).filter(sid => G.sections[sid].owned);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:0 }).format(n);
}

function totalStockValue() {
  let v = 0;
  Object.values(G.sections).forEach(s => {
    s.stock.forEach(i   => { v += i.qty   * sellPrice(i.buyPrice, i.discount); });
    s.reserve.forEach(i => { v += i.qty   * sellPrice(i.buyPrice); });
  });
  return v;
}
