// ═══════════════════════════════════════════════════════════════
//  CATALOG — Produits & Rayons
// ═══════════════════════════════════════════════════════════════

const SEASONS = ['Printemps', 'Été', 'Automne', 'Hiver'];
const WEEKS_PER_SEASON = 13;

// ── Sections ────────────────────────────────────────────────────
// BASE_SLOTS : chaque rayon démarre avec 6 emplacements (1 emplacement = 1 type de produit).
// On peut en acheter un par un jusqu'à MAX_SLOTS = 12.
// Coût du Nième emplacement supplémentaire = slotCost × N  (1er extra = slotCost, 2e = 2×slotCost…)
const BASE_SLOTS = 6;
const MAX_SLOTS  = 12;

const SECTIONS_DEF = {
  'serre-chaude': {
    name: 'Serre Chaude', icon: '🌡️',
    unlockCost: 0,   slotCost: 800,
    description: 'Plantes tropicales & intérieur',
    color: '#1a4a1a', borderColor: '#4caf50', textColor: '#a8e6a0',
    gridArea: 'sc',
  },
  'serre-froide': {
    name: 'Serre Froide', icon: '❄️',
    unlockCost: 3000, slotCost: 700,
    description: 'Plantes de saison & extérieur',
    color: '#0d2a3d', borderColor: '#4fc3f7', textColor: '#b3e5fc',
    gridArea: 'sf',
  },
  'pepiniere': {
    name: 'Pépinière', icon: '🌳',
    unlockCost: 5000, slotCost: 1000,
    description: 'Arbres, arbustes & haies',
    color: '#1b3a1b', borderColor: '#8bc34a', textColor: '#c5e1a5',
    gridArea: 'pep',
  },
  'decoration': {
    name: 'Boutique Déco', icon: '🎨',
    unlockCost: 4000, slotCost: 600,
    description: 'Décoration intérieure & extérieure',
    color: '#3a1a3a', borderColor: '#ce93d8', textColor: '#e1bee7',
    gridArea: 'dec',
  },
  'poteries-naturelle': {
    name: 'Poteries Naturelles', icon: '🏺',
    unlockCost: 3500, slotCost: 500,
    description: 'Terre cuite, bois & céramique',
    color: '#3a1f0a', borderColor: '#ff8a65', textColor: '#ffccbc',
    gridArea: 'pnat',
  },
  'poteries-plastique': {
    name: 'Poteries Plastique', icon: '🪣',
    unlockCost: 2500, slotCost: 400,
    description: 'Pots & jardinières synthétiques',
    color: '#0d1f2d', borderColor: '#64b5f6', textColor: '#bbdefb',
    gridArea: 'ppla',
  },
  'animalerie': {
    name: 'Animalerie', icon: '🐟',
    unlockCost: 6000, slotCost: 900,
    description: 'Animaux & accessoires',
    color: '#0a2233', borderColor: '#29b6f6', textColor: '#b3e5fc',
    gridArea: 'ani',
  },
  'outils': {
    name: 'Outils', icon: '🔧',
    unlockCost: 2500, slotCost: 450,
    description: 'Matériel & outillage',
    color: '#2a1a0a', borderColor: '#ff7043', textColor: '#ffccbc',
    gridArea: 'out',
  },
  'produits-jardin': {
    name: 'Produits Jardin', icon: '🧪',
    unlockCost: 2000, slotCost: 400,
    description: 'Engrais, semences & traitements',
    color: '#1a2a0a', borderColor: '#aed581', textColor: '#dcedc8',
    gridArea: 'pjd',
  },
  'terreau': {
    name: 'Terreau', icon: '🌱',
    unlockCost: 1500, slotCost: 300,
    description: 'Substrats & amendements',
    color: '#1a1005', borderColor: '#a1887f', textColor: '#d7ccc8',
    gridArea: 'ter',
  },
  'bassin': {
    name: 'Bassin', icon: '💧',
    unlockCost: 7000, slotCost: 1100,
    description: 'Plantes & poissons aquatiques',
    color: '#051a2a', borderColor: '#0288d1', textColor: '#b3e5fc',
    gridArea: 'bas',
  },
};

// ── Catalogue produits ────────────────────────────────────────
// seasonal: null = toute l'année, [...] = saisons favorables
// outOfSeasonMalus: multiplicateur de vente hors saison (défaut 0.35)
const CATALOG = {
  // ── SERRE CHAUDE ──────────────────────────────────────────
  'orchidee':          { name:'Orchidées',           section:'serre-chaude',    price:12, icon:'🌸', seasonal:['Hiver','Printemps'] },
  'cactus':            { name:'Cactus & Succulentes', section:'serre-chaude',   price:6,  icon:'🌵', seasonal:null },
  'ficus':             { name:'Ficus',                section:'serre-chaude',   price:18, icon:'🪴', seasonal:null },
  'pothos':            { name:'Pothos & Lianes',      section:'serre-chaude',   price:8,  icon:'🌿', seasonal:null },
  'palmier-int':       { name:'Palmiers intérieur',   section:'serre-chaude',   price:22, icon:'🌴', seasonal:null },
  'plante-carnivore':  { name:'Plantes carnivores',   section:'serre-chaude',   price:14, icon:'🪲', seasonal:['Printemps','Été'] },
  'anthurium':         { name:'Anthurium',            section:'serre-chaude',   price:16, icon:'🌺', seasonal:['Hiver'] },
  'bromelia':          { name:'Broméliacées',         section:'serre-chaude',   price:10, icon:'🌻', seasonal:null },

  // ── SERRE FROIDE ─────────────────────────────────────────
  'geranium':          { name:'Géraniums',            section:'serre-froide',   price:4,  icon:'🌹', seasonal:['Printemps','Été'] },
  'petunia':           { name:'Pétunias',             section:'serre-froide',   price:3,  icon:'🌷', seasonal:['Printemps','Été'] },
  'lavande':           { name:'Lavandes',             section:'serre-froide',   price:6,  icon:'💜', seasonal:['Printemps','Été'] },
  'rosier':            { name:'Rosiers',              section:'serre-froide',   price:14, icon:'🌹', seasonal:['Printemps','Été'] },
  'cyclamen':          { name:'Cyclamens',            section:'serre-froide',   price:5,  icon:'🌸', seasonal:['Automne','Hiver'] },
  'pensee':            { name:'Pensées',              section:'serre-froide',   price:2,  icon:'💐', seasonal:['Automne','Printemps'] },
  'hydrangee':         { name:'Hortensias',           section:'serre-froide',   price:12, icon:'💐', seasonal:['Printemps','Été'] },
  'chrysantheme':      { name:'Chrysanthèmes',        section:'serre-froide',   price:5,  icon:'🌼', seasonal:['Automne'] },

  // ── PÉPINIÈRE ────────────────────────────────────────────
  'arbuste-fruitier':  { name:'Arbustes fruitiers',   section:'pepiniere',      price:18, icon:'🍓', seasonal:['Printemps','Automne'] },
  'haie-thuja':        { name:'Thuyas & Lauriers',    section:'pepiniere',      price:14, icon:'🌲', seasonal:null },
  'arbre-ornemental':  { name:'Arbres ornementaux',   section:'pepiniere',      price:35, icon:'🌳', seasonal:['Printemps'] },
  'conifere':          { name:'Conifères',            section:'pepiniere',      price:20, icon:'🎄', seasonal:['Automne','Hiver'] },
  'rosier-tige':       { name:'Rosiers sur tige',     section:'pepiniere',      price:28, icon:'🌹', seasonal:['Printemps'] },

  // ── DÉCORATION ──────────────────────────────────────────
  'bougie':            { name:'Bougies parfumées',    section:'decoration',     price:8,  icon:'🕯️', seasonal:['Automne','Hiver'] },
  'vase-design':       { name:'Vases design',         section:'decoration',     price:15, icon:'🏺', seasonal:null },
  'coussin-textile':   { name:'Coussins & textiles',  section:'decoration',     price:18, icon:'🛋️', seasonal:null },
  'lanterne':          { name:'Lanternes',            section:'decoration',     price:12, icon:'🏮', seasonal:['Automne','Hiver'] },
  'guirlande':         { name:'Guirlandes lumineuses',section:'decoration',     price:10, icon:'✨', seasonal:['Hiver'] },
  'cadre-nature':      { name:'Cadres & tableaux',    section:'decoration',     price:22, icon:'🖼️', seasonal:null },

  // ── POTERIES NATURELLES ──────────────────────────────────
  'pot-terracotta':    { name:'Pots en terre cuite',  section:'poteries-naturelle', price:8,  icon:'🏺', seasonal:null },
  'jardiniere-bois':   { name:'Jardinières en bois',  section:'poteries-naturelle', price:22, icon:'🪵', seasonal:['Printemps','Été'] },
  'suspension-macrame':{ name:'Suspensions macramé',  section:'poteries-naturelle', price:16, icon:'🪢', seasonal:null },
  'pot-ceramique':     { name:'Poteries céramique',   section:'poteries-naturelle', price:18, icon:'🫙', seasonal:null },
  'pot-pierre':        { name:'Bacs en pierre reconstituée', section:'poteries-naturelle', price:28, icon:'🪨', seasonal:['Printemps','Été'] },

  // ── POTERIES PLASTIQUE ───────────────────────────────────
  'pot-plastique':     { name:'Pots en plastique',    section:'poteries-plastique', price:3,  icon:'🪣', seasonal:null },
  'jardiniere-plast':  { name:'Jardinières plastique',section:'poteries-plastique', price:12, icon:'🧺', seasonal:['Printemps','Été'] },
  'cache-pot-design':  { name:'Cache-pots design',    section:'poteries-plastique', price:12, icon:'🪴', seasonal:null },
  'bac-resine':        { name:'Bacs en résine',       section:'poteries-plastique', price:18, icon:'🫙', seasonal:['Printemps','Été'] },

  // ── OUTILS ───────────────────────────────────────────────
  'secateur':          { name:'Sécateurs',            section:'outils',         price:14, icon:'✂️', seasonal:null },
  'beche-rateau':      { name:'Bêches & Râteaux',     section:'outils',         price:18, icon:'⛏️', seasonal:['Printemps','Été'] },
  'arrosoir':          { name:'Arrosoirs',            section:'outils',         price:12, icon:'🪣', seasonal:['Printemps','Été'] },
  'gants':             { name:'Gants de jardin',      section:'outils',         price:6,  icon:'🧤', seasonal:null },
  'tondeuse':          { name:'Tondeuses',            section:'outils',         price:85, icon:'🌿', seasonal:['Printemps','Été'] },

  // ── PRODUITS JARDIN ──────────────────────────────────────
  'engrais':           { name:'Engrais',              section:'produits-jardin',price:7,  icon:'💊', seasonal:['Printemps','Été'] },
  'pesticide-bio':     { name:'Pesticides bio',       section:'produits-jardin',price:9,  icon:'🧴', seasonal:['Printemps','Été'] },
  'semences':          { name:'Semences',             section:'produits-jardin',price:3,  icon:'🌾', seasonal:['Printemps'] },
  'bulbes':            { name:'Bulbes',               section:'produits-jardin',price:5,  icon:'🧅', seasonal:['Automne'] },
  'defoliant':         { name:'Désherbants bio',      section:'produits-jardin',price:8,  icon:'🌿', seasonal:['Printemps','Été'] },

  // ── TERREAU ──────────────────────────────────────────────
  'terreau-univ':      { name:'Terreau universel',    section:'terreau',        price:6,  icon:'🌱', seasonal:null },
  'terreau-orchidee':  { name:'Terreau orchidées',    section:'terreau',        price:8,  icon:'🌸', seasonal:null },
  'substrat-cactus':   { name:'Substrat cactus',      section:'terreau',        price:7,  icon:'🌵', seasonal:null },
  'compost':           { name:'Compost',              section:'terreau',        price:9,  icon:'♻️', seasonal:['Printemps','Automne'] },
  'paillage':          { name:'Paillage',             section:'terreau',        price:8,  icon:'🪵', seasonal:['Printemps','Été'] },

  // ── ANIMALERIE ───────────────────────────────────────────
  'poisson-rouge':     { name:'Poissons rouges',      section:'animalerie',     price:3,  icon:'🐠', seasonal:null },
  'oiseau-exotique':   { name:'Oiseaux exotiques',    section:'animalerie',     price:28, icon:'🦜', seasonal:null },
  'hamster-lapin':     { name:'Hamsters & lapins',    section:'animalerie',     price:15, icon:'🐹', seasonal:null },
  'insecte-auxiliaire':{ name:'Insectes auxiliaires', section:'animalerie',     price:5,  icon:'🐞', seasonal:['Printemps','Été'] },
  'nourriture-animal': { name:'Nourriture animale',   section:'animalerie',     price:4,  icon:'🥫', seasonal:null },

  // ── BASSIN ───────────────────────────────────────────────
  'plante-aquatique':  { name:'Plantes aquatiques',   section:'bassin',         price:8,  icon:'🪷', seasonal:['Printemps','Été'] },
  'pompe-filtre':      { name:'Pompes & Filtres',     section:'bassin',         price:35, icon:'⚙️', seasonal:null },
  'poisson-bassin':    { name:'Poissons de bassin',   section:'bassin',         price:6,  icon:'🐡', seasonal:['Printemps','Été'] },
  'traitement-eau':    { name:'Traitement eau',       section:'bassin',         price:12, icon:'💧', seasonal:null },
  'fontaine-deco':     { name:'Fontaines décoratives',section:'bassin',         price:55, icon:'⛲', seasonal:['Printemps','Été'] },
};

// Multiplicateurs de vente par saison et par section
// Base 1.0 = vente normale, >1 = forte demande, <1 = faible demande
const SEASON_DEMAND = {
  'Printemps': {
    'serre-chaude': 0.9,  'serre-froide': 1.6,  'pepiniere': 1.8,
    'decoration': 0.7,    'poteries-naturelle': 1.5, 'poteries-plastique': 1.4,
    'animalerie': 1.0,    'outils': 1.5,        'produits-jardin': 1.8,
    'terreau': 1.6,       'bassin': 1.3,
  },
  'Été': {
    'serre-chaude': 0.7,  'serre-froide': 1.2,  'pepiniere': 1.0,
    'decoration': 0.8,    'poteries-naturelle': 1.2, 'poteries-plastique': 1.1,
    'animalerie': 1.3,    'outils': 1.1,        'produits-jardin': 1.5,
    'terreau': 1.1,       'bassin': 1.8,
  },
  'Automne': {
    'serre-chaude': 1.1,  'serre-froide': 1.3,  'pepiniere': 1.4,
    'decoration': 1.2,    'poteries-naturelle': 1.1, 'poteries-plastique': 0.9,
    'animalerie': 0.9,    'outils': 0.8,        'produits-jardin': 1.1,
    'terreau': 1.3,       'bassin': 0.5,
  },
  'Hiver': {
    'serre-chaude': 1.4,  'serre-froide': 0.5,  'pepiniere': 0.6,
    'decoration': 1.8,    'poteries-naturelle': 0.9, 'poteries-plastique': 0.7,
    'animalerie': 1.1,    'outils': 0.4,        'produits-jardin': 0.5,
    'terreau': 0.6,       'bassin': 0.3,
  },
};

// Noms de fournisseurs par section
const SUPPLIER_NAMES = {
  'serre-chaude':    ['Exotica Plants',  'Tropic\'Verde',   'Jardin des Tropiques'],
  'serre-froide':    ['Fleurs du Nord',  'Saison Verte',    'Plantissimo'],
  'pepiniere':       ['Arborea',         'La Pépine',       'ForestGarden'],
  'decoration':      ['DécoNature',      'Tendance Maison', 'Artisan Vert'],
  'poteries-naturelle': ['Terra Firma',   'L\'Atelier Cuit', 'Céramiques du Sud'],
  'poteries-plastique': ['PlastiJardin', 'GreenPlast',       'ColorPot'],
  'animalerie':      ['Zoo&Co',          'Aqua Vivant',     'Bestiole & Cie'],
  'outils':          ['FerronJardin',    'OutilPro',        'Le Jardinier Malin'],
  'produits-jardin': ['BioGarden',       'Traitements+',    'Semencier Fleuri'],
  'terreau':         ['Humus & Co',      'Substrate Pro',   'Le Sol Vivant'],
  'bassin':          ['Aqua Jardin',     'BassinsPlus',     'NaturAqua'],
};
