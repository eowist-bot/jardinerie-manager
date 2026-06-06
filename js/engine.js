// ═══════════════════════════════════════════════════════════════
//  ENGINE — État du jeu & logique métier
// ═══════════════════════════════════════════════════════════════

const SELL_PRICE_MULT = 1.5;
const MIN_SELL_RATE   = 0.08;
const BASE_SELL_RATE  = 0.35;
const SEASON_END_WARN = 10;

// ── État global ─────────────────────────────────────────────
const G = {
  week:         1,
  seasonIdx:    0,
  weekInSeason: 1,
  money:        5000,
  // phases : 'supplier' → 'allocation' → 'market' → 'results'
  phase:        'supplier',

  sections:       {},
  supplierOffers: {},
  cart:           {},

  weeklyResults: null,
  salesHistory:  [],   // [{week, seasonIdx, items:[{productId,sectionId,qty,revenue}]}]
  promoSectionId: null, // rayon avec promo ce tour

  log:       [],
  nextItemId: 1,
};

// ── Helpers ──────────────────────────────────────────────────
function season()          { return SEASONS[G.seasonIdx]; }
function nearEndOfSeason() { return G.weekInSeason >= SEASON_END_WARN; }
function sectionDef(sid)   { return SECTIONS_DEF[sid]; }
function productDef(pid)   { return CATALOG[pid]; }

function sectionCapacity(sid) { return G.sections[sid].slots; }

// Slots occupés = types distincts avec qty > 0
function occupiedSlots(sid) {
  return new Set(G.sections[sid].stock.filter(s => s.qty > 0).map(s => s.productId)).size;
}
function freeSlots(sid) { return sectionCapacity(sid) - occupiedSlots(sid); }
function typeOnShelf(sid, productId) {
  return G.sections[sid].stock.some(s => s.productId === productId && s.qty > 0);
}

function isSaturated(sid) { return G.sections[sid].reserve.length > 0; }

function isOutOfSeason(productId) {
  const p = productDef(productId);
  return p.seasonal !== null && !p.seasonal.includes(season());
}

// Prix de vente = prix CATALOGUE × 1,5 (indépendant du prix d'achat)
// → le joueur bénéficie des promos fournisseur sans changer son prix de vente
function sellPrice(productId, discount = 0) {
  return productDef(productId).price * SELL_PRICE_MULT * (1 - discount);
}

function addLog(msg, type = 'info') {
  G.log.unshift({ msg, type, week: G.week });
  if (G.log.length > 100) G.log.pop();
}

function nextSlotCost(sid) {
  const extra = G.sections[sid].slots - BASE_SLOTS + 1;
  return sectionDef(sid).slotCost * extra;
}

// ── Initialisation ──────────────────────────────────────────
function initGame() {
  G.sections = {};
  Object.keys(SECTIONS_DEF).forEach(sid => {
    G.sections[sid] = { owned: SECTIONS_DEF[sid].unlockCost === 0, slots: BASE_SLOTS, stock: [], reserve: [] };
  });
  G.week = 1; G.seasonIdx = 0; G.weekInSeason = 1;
  G.money = 5000;
  G.phase = 'supplier';
  G.log = []; G.salesHistory = []; G.nextItemId = 1;
  addLog('🌱 Bienvenue dans votre jardinerie ! Bonne saison !', 'info');
  startSupplierPhase();
}

// ── Phase fournisseurs ───────────────────────────────────────
function startSupplierPhase() {
  applyWeeklyDecay();
  autoRestockFromReserve();   // réassort automatique pour les articles déjà en réserve
  generateSupplierOffers();
  G.cart = {};
  ownedSections().forEach(sid => { G.cart[sid] = []; });
  G.phase = 'supplier';
  checkEndOfSeasonWarnings();
}

// Réassort auto (uniquement pour les articles déjà en réserve avant achat)
function autoRestockFromReserve() {
  ownedSections().forEach(sid => {
    const sec = G.sections[sid];

    // Passe 1 : types déjà présents en rayon → ajouter la quantité sans slot
    sec.reserve.forEach(r => {
      if (r.qty <= 0) return;
      if (typeOnShelf(sid, r.productId)) {
        addToStock(sid, r.productId, r.qty, r.buyPrice);
        addLog(`📦 Réassort auto : ${r.qty}× ${productDef(r.productId).name}`, 'restock');
        r.qty = 0;
      }
    });
    sec.reserve = sec.reserve.filter(r => r.qty > 0);

    // Passe 2 : nouveaux types → slots libres
    sec.reserve.forEach(r => {
      if (r.qty <= 0 || freeSlots(sid) <= 0) return;
      addToStock(sid, r.productId, r.qty, r.buyPrice);
      addLog(`📦 Réassort auto (nouveau slot) : ${r.qty}× ${productDef(r.productId).name}`, 'restock');
      r.qty = 0;
    });
    sec.reserve = sec.reserve.filter(r => r.qty > 0);
  });
}

function addToStock(sid, productId, qty, buyPrice, discount = 0) {
  const sec = G.sections[sid];
  const existing = sec.stock.find(s => s.productId === productId);
  if (existing) {
    // Prix moyen pondéré
    const total = existing.qty + qty;
    existing.buyPrice = (existing.buyPrice * existing.qty + buyPrice * qty) / total;
    existing.qty      = total;
  } else {
    sec.stock.push({ id: G.nextItemId++, productId, qty, buyPrice, discount });
  }
}

// ── Génération des offres fournisseur ────────────────────────
// Règles :
//  - Aucun produit hors saison proposé
//  - Semaine 1 : 1 rayon garanti avec promo (-10% ou -20%)
//  - Semaines suivantes : 35% de chance, 1 rayon aléatoire
function generateSupplierOffers() {
  G.supplierOffers = {};
  const owned = ownedSections();

  // Déterminer le rayon promu cette semaine
  let promoSid = null;
  if (G.week === 1 || Math.random() < 0.35) {
    promoSid = owned[Math.floor(Math.random() * owned.length)];
  }
  G.promoSectionId = promoSid;

  owned.forEach(sid => {
    // Filtrer : produits de ce rayon ET en saison (ou toute l'année)
    const products = Object.keys(CATALOG).filter(pid => {
      const p = CATALOG[pid];
      return p.section === sid && !isOutOfSeason(pid);
    });

    const names        = SUPPLIER_NAMES[sid];
    const numSuppliers = 2 + Math.floor(Math.random() * 2);
    const offers       = [];
    const usedProducts = new Set();

    for (let s = 0; s < numSuppliers; s++) {
      const supplierName = names[s % names.length];
      const available    = products.filter(p => !usedProducts.has(p));
      if (available.length === 0) break;
      shuffle([...available])
        .slice(0, Math.min(2 + Math.floor(Math.random() * 3), available.length))
        .forEach(pid => {
          usedProducts.add(pid);
          const basePrice = productDef(pid).price;
          const unitPrice = Math.round(basePrice * (0.85 + Math.random() * 0.3) * 100) / 100;
          const qty       = 3 + Math.floor(Math.random() * 8);
          offers.push({ supplierName, productId: pid, qty, unitPrice, promoRate: 0, originalPrice: unitPrice });
        });
    }

    // Appliquer promo sur 1-2 produits si c'est le rayon promu
    if (sid === promoSid && offers.length > 0) {
      const promoCount = 1 + (Math.random() < 0.4 ? 1 : 0);
      shuffle([...offers])
        .slice(0, Math.min(promoCount, offers.length))
        .forEach(offer => {
          offer.promoRate     = Math.random() < 0.5 ? 0.10 : 0.20;
          offer.originalPrice = offer.unitPrice;
          offer.unitPrice     = Math.round(offer.unitPrice * (1 - offer.promoRate) * 100) / 100;
        });
      addLog(`🏷️ Promo fournisseur chez ${sectionDef(sid).name} cette semaine !`, 'discount');
    }

    G.supplierOffers[sid] = offers;
  });
}

// ── Panier ───────────────────────────────────────────────────
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

// ── Validation des achats → tout en réserve ──────────────────
function validatePurchases() {
  const owned = ownedSections();

  for (const sid of owned) {
    if (!isSaturated(sid) && G.cart[sid].length === 0) {
      return { ok: false, error: `Commandez au moins 1 produit pour "${sectionDef(sid).name}".` };
    }
  }

  let total = 0;
  owned.forEach(sid => G.cart[sid].forEach(i => { total += i.qty * i.unitPrice; }));
  if (total > G.money) {
    return { ok: false, error: `Budget insuffisant ! Commande : ${fmt(total)} — Caisse : ${fmt(G.money)}` };
  }

  // Tout va en RÉSERVE (le joueur choisira ensuite ce qui va en rayon)
  G.money -= total;
  owned.forEach(sid => {
    G.cart[sid].forEach(item => {
      const sec      = G.sections[sid];
      const existing = sec.reserve.find(r => r.productId === item.productId);
      if (existing) {
        // Prix moyen pondéré en réserve
        const t = existing.qty + item.qty;
        existing.buyPrice = (existing.buyPrice * existing.qty + item.unitPrice * item.qty) / t;
        existing.qty      = t;
      } else {
        sec.reserve.push({ productId: item.productId, qty: item.qty, buyPrice: item.unitPrice });
      }
      const promoTxt = item.promoRate > 0 ? ` (-${Math.round(item.promoRate*100)}% promo !)` : '';
      addLog(`🛒 ${item.qty}× ${productDef(item.productId).name} → réserve${promoTxt} — ${fmt(item.qty * item.unitPrice)}`, 'buy');
    });
  });

  G.cart  = {};
  G.phase = 'allocation';
  return { ok: true };
}

// ── Phase allocation : déplacer réserve → rayon ──────────────
// Déplace TOUTE la quantité d'un type de réserve vers le rayon
function moveToShelf(sid, productId) {
  const sec      = G.sections[sid];
  const resIdx   = sec.reserve.findIndex(r => r.productId === productId);
  if (resIdx === -1) return { ok: false, error: 'Article introuvable en réserve.' };

  const r            = sec.reserve[resIdx];
  const alreadyOnShelf = typeOnShelf(sid, productId);

  if (!alreadyOnShelf && freeSlots(sid) <= 0) {
    return { ok: false, error: `Plus de slot libre dans ${sectionDef(sid).name}.` };
  }

  addToStock(sid, productId, r.qty, r.buyPrice);
  sec.reserve.splice(resIdx, 1);
  addLog(`📤 ${r.qty}× ${productDef(productId).name} → rayon`, 'restock');
  return { ok: true };
}

function confirmAllocation() {
  G.phase = 'market';
  addLog('🏪 Magasin ouvert !', 'info');
}

// ── Remises saisonnières ─────────────────────────────────────
function setDiscount(sid, stockItemId, discountRate) {
  const item = G.sections[sid].stock.find(s => s.id === stockItemId);
  if (item) {
    item.discount = Math.max(0, Math.min(0.5, discountRate));
    addLog(`🏷️ Remise ${Math.round(item.discount * 100)}% → ${productDef(item.productId).name}`, 'discount');
  }
}

// ── Fin de semaine / ventes ──────────────────────────────────
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
      if (prod.seasonal) rate *= prod.seasonal.includes(season()) ? 1.4 : 0.3;
      if (item.discount > 0) rate *= 1 + item.discount * 2;
      rate = Math.max(MIN_SELL_RATE, Math.min(1, rate));

      const actualSold = Math.min(Math.max(1, Math.round(item.qty * rate)), item.qty);
      const revenue    = actualSold * sellPrice(item.productId, item.discount);

      sectionResults.push({
        productId: item.productId, sold: actualSold, revenue,
        unitRevenue: sellPrice(item.productId, item.discount),
        discount: item.discount, wasDiscounted: item.discount > 0,
      });

      item.qty -= actualSold;
      G.money  += revenue;
    });

    sec.stock = sec.stock.filter(i => i.qty > 0);
    results.push({ sectionId: sid, items: sectionResults });

    const secRevenue = sectionResults.reduce((a, r) => a + r.revenue, 0);
    addLog(`📊 ${sectionDef(sid).name} — ${fmt(secRevenue)}`, 'sales');
  });

  G.weeklyResults = results;

  // Enregistrer l'historique des ventes (max 8 semaines)
  const allItems = results.flatMap(r => r.items.map(i => ({
    productId: i.productId, sectionId: r.sectionId, qty: i.sold, revenue: i.revenue,
  })));
  G.salesHistory.push({ week: G.week, seasonIdx: G.seasonIdx, items: allItems });
  if (G.salesHistory.length > 8) G.salesHistory.shift();

  advanceWeek();
  G.phase = 'results';
  return results;
}

function advanceWeek() {
  G.week++; G.weekInSeason++;
  if (G.weekInSeason > WEEKS_PER_SEASON) {
    G.weekInSeason = 1;
    G.seasonIdx    = (G.seasonIdx + 1) % 4;
    addLog(`🌍 Nouvelle saison : ${season()} !`, 'season');
  }
}

// ── Déclin hors saison ───────────────────────────────────────
function applyWeeklyDecay() {
  ownedSections().forEach(sid => {
    G.sections[sid].stock.forEach(item => {
      if (!isOutOfSeason(item.productId) || item.qty <= 0) return;
      item.qty -= 1;
      addLog(`🍂 Invendu hors saison : 1× ${productDef(item.productId).name} perdu`, 'decay');
    });
    G.sections[sid].stock = G.sections[sid].stock.filter(i => i.qty > 0);
  });
}

function checkEndOfSeasonWarnings() {
  if (!nearEndOfSeason()) return;
  ownedSections().forEach(sid => {
    G.sections[sid].stock.forEach(item => {
      const prod = productDef(item.productId);
      if (prod.seasonal && prod.seasonal.includes(season()) && item.discount === 0) {
        addLog(`⚠️ ${prod.name} arrive en fin de saison ! Pensez à solder.`, 'warning');
      }
    });
  });
}

// ── Top ventes ───────────────────────────────────────────────
// Retourne les N meilleures ventes sur les X dernières semaines enregistrées
function getTopSales(n = 3, lastWeeks = 4) {
  if (G.salesHistory.length === 0) return [];
  const recent = G.salesHistory.slice(-lastWeeks);
  const totals = {};
  recent.forEach(w => {
    w.items.forEach(i => {
      if (!totals[i.productId]) totals[i.productId] = { qty: 0, revenue: 0, weekCount: 0 };
      totals[i.productId].qty       += i.qty;
      totals[i.productId].revenue   += i.revenue;
      totals[i.productId].weekCount++;
    });
  });
  return Object.entries(totals)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, n)
    .map(([pid, d]) => ({ productId: pid, qty: d.qty, revenue: d.revenue, weekCount: d.weekCount }));
}

// Tendance d'un produit : compare son rang cette semaine vs la précédente
function getSalesTrend(productId) {
  if (G.salesHistory.length < 1) return 'new';

  const rankInWeek = (weekData) => {
    const sorted = [...weekData.items].sort((a, b) => b.revenue - a.revenue);
    return sorted.findIndex(i => i.productId === productId);
  };

  const last = G.salesHistory[G.salesHistory.length - 1];
  const prev = G.salesHistory.length >= 2 ? G.salesHistory[G.salesHistory.length - 2] : null;

  const rankLast = rankInWeek(last);
  const rankPrev = prev ? rankInWeek(prev) : -1;

  // Saison : si le produit est saisonnier et la saison se termine bientôt → tendance basse
  const prod = productDef(productId);
  const nearSeasonEnd = nearEndOfSeason() && prod.seasonal && prod.seasonal.includes(season());

  if (rankLast === -1)       return 'absent';    // pas vendu cette semaine
  if (nearSeasonEnd)         return 'declining'; // fin de saison imminente
  if (rankPrev === -1)       return 'new';       // première apparition
  if (rankLast < rankPrev)   return 'up';        // monte dans le classement
  if (rankLast > rankPrev)   return 'down';      // descend
  return 'stable';
}

// ── Débloquer / acheter un slot ──────────────────────────────
function unlockSection(sid) {
  const def = sectionDef(sid);
  if (G.sections[sid].owned)     return { ok: false, error: 'Rayon déjà ouvert.' };
  if (G.money < def.unlockCost)  return { ok: false, error: `Budget insuffisant. Coût : ${fmt(def.unlockCost)}` };
  G.money -= def.unlockCost;
  G.sections[sid].owned = true;
  addLog(`🏪 Nouveau rayon : ${def.name} !`, 'unlock');
  return { ok: true };
}

function buySlot(sid) {
  const sec = G.sections[sid];
  if (!sec.owned)           return { ok: false, error: 'Rayon non ouvert.' };
  if (sec.slots >= MAX_SLOTS) return { ok: false, error: `Maximum (${MAX_SLOTS}) atteint.` };
  const cost = nextSlotCost(sid);
  if (G.money < cost)       return { ok: false, error: `Budget insuffisant. Coût : ${fmt(cost)}` };
  G.money -= cost;
  sec.slots++;
  addLog(`📐 ${sectionDef(sid).name} — slot acheté (${sec.slots}/${MAX_SLOTS})`, 'unlock');
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
    s.stock.forEach(i   => { v += i.qty * sellPrice(i.productId, i.discount); });
    s.reserve.forEach(i => { v += i.qty * sellPrice(i.productId); });
  });
  return v;
}
