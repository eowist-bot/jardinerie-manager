// ═══════════════════════════════════════════════════════════════
//  ENGINE — État du jeu & logique métier
// ═══════════════════════════════════════════════════════════════

const SELL_PRICE_MULT = 1.5;
const SAVE_KEY        = 'jardinerie_save_v1';  // clé localStorage pour la sauvegarde

// ── Météo ────────────────────────────────────────────────────
const WEATHER_TYPES = [
  { id: 'blazing', icon: '🌞', label: 'Canicule',       sunFactor: 1.8  },
  { id: 'sunny',   icon: '☀️', label: 'Ensoleillé',     sunFactor: 1.4  },
  { id: 'partly',  icon: '🌤️', label: 'Belles éclaircies', sunFactor: 1.15 },
  { id: 'cloudy',  icon: '⛅',  label: 'Nuageux',         sunFactor: 0.9  },
  { id: 'drizzle', icon: '🌦️', label: 'Averses',         sunFactor: 0.7  },
  { id: 'rainy',   icon: '🌧️', label: 'Pluvieux',        sunFactor: 0.5  },
  { id: 'stormy',  icon: '⛈️', label: 'Orageux',         sunFactor: 0.3  },
];

// Poids par saison [blazing, sunny, partly, cloudy, drizzle, rainy, stormy]
const WEATHER_WEIGHTS = {
  'Printemps': [2,  15, 30, 25, 15, 10, 3 ],
  'Été':       [15, 35, 25, 12, 7,  5,  1 ],
  'Automne':   [0,  5,  15, 25, 25, 22, 8 ],
  'Hiver':     [0,  3,  10, 20, 25, 30, 12],
};

// Sections dont les ventes sont boostées par le soleil
const WEATHER_SUN_SECTIONS = new Set([
  'serre-froide', 'pepiniere', 'terreau',
]);
const MIN_SELL_RATE   = 0.08;
const BASE_SELL_RATE  = 0.35;
const SEASON_END_WARN = 10;

// ── Événements saisonniers ───────────────────────────────────
const SEASONAL_EVENTS = [
  { seasonIdx:0, weekInSeason:6,  id:'fete-meres',     icon:'🌹', name:'Fête des mères',
    boostSections:['serre-froide','serre-chaude'], boostMult:1.8,
    desc:'Les clients cherchent des fleurs et plantes pour leurs mamans !' },
  { seasonIdx:0, weekInSeason:11, id:'jardins-ouverts',icon:'🌿', name:'Journée des jardins',
    boostSections:['pepiniere','terreau','outils'], boostMult:1.5,
    desc:'Une journée dédiée au jardinage — les amateurs se ruent en jardinerie !' },
  { seasonIdx:1, weekInSeason:4,  id:'ete-deco',        icon:'🌞', name:'Déco estivale',
    boostSections:['decoration','animalerie'], boostMult:1.6,
    desc:"Les jardins s'animent pour l'été — décorations et bassins en vogue !" },
  { seasonIdx:1, weekInSeason:10, id:'canicule',        icon:'🌡️', name:'Vague de chaleur',
    boostSections:['bassin','terreau'], boostMult:1.7,
    desc:"La canicule pousse les clients vers les bassins et la gestion de l'eau." },
  { seasonIdx:2, weekInSeason:2,  id:'toussaint',       icon:'🕯️', name:'Toussaint',
    boostSections:['pepiniere','decoration'], boostMult:2.0,
    desc:'Les chrysanthèmes et poteries sont très demandés pour la Toussaint !' },
  { seasonIdx:2, weekInSeason:7,  id:'rentree-jardin',  icon:'🍂', name:'Rentrée jardin',
    boostSections:['outils','produits-jardin'], boostMult:1.5,
    desc:"C'est le moment de préparer le jardin pour l'hiver." },
  { seasonIdx:3, weekInSeason:3,  id:'noel',            icon:'🎄', name:'Fêtes de Noël',
    boostSections:['decoration','serre-chaude'], boostMult:2.2,
    desc:'Les plantes décoratives et objets festifs s\'arrachent !' },
  { seasonIdx:3, weekInSeason:10, id:'soldes-hiver',    icon:'❄️', name:'Soldes d\'hiver',
    boostSections:['poteries-naturelles','poteries-plastique'], boostMult:1.4,
    desc:'Les soldes attirent les curieux — les articles discount partent bien.' },
];

// ── Niveaux de publicité ────────────────────────────────────
const AD_LEVELS = [
  { cost: 150,  mult: 1.25, label: 'Affichage local',   icon: '📋' },
  { cost: 350,  mult: 1.50, label: 'Réseaux sociaux',   icon: '📱' },
  { cost: 800,  mult: 1.85, label: 'Campagne radio',    icon: '📻' },
];

// ── Objectif annuel ─────────────────────────────────────────
const ANNUAL_BASE_TARGET = 45000; // €, augmente de 20% chaque année

// ── Badges / Achievements ───────────────────────────────────
const ACHIEVEMENTS = [
  // — Progression —
  { id:'premier-achat',    cat:'progression', icon:'🌱', name:'Premier achat',
    desc:'Passer votre toute première commande.',
    reward: 0 },
  { id:'premiere-ouverture', cat:'progression', icon:'🏪', name:'Première ouverture',
    desc:'Ouvrir le magasin pour la première fois.',
    reward: 100 },
  { id:'deuxieme-rayon',   cat:'progression', icon:'🛍️', name:'Expansion',
    desc:'Débloquer un deuxième rayon.',
    reward: 200 },
  { id:'cinq-rayons',      cat:'progression', icon:'🗺️', name:'Grand magasin',
    desc:'Avoir 5 rayons ouverts simultanément.',
    reward: 500 },
  { id:'tous-rayons',      cat:'progression', icon:'🏬', name:'Jardinerie complète',
    desc:'Débloquer tous les rayons.',
    reward: 2000 },
  { id:'slot-max',         cat:'progression', icon:'📐', name:'Rayon premium',
    desc:'Atteindre 12 slots dans un rayon.',
    reward: 300 },
  { id:'parking-30',       cat:'progression', icon:'🅿️', name:'Grand parking',
    desc:'Avoir au moins 30 places de parking.',
    reward: 500 },
  { id:'premiere-annee',   cat:'progression', icon:'🏆', name:'Première année',
    desc:'Terminer une année complète (4 saisons).',
    reward: 1000 },

  // — Performance —
  { id:'satisfaction-100', cat:'performance', icon:'✅', name:'Client parfait',
    desc:'Atteindre 100% de satisfaction clients en une semaine.',
    reward: 500 },
  { id:'reputation-90',    cat:'performance', icon:'⭐', name:'Réputation d\'or',
    desc:'Atteindre 90+ de réputation.',
    reward: 800 },
  { id:'ca-2000',          cat:'performance', icon:'💶', name:'Belle semaine',
    desc:'Réaliser plus de 2 000 € de CA en une semaine.',
    reward: 0 },
  { id:'ca-5000',          cat:'performance', icon:'💰', name:'Semaine record',
    desc:'Réaliser plus de 5 000 € de CA en une semaine.',
    reward: 0 },
  { id:'caisse-10000',     cat:'performance', icon:'🤑', name:'Millionnaire',
    desc:'Avoir 10 000 € en caisse simultanément.',
    reward: 0 },
  { id:'objectifs-3serie', cat:'performance', icon:'🎯', name:'En série',
    desc:'Accomplir tous les objectifs hebdomadaires 3 semaines de suite.',
    reward: 600 },

  // — Maîtrise —
  { id:'pub-radio',        cat:'maitrise', icon:'📻', name:'Campagne radio',
    desc:'Utiliser la publicité de niveau 3 (Campagne radio).',
    reward: 0 },
  { id:'rupture-totale',   cat:'maitrise', icon:'💨', name:'Tout vendu !',
    desc:'Avoir une rupture de stock sur tous les articles d\'un rayon en une semaine.',
    reward: 300 },
  { id:'no-decay-4',       cat:'maitrise', icon:'🍃', name:'Zéro gâchis',
    desc:'Aucun article perdu hors-saison pendant 4 semaines consécutives.',
    reward: 400 },
  { id:'soldes-expert',    cat:'maitrise', icon:'🏷️', name:'Roi des soldes',
    desc:'Vendre au moins 15 articles hors-saison via des remises en une semaine.',
    reward: 400 },
  { id:'event-champion',   cat:'maitrise', icon:'🎪', name:'Champion d\'événement',
    desc:'Réaliser plus de 3 000 € de CA la semaine d\'un événement saisonnier.',
    reward: 500 },

  // — Longévité —
  { id:'semaine-20',       cat:'longevite', icon:'📅', name:'Vétéran',
    desc:'Atteindre la semaine 20.',
    reward: 300 },
  { id:'semaine-50',       cat:'longevite', icon:'🎖️', name:'Légende',
    desc:'Atteindre la semaine 50.',
    reward: 1500 },
  { id:'annee-3',          cat:'longevite', icon:'🌳', name:'Institution locale',
    desc:'Terminer 3 années complètes.',
    reward: 3000 },
];

// ── Parking ──────────────────────────────────────────────────
const PARKING_INIT_SLOTS    = 10;   // places initiales
const PARKING_UPGRADE_SLOTS = 10;   // places par upgrade
const PARKING_UPGRADE_COST  = 1500; // € — coût fixe par tranche

// ── État global ─────────────────────────────────────────────
const G = {
  week:         1,
  seasonIdx:    0,
  weekInSeason: 1,
  money:        5000,
  // phases : 'supplier' → 'allocation' → (ouvrir = endWeek) → 'results'
  phase:        'supplier',

  sections:        {},
  supplierOffers:  {},
  cart:            {},

  weeklyResults:   null,
  salesHistory:    [],   // [{week, seasonIdx, items:[{productId,sectionId,qty,revenue}]}]
  promoSectionId:  null, // rayon avec promo ce tour
  weeklyForecast:  { hot: [], cold: [] }, // 2 tops + 2 flops prévus pour la semaine
  top3Pids:        [],                    // top 3 ventes semaine précédente (badges + boost 75%)
  weather:         { current: null, next: null }, // météo semaine courante + prévision
  slotCosts:       {},                            // coûts d'achat de slots ce tour, par section

  // ── Nouveaux systèmes ──────────────────────────────────────
  reputation:       50,   // 0–100 : influe sur le nb de clients (×0.8 à ×1.3)
  year:             1,
  annualCA:         0,
  annualTarget:     ANNUAL_BASE_TARGET,
  weeklyObjectives: [],
  currentEvent:     null,
  nextEvent:        null,
  adBoost:          null,
  // Parking & clients
  parking:          { slots: PARKING_INIT_SLOTS },
  weeklyDemand:     {},   // { productId: { wanted, satisfied, sectionId } }
  trendState:       {},   // { productId: { direction:'hot'|'cold', weeksLeft:1–3 } }

  achievements: [],       // ['id', ...] des badges débloqués
  streaks: {              // suivi des séries pour les badges
    objectivesAll: 0,     // semaines de suite avec tous objectifs remplis
    noDecay:       0,     // semaines de suite sans pertes hors-saison
  },
  gazette:            null,  // données de la gazette de la dernière semaine
  _newBadgesThisWeek: [],    // badges débloqués pendant la semaine en cours
  _repDelta:          0,
  _repSatisfied:      0,
  _repWanted:         0,

  log:        [],
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
// → les promos fournisseur augmentent la marge sans changer le prix de vente
function sellPrice(productId, discount = 0) {
  return productDef(productId).price * SELL_PRICE_MULT * (1 - discount);
}

// Prix de vente catalogue (sans discount) — pour affichage
function catalogSellPrice(productId) {
  return productDef(productId).price * SELL_PRICE_MULT;
}

function addLog(msg, type = 'info', gazetteOnly = false) {
  G.log.unshift({ msg, type, week: G.week, gazetteOnly });
  if (G.log.length > 100) G.log.pop();
}

function nextSlotCost(sid) {
  const extra = G.sections[sid].slots - BASE_SLOTS + 1;
  return sectionDef(sid).slotCost * extra;
}

// Ventes de la dernière semaine enregistrée pour un produit
function getLastWeekSales(productId) {
  if (G.salesHistory.length === 0) return null;
  const last = G.salesHistory[G.salesHistory.length - 1];
  const item = last.items.find(i => i.productId === productId);
  return item ? { qty: item.qty, revenue: item.revenue, profit: item.revenue - (item.qty * (item.buyPrice || 0)) } : null;
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
  G.weeklyForecast = { hot: [], cold: [] };
  G.top3Pids = [];
  G.weather  = { current: null, next: null };
  G.slotCosts = {};
  G.reputation       = 50;
  G.year             = 1;
  G.annualCA         = 0;
  G.annualTarget     = ANNUAL_BASE_TARGET;
  G.weeklyObjectives = [];
  G.currentEvent     = null;
  G.nextEvent        = null;
  G.adBoost          = null;
  G.parking          = { slots: PARKING_INIT_SLOTS };
  G.weeklyDemand     = {};
  G.trendState       = {};
  G.achievements          = [];
  G.streaks               = { objectivesAll: 0, noDecay: 0 };
  G.gazette               = null;
  G._newBadgesThisWeek    = [];
  G._repDelta             = 0;
  G._repSatisfied         = 0;
  G._repWanted            = 0;
  addLog('🌱 Bienvenue dans votre jardinerie ! Bonne saison !', 'info');
  startSupplierPhase();
}

// ── Météo ─────────────────────────────────────────────────────
function pickWeather(seasonName) {
  const weights = WEATHER_WEIGHTS[seasonName] || WEATHER_WEIGHTS['Printemps'];
  const total   = weights.reduce((a, b) => a + b, 0);
  let   roll    = Math.random() * total;
  for (let i = 0; i < WEATHER_TYPES.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return WEATHER_TYPES[i];
  }
  return WEATHER_TYPES[WEATHER_TYPES.length - 1];
}

function nextWeekSeasonName() {
  if (G.weekInSeason >= WEEKS_PER_SEASON) {
    return SEASONS[(G.seasonIdx + 1) % 4];
  }
  return season();
}

function generateWeather() {
  // La prévision de la semaine précédente devient la météo actuelle
  G.weather.current = G.weather.next || pickWeather(season());
  G.weather.next    = pickWeather(nextWeekSeasonName());
}

// ── Événements saisonniers ───────────────────────────────────
function getEventFor(seasonIdx, weekInSeason) {
  return SEASONAL_EVENTS.find(e => e.seasonIdx === seasonIdx && e.weekInSeason === weekInSeason) || null;
}

function refreshEvents() {
  G.currentEvent = getEventFor(G.seasonIdx, G.weekInSeason);
  // Calcul de la semaine suivante pour l'annonce
  let nw = G.weekInSeason + 1, ns = G.seasonIdx;
  if (nw > WEEKS_PER_SEASON) { nw = 1; ns = (ns + 1) % 4; }
  G.nextEvent = getEventFor(ns, nw);
  if (G.currentEvent) {
    addLog(`📅 Événement : ${G.currentEvent.icon} ${G.currentEvent.name} — ${G.currentEvent.desc}`, 'info');
  }
}

// ── Objectifs hebdomadaires ──────────────────────────────────
function generateWeeklyObjectives() {
  G.weeklyObjectives = [];
  const owned = ownedSections();
  if (owned.length === 0) return;

  // Calcul du CA moyen des 3 dernières semaines
  const avgCA = G.salesHistory.length > 0
    ? G.salesHistory.slice(-3).reduce((sum, w) =>
        sum + w.items.reduce((s, i) => s + i.revenue, 0), 0
      ) / Math.min(3, G.salesHistory.length)
    : 1500;

  const pool = [];

  // Objectif 1 : CA total de la semaine
  const caTarget = Math.round(Math.max(800, avgCA * (1.1 + Math.random() * 0.3)) / 50) * 50;
  pool.push({
    type: 'total_ca',
    desc: `Réaliser <strong>${fmt(caTarget)}</strong> de CA cette semaine`,
    target: caTarget,
    current: 0,
    reward: Math.round(caTarget * 0.08 / 50) * 50,
    done: false,
  });

  // Objectif 2 : CA sur un rayon précis
  const randomSid = owned[Math.floor(Math.random() * owned.length)];
  const sidDef    = sectionDef(randomSid);
  const secAvgCA  = G.salesHistory.length > 0
    ? G.salesHistory.slice(-3).reduce((sum, w) =>
        sum + w.items.filter(i => i.sectionId === randomSid).reduce((s, i) => s + i.revenue, 0), 0
      ) / Math.min(3, G.salesHistory.length)
    : 400;
  const secTarget = Math.round(Math.max(250, secAvgCA * (1.15 + Math.random() * 0.4)) / 50) * 50;
  pool.push({
    type: 'section_ca',
    sectionId: randomSid,
    desc: `Faire <strong>${fmt(secTarget)}</strong> de CA sur le rayon <em>${sidDef.name}</em>`,
    target: secTarget,
    current: 0,
    reward: Math.round(secTarget * 0.12 / 50) * 50,
    done: false,
  });

  // Objectif 3 : Ne pas perdre d'articles hors-saison
  const hasOOS = owned.some(sid =>
    G.sections[sid].stock.some(item => isOutOfSeason(item.productId) && item.discount === 0)
  );
  if (hasOOS) {
    pool.push({
      type: 'no_decay',
      desc: `Ne perdre aucun article hors-saison (mettez-les en solde !)`,
      target: 1,
      current: 1, // optimiste : on vérifiera en fin de semaine
      reward: 350,
      done: false,
    });
  }

  // Choisir 2 objectifs parmi le pool
  G.weeklyObjectives = shuffle([...pool]).slice(0, 2);
}

function checkWeeklyObjectives(results) {
  const weekCA     = results.reduce((s, r) => s + r.items.reduce((a, i) => a + i.revenue, 0), 0);
  const decayCount = G.log.filter(e => e.week === G.week && e.type === 'decay').length;
  let bonusTotal   = 0;

  G.weeklyObjectives.forEach(obj => {
    if (obj.done) return;
    switch (obj.type) {
      case 'total_ca':
        obj.current = weekCA;
        obj.done    = weekCA >= obj.target;
        break;
      case 'section_ca': {
        const secRes  = results.find(r => r.sectionId === obj.sectionId);
        obj.current   = secRes ? secRes.items.reduce((s, i) => s + i.revenue, 0) : 0;
        obj.done      = obj.current >= obj.target;
        break;
      }
      case 'no_decay':
        obj.done    = decayCount === 0;
        obj.current = decayCount === 0 ? 1 : 0;
        break;
    }
    if (obj.done) {
      bonusTotal += obj.reward;
      addLog(`🎯 Objectif accompli ! +${fmt(obj.reward)} bonus !`, 'info', true);
    }
  });

  if (bonusTotal > 0) G.money += bonusTotal;
}

// ── Réputation ────────────────────────────────────────────────
function updateReputation(results) {
  let delta = 0;

  // Taux de satisfaction des besoins clients
  let totalWanted = 0, totalSatisfied = 0;
  Object.values(G.weeklyDemand).forEach(d => {
    totalWanted    += d.wanted;
    totalSatisfied += d.satisfied || 0;
  });

  if (totalWanted > 0) {
    const rate = totalSatisfied / totalWanted;
    if (rate >= 0.85)      delta += 5;
    else if (rate >= 0.65) delta += 2;
    else if (rate >= 0.45) delta -= 1;
    else if (rate >= 0.25) delta -= 3;
    else                   delta -= 5;
  }

  // Pénalité pour les invendus hors-saison
  const decayCount = G.log.filter(e => e.week === G.week && e.type === 'decay').length;
  if (decayCount >= 3) delta -= 3;
  else if (decayCount >= 1) delta -= 1;

  // Bonus si objectifs accomplis
  const doneCount = G.weeklyObjectives.filter(o => o.done).length;
  delta += doneCount * 2;

  G.reputation = Math.max(0, Math.min(100, G.reputation + delta));
  // Sauvegarde pour la gazette
  G._repDelta       = delta;
  G._repSatisfied   = totalSatisfied;
  G._repWanted      = totalWanted;
  // Logs gazetteOnly (filtrés du journal)
  const repDir = delta >= 0 ? '▲' : '▼';
  addLog(`⭐ Réputation : ${Math.round(G.reputation)}/100 (${repDir}${Math.abs(delta)})`, 'info', true);
  if (totalWanted > 0) {
    const pct = Math.round((totalSatisfied / totalWanted) * 100);
    addLog(`🛒 Satisfaction clients : ${pct}% (${totalSatisfied}/${totalWanted} besoins comblés)`, 'info', true);
  }
}

// Multiplicateur de réputation appliqué aux ventes
function reputationMult() {
  return 0.5 + (G.reputation / 100); // 0.5 (rep=0) → 1.0 (rep=50) → 1.5 (rep=100)
}

// ── Parking ───────────────────────────────────────────────────
function buyParking() {
  if (G.money < PARKING_UPGRADE_COST)
    return { ok: false, error: `Budget insuffisant. Coût : ${fmt(PARKING_UPGRADE_COST)}` };
  G.money -= PARKING_UPGRADE_COST;
  G.parking.slots += PARKING_UPGRADE_SLOTS;
  addLog(`🅿️ Parking agrandi : ${G.parking.slots} places — ${fmt(PARKING_UPGRADE_COST)}`, 'unlock');
  checkAchievements();
  return { ok: true };
}

// ── Utilitaire : tirage pondéré ──────────────────────────────
function weightedPick(items, weights) {
  let total = 0;
  items.forEach(id => { total += weights[id] || 0; });
  if (total === 0) return items[Math.floor(Math.random() * items.length)];
  let roll = Math.random() * total;
  for (const id of items) {
    roll -= weights[id] || 0;
    if (roll <= 0) return id;
  }
  return items[items.length - 1];
}

// ── Génération de la demande clients ────────────────────────
// Appelée au début de chaque semaine (après météo + événements).
// Simule numClients clients, chacun avec 0–10 besoins parmi
// TOUS les produits des rayons ouverts (en stock ou pas).
function generateClientDemand() {
  G.weeklyDemand = {};
  const owned = ownedSections();
  if (owned.length === 0) return;

  // Pool de tous les produits des rayons ouverts, hors saison exclus
  const pool = [];
  owned.forEach(sid => {
    Object.keys(CATALOG).forEach(pid => {
      if (CATALOG[pid].section === sid && !isOutOfSeason(pid)) pool.push({ pid, sid });
    });
  });
  if (pool.length === 0) return;

  // Poids par produit
  const weights = {};
  pool.forEach(({ pid, sid }) => {
    let w = 1.0;
    w *= (SEASON_DEMAND[season()][sid] || 1.0);
    if (G.trendState[pid]?.direction === 'hot')  w *= 2.5;
    if (G.trendState[pid]?.direction === 'cold') w *= 0.25;
    if (G.weather.current && WEATHER_SUN_SECTIONS.has(sid)) w *= G.weather.current.sunFactor;
    if (G.currentEvent?.boostSections.includes(sid))        w *= G.currentEvent.boostMult;
    if (G.adBoost?.sectionId === sid)                       w *= G.adBoost.mult;
    weights[pid] = Math.max(0.05, w);
  });

  // Nombre effectif de clients = places × facteur réputation
  const numClients = Math.max(1, Math.round(G.parking.slots * reputationMult()));
  const pids = pool.map(p => p.pid);

  for (let c = 0; c < numClients; c++) {
    const needsCount = Math.floor(Math.random() * 11); // 0–10 articles par client
    for (let n = 0; n < needsCount; n++) {
      const pid = weightedPick(pids, weights);
      if (!G.weeklyDemand[pid]) {
        G.weeklyDemand[pid] = { wanted: 0, satisfied: 0, sectionId: CATALOG[pid].section };
      }
      G.weeklyDemand[pid].wanted++;
    }
  }
}

// ── Publicité ────────────────────────────────────────────────
function buyAdBoost(sectionId, levelIdx) {
  const level = AD_LEVELS[levelIdx];
  if (!level) return { ok: false, error: 'Niveau invalide.' };
  if (G.adBoost) return { ok: false, error: 'Vous avez déjà acheté une publicité cette semaine.' };
  if (G.money < level.cost) return { ok: false, error: `Budget insuffisant. Coût : ${fmt(level.cost)}` };
  G.money  -= level.cost;
  G.adBoost = { sectionId, levelIdx, mult: level.mult, cost: level.cost };
  addLog(`📢 Pub ${level.icon} ${level.label} pour ${sectionDef(sectionId).name} — ${fmt(level.cost)}`, 'discount');
  if (levelIdx >= 2) unlockAchievement('pub-radio');
  return { ok: true };
}

function cancelAdBoost() {
  if (!G.adBoost) return { ok: false };
  const refund = G.adBoost.cost;
  const lvl    = AD_LEVELS[G.adBoost.levelIdx];
  const sid    = G.adBoost.sectionId;
  G.money  += refund;
  G.adBoost = null;
  addLog(`🗑️ Pub annulée — ${fmt(refund)} remboursé (${sectionDef(sid).name})`, 'info');
  return { ok: true, refund };
}

// ── Phase fournisseurs ───────────────────────────────────────
function startSupplierPhase() {
  // Purge du journal : on ne garde que S-1 et la semaine en cours
  G.log = G.log.filter(e => e.week >= G.week - 1);
  applyWeeklyDecay();
  autoRestockFromReserve();
  generateSupplierOffers();
  generateWeeklyForecast();
  generateWeather();
  refreshEvents();
  G.adBoost   = null;       // reset pub avant la génération de demande
  generateClientDemand();  // après météo + events
  generateWeeklyObjectives();
  G.top3Pids  = getTop3LastWeek(3).map(i => i.productId);
  G.slotCosts = {};
  G.cart = {};
  ownedSections().forEach(sid => { G.cart[sid] = []; });
  G.phase = 'supplier';
  checkEndOfSeasonWarnings();
}

// Réassort auto (uniquement pour les articles déjà en réserve avant achat)
function autoRestockFromReserve() {
  ownedSections().forEach(sid => {
    const sec = G.sections[sid];

    // Passe 1 : types déjà en rayon → réassort sans nouveau slot
    sec.reserve.forEach(r => {
      if (r.qty <= 0) return;
      if (typeOnShelf(sid, r.productId)) {
        addToStock(sid, r.productId, r.qty, r.buyPrice);
        addLog(`📦 Réassort auto : ${r.qty}× ${productDef(r.productId).name}`, 'restock', true);
        r.qty = 0;
      }
    });
    sec.reserve = sec.reserve.filter(r => r.qty > 0);

    // Passe 2 : nouveaux types → slots libres
    sec.reserve.forEach(r => {
      if (r.qty <= 0 || freeSlots(sid) <= 0) return;
      addToStock(sid, r.productId, r.qty, r.buyPrice);
      addLog(`📦 Réassort auto (nouveau slot) : ${r.qty}× ${productDef(r.productId).name}`, 'restock', true);
      r.qty = 0;
    });
    sec.reserve = sec.reserve.filter(r => r.qty > 0);
  });
}

function addToStock(sid, productId, qty, buyPrice, discount = 0) {
  const sec = G.sections[sid];
  const existing = sec.stock.find(s => s.productId === productId);
  if (existing) {
    const total = existing.qty + qty;
    existing.buyPrice = (existing.buyPrice * existing.qty + buyPrice * qty) / total;
    existing.qty      = total;
  } else {
    sec.stock.push({ id: G.nextItemId++, productId, qty, buyPrice, discount });
  }
}

// ── Génération des offres fournisseur ────────────────────────
function _generateOffersForSection(sid) {
  const products = Object.keys(CATALOG).filter(pid =>
    CATALOG[pid].section === sid && !isOutOfSeason(pid)
  );
  const names  = SUPPLIER_NAMES[sid] || ['Fournisseur'];
  const offers = [];
  products.forEach((pid, i) => {
    const supplierName = names[i % names.length];
    const basePrice    = productDef(pid).price;
    const unitPrice    = Math.round(basePrice * (0.85 + Math.random() * 0.3) * 100) / 100;
    const maxQty       = 10 + Math.floor(Math.random() * 41); // 10–50
    offers.push({ supplierName, productId: pid, maxQty, unitPrice, promoRate: 0, originalPrice: unitPrice });
  });
  // Promo sur 1-2 produits si rayon promu cette semaine
  if (sid === G.promoSectionId && offers.length > 0) {
    const promoCount = 1 + (Math.random() < 0.4 ? 1 : 0);
    shuffle([...offers])
      .slice(0, Math.min(promoCount, offers.length))
      .forEach(offer => {
        offer.promoRate     = Math.random() < 0.5 ? 0.10 : 0.20;
        offer.originalPrice = offer.unitPrice;
        offer.unitPrice     = Math.round(offer.unitPrice * (1 - offer.promoRate) * 100) / 100;
      });
  }
  G.supplierOffers[sid] = offers;
}

function generateSupplierOffers() {
  G.supplierOffers = {};
  const owned = ownedSections();

  let promoSid = null;
  if (G.week === 1 || Math.random() < 0.35) {
    promoSid = owned[Math.floor(Math.random() * owned.length)];
  }
  G.promoSectionId = promoSid;

  owned.forEach(sid => {
    _generateOffersForSection(sid);
    if (sid === promoSid && G.supplierOffers[sid]?.some(o => o.promoRate > 0)) {
      addLog(`🏷️ Promo fournisseur chez ${sectionDef(sid).name} cette semaine !`, 'discount', true);
    }
  });
}

// ── Prévision hebdomadaire avec tendances persistantes ───────
// Les tendances durent 1–3 semaines. On décrémente les existantes
// et on complète jusqu'à 2 hot + 2 cold avec de nouveaux candidats.
function generateWeeklyForecast() {
  // 1. Décrémenter les tendances en cours
  Object.keys(G.trendState).forEach(pid => {
    G.trendState[pid].weeksLeft--;
    if (G.trendState[pid].weeksLeft <= 0) delete G.trendState[pid];
  });

  // 2. Calculer les scores de tous les candidats
  const candidates = [];
  const alreadyInTrend = new Set(Object.keys(G.trendState));

  ownedSections().forEach(sid => {
    const seasonMult = SEASON_DEMAND[season()][sid] || 1.0;
    const items = G.sections[sid].stock.length > 0
      ? G.sections[sid].stock
      : G.sections[sid].reserve.length > 0
        ? G.sections[sid].reserve.map(r => ({ productId: r.productId }))
        : (G.supplierOffers[sid] || []).map(o => ({ productId: o.productId }));

    items.forEach(item => {
      if (alreadyInTrend.has(item.productId)) return; // déjà en tendance
      const prod     = productDef(item.productId);
      const inSeason = !isOutOfSeason(item.productId);
      const lastSale = getLastWeekSales(item.productId);
      const lastQty  = lastSale ? lastSale.qty : 0;

      const hotScore  = (inSeason ? 1 : 0) * seasonMult * (1 + lastQty * 0.1);
      const coldScore = (!inSeason ? 2 : 0)
        + (nearEndOfSeason() && prod.seasonal && prod.seasonal.includes(season()) ? 1.5 : 0)
        + (1 / (seasonMult + 0.1))
        + (lastQty === 0 ? 1 : 0);
      candidates.push({ productId: item.productId, hotScore, coldScore });
    });
  });

  // 3. Combler les slots libres (cible : 2 hot + 2 cold)
  const curHot  = Object.keys(G.trendState).filter(p => G.trendState[p].direction === 'hot').length;
  const curCold = Object.keys(G.trendState).filter(p => G.trendState[p].direction === 'cold').length;
  const needHot  = Math.max(0, 2 - curHot);
  const needCold = Math.max(0, 2 - curCold);
  const used = new Set(Object.keys(G.trendState));

  [...candidates].sort((a, b) => b.hotScore - a.hotScore)
    .filter(c => !used.has(c.productId))
    .slice(0, needHot)
    .forEach(c => {
      G.trendState[c.productId] = { direction: 'hot', weeksLeft: 1 + Math.floor(Math.random() * 3) };
      used.add(c.productId);
    });

  [...candidates].sort((a, b) => b.coldScore - a.coldScore)
    .filter(c => !used.has(c.productId))
    .slice(0, needCold)
    .forEach(c => {
      G.trendState[c.productId] = { direction: 'cold', weeksLeft: 1 + Math.floor(Math.random() * 3) };
      used.add(c.productId);
    });

  // 4. Dériver weeklyForecast (compatibilité avec l'UI existante)
  G.weeklyForecast = {
    hot:  Object.keys(G.trendState).filter(p => G.trendState[p].direction === 'hot'),
    cold: Object.keys(G.trendState).filter(p => G.trendState[p].direction === 'cold'),
  };
}

// ── Panier ───────────────────────────────────────────────────
function addToCart(sid, offerIndex, qty) {
  qty = Math.max(0, Math.round(parseFloat(qty) || 0));
  const offer = G.supplierOffers[sid][offerIndex];
  if (!offer) return;
  const clampedQty = Math.min(qty, offer.maxQty);
  const idx = G.cart[sid].findIndex(c => c.productId === offer.productId);
  if (clampedQty === 0) {
    if (idx !== -1) G.cart[sid].splice(idx, 1);
    return;
  }
  if (idx !== -1) {
    G.cart[sid][idx].qty = clampedQty;
  } else {
    G.cart[sid].push({ ...offer, qty: clampedQty });
  }
}

function removeFromCart(sid, productId) {
  G.cart[sid] = G.cart[sid].filter(c => c.productId !== productId);
}

function cartQty(sid, productId) {
  return G.cart[sid]?.find(c => c.productId === productId)?.qty || 0;
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

  // Tout va en RÉSERVE avec promoRate conservé pour affichage allocation
  G.money -= total;
  owned.forEach(sid => {
    G.cart[sid].forEach(item => {
      const sec      = G.sections[sid];
      const existing = sec.reserve.find(r => r.productId === item.productId);
      if (existing) {
        const t = existing.qty + item.qty;
        existing.buyPrice  = (existing.buyPrice * existing.qty + item.unitPrice * item.qty) / t;
        existing.qty       = t;
        existing.promoRate = Math.max(existing.promoRate || 0, item.promoRate || 0);
      } else {
        sec.reserve.push({
          productId: item.productId,
          qty:       item.qty,
          buyPrice:  item.unitPrice,
          promoRate: item.promoRate || 0,
        });
      }
      const promoTxt = item.promoRate > 0 ? ` (-${Math.round(item.promoRate*100)}% promo !)` : '';
      addLog(`🛒 ${item.qty}× ${productDef(item.productId).name} → réserve${promoTxt} — ${fmt(item.qty * item.unitPrice)}`, 'buy');
    });
  });

  G.cart  = {};
  G.phase = 'allocation';
  unlockAchievement('premier-achat');
  return { ok: true };
}

// ── Phase allocation : déplacer réserve → rayon ──────────────
function moveToShelf(sid, productId) {
  const sec    = G.sections[sid];
  const resIdx = sec.reserve.findIndex(r => r.productId === productId);
  if (resIdx === -1) return { ok: false, error: 'Article introuvable en réserve.' };

  const r              = sec.reserve[resIdx];
  const alreadyOnShelf = typeOnShelf(sid, productId);

  if (!alreadyOnShelf && freeSlots(sid) <= 0) {
    return { ok: false, error: `Plus de slot libre dans ${sectionDef(sid).name}.` };
  }

  addToStock(sid, productId, r.qty, r.buyPrice);
  sec.reserve.splice(resIdx, 1);
  addLog(`📤 ${r.qty}× ${productDef(productId).name} → rayon`, 'restock');
  return { ok: true };
}

// confirmAllocation : simple log, c'est endWeek() qui fait la vraie transition
function confirmAllocation() {
  addLog('🏪 Magasin ouvert !', 'info');
}

// ── Remises ─────────────────────────────────────────────────
function setDiscount(sid, stockItemId, discountRate) {
  const item = G.sections[sid].stock.find(s => s.id === stockItemId);
  if (item) {
    item.discount = Math.max(0, Math.min(0.5, discountRate));
    addLog(`🏷️ Remise ${Math.round(item.discount * 100)}% → ${productDef(item.productId).name}`, 'discount');
  }
}

// Remise par productId (utile depuis la modal allocation)
function setDiscountByProduct(sid, productId, discountRate) {
  const item = G.sections[sid].stock.find(s => s.productId === productId);
  if (item) {
    item.discount = Math.max(0, Math.min(0.5, discountRate));
    addLog(`🏷️ Remise ${Math.round(item.discount * 100)}% → ${productDef(item.productId).name}`, 'discount');
  }
}

// ── Badges / Achievements ────────────────────────────────────
function unlockAchievement(id) {
  if (G.achievements.includes(id)) return false;
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return false;
  G.achievements.push(id);
  // Suivre les nouveaux badges pour la gazette
  if (!G._newBadgesThisWeek) G._newBadgesThisWeek = [];
  G._newBadgesThisWeek.push(def);
  if (def.reward > 0) {
    G.money += def.reward;
    addLog(`🏅 Badge débloqué : ${def.name} — +${fmt(def.reward)} !`, 'unlock', true);
  } else {
    addLog(`🏅 Badge débloqué : ${def.name}`, 'unlock', true);
  }
  // Déclencher le toast animé via l'UI (si disponible)
  if (typeof showBadgeToast === 'function') showBadgeToast(def);
  saveGame();
  return true;
}

function checkAchievements() {
  const owned = ownedSections();
  const numOwned = owned.length;

  // — Progression —
  checkAchievements._firstPurchaseDone = checkAchievements._firstPurchaseDone || false;

  if (G.week >= 1) unlockAchievement('premiere-ouverture');

  if (numOwned >= 2) unlockAchievement('deuxieme-rayon');
  if (numOwned >= 5) unlockAchievement('cinq-rayons');
  if (numOwned >= Object.keys(SECTIONS_DEF).length) unlockAchievement('tous-rayons');

  // Slot max dans un rayon
  if (owned.some(sid => G.sections[sid].slots >= 12)) unlockAchievement('slot-max');

  // Parking
  if (G.parking.slots >= 30) unlockAchievement('parking-30');

  // Première année (semaine 4*4 = 16+ si 4 saisons × 4 semaines)
  if (G.week >= 16) unlockAchievement('premiere-annee');
  // Longévité
  if (G.week >= 20) unlockAchievement('semaine-20');
  if (G.week >= 50) unlockAchievement('semaine-50');
  if (G.week >= 48) unlockAchievement('annee-3');

  // — Performance —
  // Satisfaction 100%
  let totalW = 0, totalS = 0;
  Object.values(G.weeklyDemand).forEach(d => { totalW += d.wanted; totalS += d.satisfied || 0; });
  if (totalW > 0 && totalS >= totalW) unlockAchievement('satisfaction-100');

  // Réputation
  if (G.reputation >= 90) unlockAchievement('reputation-90');

  // CA semaine (via résultats stockés dans le log de la semaine)
  const weekRevenue = G.log
    .filter(e => e.week === G.week && e.type === 'sale')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  if (weekRevenue >= 2000) unlockAchievement('ca-2000');
  if (weekRevenue >= 5000) unlockAchievement('ca-5000');

  // Caisse
  if (G.money >= 10000) unlockAchievement('caisse-10000');

  // Objectifs 3 semaines de suite
  const allObjDone = G.weeklyObjectives.length > 0 && G.weeklyObjectives.every(o => o.done);
  if (allObjDone) {
    G.streaks.objectivesAll++;
  } else {
    G.streaks.objectivesAll = 0;
  }
  if (G.streaks.objectivesAll >= 3) unlockAchievement('objectifs-3serie');

  // — Maîtrise —
  // Pub radio (niveau 3 = index 2)
  if (G.adBoost && G.adBoost.levelIdx >= 2) unlockAchievement('pub-radio');

  // Rupture totale sur un rayon (tous les slots occupés avec qty=0 après ventes)
  const totalRupture = owned.some(sid => {
    const stock = G.sections[sid].stock;
    return stock.length > 0 && stock.every(it => it.qty === 0);
  });
  if (totalRupture) unlockAchievement('rupture-totale');

  // Zéro gâchis (aucun decay cette semaine)
  const decayThisWeek = G.log.filter(e => e.week === G.week && e.type === 'decay').length;
  if (decayThisWeek === 0) {
    G.streaks.noDecay++;
  } else {
    G.streaks.noDecay = 0;
  }
  if (G.streaks.noDecay >= 4) unlockAchievement('no-decay-4');

  // Roi des soldes (15 articles hors-saison vendus via promo)
  const promoOutOfSeasonSold = G.log
    .filter(e => e.week === G.week && e.type === 'promo-oos')
    .reduce((sum, e) => sum + (e.qty || 0), 0);
  if (promoOutOfSeasonSold >= 15) unlockAchievement('soldes-expert');

  // Champion d'événement
  if (G.currentEvent && weekRevenue >= 3000) unlockAchievement('event-champion');
}

// ── Fin de semaine / ventes ──────────────────────────────────
function endWeek() {
  const results = [];

  ownedSections().forEach(sid => {
    const sec = G.sections[sid];
    const sectionResults = [];

    sec.stock.forEach(item => {
      if (item.qty <= 0) return;
      const pid = item.productId;

      // Demande générée par les clients (via generateClientDemand)
      const demanded = G.weeklyDemand[pid]?.wanted || 0;

      // Boost remise et publicité sur la demande
      let effectiveDemand = demanded;
      // Boost remise
      if (demanded > 0 && item.discount > 0) {
        const minBoost = 1 + item.discount * 1.5;
        const maxBoost = 1 + item.discount * 3.5;
        effectiveDemand = Math.round(effectiveDemand * (minBoost + Math.random() * (maxBoost - minBoost)));
      }
      // Boost publicité (achetée après génération de la demande)
      if (demanded > 0 && G.adBoost && G.adBoost.sectionId === sid) {
        effectiveDemand = Math.round(effectiveDemand * G.adBoost.mult);
      }

      // Aucune demande client (produit hors saison ou non sollicité)
      let isPromoOos = false;
      if (effectiveDemand === 0) {
        if (item.discount > 0 && isOutOfSeason(pid)) {
          // Hors saison mais en promo : clients opportunistes attirés par la remise
          const numClients = Math.max(1, Math.round(G.parking.slots * reputationMult()));
          const promoRate  = 0.1 + item.discount * 0.9; // 10%→~0.19 / 25%→~0.33 / 50%→~0.55
          effectiveDemand  = Math.max(1, Math.round(
            numClients * promoRate * (0.7 + Math.random() * 0.6)
          ));
          isPromoOos = true;
        } else {
          // Walk-in minimal pour tout autre article sans demande simulée
          effectiveDemand = Math.max(0, Math.round(item.qty * (BASE_SELL_RATE * 0.3)));
        }
      }

      const actualSold = Math.min(item.qty, effectiveDemand);

      // Enregistrer la satisfaction dans weeklyDemand
      if (G.weeklyDemand[pid]) {
        G.weeklyDemand[pid].satisfied = Math.min(demanded, actualSold);
      }

      // Log promo hors-saison pour badge "Roi des soldes"
      if (isPromoOos && actualSold > 0) {
        G.log.push({ week: G.week, type: 'promo-oos', qty: actualSold });
      }

      const unitRev = sellPrice(pid, item.discount);
      const revenue = actualSold * unitRev;
      const profit  = revenue - actualSold * item.buyPrice;

      sectionResults.push({
        productId:    pid,
        sold:         actualSold,
        revenue,
        profit,
        buyPrice:     item.buyPrice,
        unitRevenue:  unitRev,
        discount:     item.discount,
        wasDiscounted: item.discount > 0,
        soldOut:      item.qty - actualSold === 0,
      });

      item.qty -= actualSold;
      G.money  += revenue;
    });

    sec.stock = sec.stock.filter(i => i.qty > 0);
    results.push({ sectionId: sid, items: sectionResults, slotCost: G.slotCosts[sid] || 0 });

    const secRevenue = sectionResults.reduce((a, r) => a + r.revenue, 0);
    addLog(`📊 ${sectionDef(sid).name} — ${fmt(secRevenue)}`, 'sales', true);
  });

  G.weeklyResults = results;

  // Objectifs & réputation (avant advanceWeek pour lire le bon week n°)
  checkWeeklyObjectives(results);
  updateReputation(results);

  // CA annuel
  const weekCA = results.reduce((s, r) => s + r.items.reduce((a, i) => a + i.revenue, 0), 0);
  // Log CA semaine pour badges
  if (weekCA > 0) G.log.push({ week: G.week, type: 'sale', amount: weekCA });
  G.annualCA  += weekCA;

  // Historique (max 8 semaines)
  const allItems = results.flatMap(r => r.items.map(i => ({
    productId: i.productId, sectionId: r.sectionId, qty: i.sold, revenue: i.revenue,
    buyPrice: i.buyPrice,
  })));
  G.salesHistory.push({ week: G.week, seasonIdx: G.seasonIdx, items: allItems });
  if (G.salesHistory.length > 8) G.salesHistory.shift();

  // Badges (après mise à jour de la semaine, avant advanceWeek)
  G._newBadgesThisWeek = [];
  checkAchievements();

  // ── Construction de la Gazette ────────────────────────────
  const gazetteSections = results.map(r => {
    const def = sectionDef(r.sectionId);
    const secRev = r.items.reduce((s, i) => s + i.revenue, 0);
    const secProfit = r.items.reduce((s, i) => s + i.profit, 0);
    const sold = r.items.reduce((s, i) => s + i.sold, 0);
    return {
      sid: r.sectionId,
      name: def.name,
      icon: def.icon,
      color: def.borderColor,
      revenue: secRev,
      profit: secProfit,
      soldCount: sold,
      items: r.items,
    };
  }).filter(s => s.revenue > 0 || s.soldCount > 0)
    .sort((a, b) => b.revenue - a.revenue);

  // Decay de cette semaine (logs de la semaine courante)
  const decayLogs = G.log.filter(e => e.week === G.week && e.type === 'decay');
  const decayMap  = {};
  decayLogs.forEach(e => {
    const match = e.msg.match(/1× (.+) perdu/);
    if (match) decayMap[match[1]] = (decayMap[match[1]] || 0) + 1;
  });
  const decayItems = Object.entries(decayMap).map(([name, qty]) => ({ name, qty }));

  // Réassort de cette semaine
  const restockLogs = G.log.filter(e => e.week === G.week && e.type === 'restock');
  const restockItems = restockLogs.map(e => e.msg.replace('📦 ', ''));

  // Promo fournisseur de cette semaine
  const promoLog = G.log.find(e => e.week === G.week && e.type === 'discount' && e.msg.includes('Promo fournisseur'));
  const promoInfo = promoLog ? promoLog.msg.replace('🏷️ ', '') : null;

  G.gazette = {
    week:         G.week,
    season:       season(),
    year:         G.year,
    totalRevenue: weekCA,
    totalProfit:  results.reduce((s, r) => s + r.items.reduce((a, i) => a + i.profit, 0), 0),
    sections:     gazetteSections,
    satisfaction: {
      pct:       G._repWanted > 0 ? Math.round((G._repSatisfied / G._repWanted) * 100) : null,
      satisfied: G._repSatisfied || 0,
      wanted:    G._repWanted    || 0,
      numClients: Math.max(1, Math.round(G.parking.slots * reputationMult())),
    },
    reputation:   { current: G.reputation, delta: G._repDelta || 0 },
    objectives:   G.weeklyObjectives.map(o => ({ ...o })),
    newBadges:    [...(G._newBadgesThisWeek || [])],
    decayItems,
    restockItems,
    promoInfo,
    weather:      G.weather.current ? { ...G.weather.current } : null,
    event:        G.currentEvent    ? { ...G.currentEvent }    : null,
    annualCA:     G.annualCA,
    annualTarget: G.annualTarget,
  };

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
    // Fin d'année (retour au printemps)
    if (G.seasonIdx === 0) {
      G.year++;
      const annualResult = G.annualCA >= G.annualTarget ? 'atteint' : 'non atteint';
      addLog(`🏆 Année ${G.year - 1} terminée ! CA annuel : ${fmt(G.annualCA)} (objectif ${annualResult})`, 'info');
      G.annualCA = 0;
      G.annualTarget = Math.round(ANNUAL_BASE_TARGET * Math.pow(1.2, G.year - 1));
    }
  }
}

// ── Déclin hors saison ───────────────────────────────────────
function applyWeeklyDecay() {
  ownedSections().forEach(sid => {
    G.sections[sid].stock.forEach(item => {
      if (!isOutOfSeason(item.productId) || item.qty <= 0) return;
      item.qty -= 1;
      addLog(`🍂 Invendu hors saison : 1× ${productDef(item.productId).name} perdu`, 'decay', true);
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
// Top ventes semaine précédente — trié par qty × bénéfice
function getTop3LastWeek(n = 3) {
  if (G.salesHistory.length === 0) return [];
  const last = G.salesHistory[G.salesHistory.length - 1];
  return [...last.items]
    .map(i => ({
      ...i,
      profit:     i.revenue - i.qty * (i.buyPrice || 0),
      score:      i.qty * Math.max(0, i.revenue - i.qty * (i.buyPrice || 0)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

function getTopSales(n = 3, lastWeeks = 4) {
  if (G.salesHistory.length === 0) return [];
  const recent = G.salesHistory.slice(-lastWeeks);
  const totals = {};
  recent.forEach(w => {
    w.items.forEach(i => {
      if (!totals[i.productId]) totals[i.productId] = { qty: 0, revenue: 0, profit: 0, weekCount: 0 };
      totals[i.productId].qty       += i.qty;
      totals[i.productId].revenue   += i.revenue;
      totals[i.productId].profit    += i.revenue - i.qty * (i.buyPrice || 0);
      totals[i.productId].weekCount++;
    });
  });
  return Object.entries(totals)
    .sort((a, b) => (b[1].qty * b[1].profit) - (a[1].qty * a[1].profit))
    .slice(0, n)
    .map(([pid, d]) => ({ productId: pid, qty: d.qty, revenue: d.revenue, profit: d.profit, weekCount: d.weekCount }));
}

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

  const prod = productDef(productId);
  const nearSeasonEnd = nearEndOfSeason() && prod.seasonal && prod.seasonal.includes(season());

  if (rankLast === -1)       return 'absent';
  if (nearSeasonEnd)         return 'declining';
  if (rankPrev === -1)       return 'new';
  if (rankLast < rankPrev)   return 'up';
  if (rankLast > rankPrev)   return 'down';
  return 'stable';
}

// ── Débloquer / acheter un slot ──────────────────────────────
function unlockSection(sid) {
  const def = sectionDef(sid);
  if (G.sections[sid].owned)    return { ok: false, error: 'Rayon déjà ouvert.' };
  if (G.money < def.unlockCost) return { ok: false, error: `Budget insuffisant. Coût : ${fmt(def.unlockCost)}` };
  G.money -= def.unlockCost;
  G.sections[sid].owned = true;
  // Initialiser le panier et générer les offres pour ce nouveau rayon
  if (!G.cart[sid]) G.cart[sid] = [];
  _generateOffersForSection(sid);
  addLog(`🏪 Nouveau rayon : ${def.name} !`, 'unlock');
  checkAchievements();
  return { ok: true };
}

function buySlot(sid) {
  const sec = G.sections[sid];
  if (!sec.owned)            return { ok: false, error: 'Rayon non ouvert.' };
  if (sec.slots >= MAX_SLOTS) return { ok: false, error: `Maximum (${MAX_SLOTS}) atteint.` };
  const cost = nextSlotCost(sid);
  if (G.money < cost)        return { ok: false, error: `Budget insuffisant. Coût : ${fmt(cost)}` };
  G.money -= cost;
  sec.slots++;
  G.slotCosts[sid] = (G.slotCosts[sid] || 0) + cost;
  addLog(`📐 ${sectionDef(sid).name} — slot acheté (${sec.slots}/${MAX_SLOTS})`, 'unlock');
  return { ok: true };
}

// ── Sauvegarde / Chargement ──────────────────────────────────
function saveGame() {
  try {
    const snapshot = JSON.parse(JSON.stringify(G)); // deep clone
    snapshot._savedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    return true;
  } catch(e) {
    console.error('Sauvegarde échouée :', e);
    return false;
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    Object.keys(data).forEach(k => { G[k] = data[k]; });
    // Migration : champs absents des vieilles sauvegardes
    if (G.reputation       === undefined) G.reputation       = 50;
    if (G.year             === undefined) G.year             = 1;
    if (G.annualCA         === undefined) G.annualCA         = 0;
    if (G.annualTarget     === undefined) G.annualTarget     = ANNUAL_BASE_TARGET;
    if (G.weeklyObjectives === undefined) G.weeklyObjectives = [];
    if (G.currentEvent     === undefined) G.currentEvent     = null;
    if (G.nextEvent        === undefined) G.nextEvent        = null;
    if (G.adBoost          === undefined) G.adBoost          = null;
    if (G.parking          === undefined) G.parking          = { slots: PARKING_INIT_SLOTS };
    if (G.weeklyDemand     === undefined) G.weeklyDemand     = {};
    if (G.trendState       === undefined) G.trendState       = {};
    if (G.achievements     === undefined) G.achievements     = [];
    if (G.streaks          === undefined) G.streaks          = { objectivesAll: 0, noDecay: 0 };
    // Régénérer les offres fournisseur à chaque chargement
    // (évite les problèmes de format entre versions)
    generateSupplierOffers();
    return true;
  } catch(e) {
    console.error('Chargement échoué :', e);
    return false;
  }
}

function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

function getSaveMeta() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      week:      data.week,
      seasonIdx: data.seasonIdx,
      money:     data.money,
      savedAt:   data._savedAt || null,
    };
  } catch(e) { return null; }
}

function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
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
    s.reserve.forEach(i => { v += i.qty * catalogSellPrice(i.productId); });
  });
  return v;
}
