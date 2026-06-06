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
  seasonIdx:    0,          // 0=Printemps … 3=Hiver
  weekInSeason: 1,          // 1-13
  money:        5000,
  phase:        'supplier', // 'supplier' | 'market' | 'results'

  // sectionId → { owned, level (1-3), stock:[], reserve:[] }
  // stock item : { id, productId, qty, buyPrice, discount }
  // reserve item: { productId, qty, buyPrice }
  sections: {},

  supplierOffers: {},  // sectionId → [{supplierName, productId, qty, unitPrice}]
  cart:           {},  // sectionId → [{productId, qty, unitPrice}]

  weeklyResults:  null,  // résultats de la semaine terminée
  log:            [],
  nextItemId:     1,
};

// ── Helpers ──────────────────────────────────────────────────
function season()      { return SEASONS[G.seasonIdx]; }
function seasonWeek()  { return G.weekInSeason; }
function nearEndOfSeason() { return G.weekInSeason >= SEASON_END_WARN; }

function sectionDef(sid)   { return SECTIONS_DEF[sid]; }
function productDef(pid)   { return CATALOG[pid]; }

function sectionCapacity(sid) {
  const s = G.sections[sid];
  const d = sectionDef(sid);
  return d.slotsPerLevel[s.level - 1];
}

function sectionStockCount(sid) {
  return G.sections[sid].stock.reduce((a, i) => a + i.qty, 0);
}

function sellPrice(buyPrice, discount = 0) {
  const base = buyPrice * SELL_PRICE_MULT;
  return base * (1 - discount);
}

function addLog(msg, type = 'info') {
  G.log.unshift({ msg, type, week: G.week });
  if (G.log.length > 80) G.log.pop();
}

// ── Initialisation ──────────────────────────────────────────
function initGame() {
  G.sections = {};
  Object.keys(SECTIONS_DEF).forEach(sid => {
    G.sections[sid] = {
      owned: SECTIONS_DEF[sid].unlockCost === 0,
      level: 1,
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
  const owned = ownedSections();
  owned.forEach(sid => {
    const sec = G.sections[sid];
    const cap = sectionCapacity(sid);
    let onShelf = sectionStockCount(sid);
    const toMove = [];
    for (let i = sec.reserve.length - 1; i >= 0 && onShelf < cap; i--) {
      const r = sec.reserve[i];
      const canMove = Math.min(r.qty, cap - onShelf);
      if (canMove > 0) {
        onShelf += canMove;
        toMove.push({ idx: i, qty: canMove, productId: r.productId, buyPrice: r.buyPrice });
      }
    }
    toMove.forEach(({ idx, qty, productId, buyPrice }) => {
      sec.reserve[idx].qty -= qty;
      if (sec.reserve[idx].qty <= 0) sec.reserve.splice(idx, 1);
      addToStock(sid, productId, qty, buyPrice);
      addLog(`📦 ${sectionDef(sid).name} — réserve → rayon : ${qty}× ${productDef(productId).name}`, 'restock');
    });
  });
}

function addToStock(sid, productId, qty, buyPrice, discount = 0) {
  const sec = G.sections[sid];
  const existing = sec.stock.find(s => s.productId === productId && s.buyPrice === buyPrice && s.discount === discount);
  if (existing) {
    existing.qty += qty;
  } else {
    sec.stock.push({ id: G.nextItemId++, productId, qty, buyPrice, discount });
  }
}

function generateSupplierOffers() {
  G.supplierOffers = {};
  const owned = ownedSections();
  owned.forEach(sid => {
    const products = Object.entries(CATALOG)
      .filter(([, p]) => p.section === sid)
      .map(([pid]) => pid);
    const names = SUPPLIER_NAMES[sid];
    const numSuppliers = 2 + Math.floor(Math.random() * 2); // 2 ou 3
    const offers = [];
    const usedProducts = new Set();

    for (let s = 0; s < numSuppliers; s++) {
      const supplierName = names[s % names.length];
      // Chaque fournisseur propose 2-4 produits différents
      const numProducts = 2 + Math.floor(Math.random() * 3);
      const available = products.filter(p => !usedProducts.has(p));
      const chosen = shuffle([...available]).slice(0, Math.min(numProducts, available.length));
      chosen.forEach(pid => {
        usedProducts.add(pid);
        const base = productDef(pid).price;
        // Prix fournisseur : ±15% du prix catalogue
        const unitPrice = Math.round(base * (0.85 + Math.random() * 0.3) * 100) / 100;
        const qty = 3 + Math.floor(Math.random() * 8); // 3 à 10 unités
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
  // Regrouper par productId dans le cart
  const existing = G.cart[sid].find(c => c.productId === offer.productId && c.unitPrice === offer.unitPrice);
  if (existing) {
    existing.qty += offer.qty;
  } else {
    G.cart[sid].push({ ...offer });
  }
}

function removeFromCart(sid, productId) {
  G.cart[sid] = G.cart[sid].filter(c => c.productId !== productId);
}

// Valider les achats et passer en phase marché
function validatePurchases() {
  const owned = ownedSections();

  // Vérifier contrainte : au moins 1 ligne par rayon
  for (const sid of owned) {
    if (G.cart[sid].length === 0) {
      return { ok: false, error: `Vous devez commander au moins 1 produit pour "${sectionDef(sid).name}".` };
    }
  }

  // Calculer coût total
  let total = 0;
  owned.forEach(sid => {
    G.cart[sid].forEach(item => { total += item.qty * item.unitPrice; });
  });

  if (total > G.money) {
    return { ok: false, error: `Budget insuffisant ! Commande : ${fmt(total)} — Caisse : ${fmt(G.money)}` };
  }

  // Appliquer les achats
  G.money -= total;
  owned.forEach(sid => {
    G.cart[sid].forEach(item => {
      const cap = sectionCapacity(sid);
      const onShelf = sectionStockCount(sid);
      const freeSlots = cap - onShelf;
      const toShelf = Math.min(item.qty, freeSlots);
      const toReserve = item.qty - toShelf;

      if (toShelf > 0) addToStock(sid, item.productId, toShelf, item.unitPrice);
      if (toReserve > 0) {
        const sec = G.sections[sid];
        const existing = sec.reserve.find(r => r.productId === item.productId && r.buyPrice === item.unitPrice);
        if (existing) existing.qty += toReserve;
        else sec.reserve.push({ productId: item.productId, qty: toReserve, buyPrice: item.unitPrice });
        addLog(`📥 ${toReserve}× ${productDef(item.productId).name} → réserve (rayon plein)`, 'restock');
      }
      addLog(`🛒 Acheté ${item.qty}× ${productDef(item.productId).name} chez ${item.supplierName} — ${fmt(item.qty * item.unitPrice)}`, 'buy');
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
  const owned = ownedSections();

  owned.forEach(sid => {
    const sec = G.sections[sid];
    const seasonMult = SEASON_DEMAND[season()][sid] || 1.0;
    const sectionResults = [];

    sec.stock.forEach(item => {
      const prod = productDef(item.productId);
      if (item.qty <= 0) return;

      // Taux de vente de base
      let rate = BASE_SELL_RATE + (Math.random() * 0.3 - 0.1); // ±10% aléatoire

      // Modificateur saison pour la section
      rate *= seasonMult;

      // Si produit saisonnier : bonus en saison, malus hors saison
      if (prod.seasonal) {
        if (prod.seasonal.includes(season())) {
          rate *= 1.4;
        } else {
          rate *= 0.3; // Très faible hors saison
        }
      }

      // Bonus remise : chaque % de remise = +2% de taux de vente
      if (item.discount > 0) {
        rate *= 1 + item.discount * 2;
      }

      // Minimum garanti : au moins MIN_SELL_RATE
      rate = Math.max(MIN_SELL_RATE, Math.min(1, rate));

      const sold = Math.max(1, Math.round(item.qty * rate));
      const actualSold = Math.min(sold, item.qty);
      const revenue = actualSold * sellPrice(item.buyPrice, item.discount);

      sectionResults.push({
        productId:    item.productId,
        sold:         actualSold,
        revenue:      revenue,
        unitRevenue:  sellPrice(item.buyPrice, item.discount),
        discount:     item.discount,
        wasDiscounted:item.discount > 0,
      });

      item.qty -= actualSold;
      G.money += revenue;
    });

    // Nettoyer stock épuisé
    sec.stock = sec.stock.filter(i => i.qty > 0);

    results.push({ sectionId: sid, items: sectionResults });
    const secRevenue = sectionResults.reduce((a, r) => a + r.revenue, 0);
    addLog(`📊 ${sectionDef(sid).name} — ${fmt(secRevenue)} de CA cette semaine`, 'sales');
  });

  G.weeklyResults = results;

  // Avancer la semaine
  advanceWeek();
  G.phase = 'results';

  return results;
}

function advanceWeek() {
  G.week++;
  G.weekInSeason++;
  if (G.weekInSeason > WEEKS_PER_SEASON) {
    G.weekInSeason = 1;
    G.seasonIdx = (G.seasonIdx + 1) % 4;
    addLog(`🌍 Nouvelle saison : ${season()} !`, 'season');
    // À la nouvelle saison, supprimer les remises des produits non saisonniers
    resetExpiredDiscounts();
  }
}

function resetExpiredDiscounts() {
  Object.keys(G.sections).forEach(sid => {
    G.sections[sid].stock.forEach(item => {
      const prod = productDef(item.productId);
      if (prod.seasonal && !prod.seasonal.includes(season())) {
        // La saison est passée, on retire la remise (produit déjà soldé ou va disparaître)
        // On garde la remise si elle a été posée pour le liquider
      }
    });
  });
}

function checkEndOfSeasonWarnings() {
  if (!nearEndOfSeason()) return;
  const owned = ownedSections();
  owned.forEach(sid => {
    G.sections[sid].stock.forEach(item => {
      const prod = productDef(item.productId);
      if (prod.seasonal && prod.seasonal.includes(season()) && item.discount === 0) {
        addLog(
          `⚠️ ${prod.name} arrive en fin de saison ! Pensez à appliquer une remise pour écouler le stock.`,
          'warning'
        );
      }
    });
  });
}

// ── Débloquer / améliorer une section ───────────────────────
function unlockSection(sid) {
  const def = sectionDef(sid);
  if (G.sections[sid].owned) return { ok: false, error: 'Rayon déjà ouvert.' };
  if (G.money < def.unlockCost) return { ok: false, error: `Budget insuffisant. Coût : ${fmt(def.unlockCost)}` };
  G.money -= def.unlockCost;
  G.sections[sid].owned = true;
  addLog(`🏪 Nouveau rayon ouvert : ${def.name} !`, 'unlock');
  return { ok: true };
}

function upgradeSection(sid) {
  const def = sectionDef(sid);
  const sec = G.sections[sid];
  if (!sec.owned) return { ok: false, error: 'Rayon non ouvert.' };
  if (sec.level >= 3) return { ok: false, error: 'Rayon déjà au niveau maximum.' };
  const cost = def.upgradeCosts[sec.level - 1];
  if (G.money < cost) return { ok: false, error: `Budget insuffisant. Coût : ${fmt(cost)}` };
  G.money -= cost;
  sec.level++;
  addLog(`⬆️ ${def.name} agrandi au niveau ${sec.level} !`, 'unlock');
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
    s.stock.forEach(i => { v += i.qty * sellPrice(i.buyPrice, i.discount); });
    s.reserve.forEach(i => { v += i.qty * sellPrice(i.buyPrice); });
  });
  return v;
}
