// ═══════════════════════════════════════════════════════════════
//  UI — Rendu & Interactions
// ═══════════════════════════════════════════════════════════════

let activeSection = null; // section sélectionnée dans la modal
let modalMode = null;     // 'supplier' | 'stock' | 'unlock'

// ── Bootstrap ────────────────────────────────────────────────
function uiInit() {
  initGame();
  renderAll();
  bindGlobalEvents();
}

function renderAll() {
  renderHUD();
  renderStoreMap();
  renderLog();
}

// ── HUD (argent, semaine, saison) ────────────────────────────
function renderHUD() {
  el('hud-money').textContent   = fmt(G.money);
  el('hud-week').textContent    = `Semaine ${G.week}`;
  el('hud-season').textContent  = season();
  el('hud-season-week').textContent = `(${G.weekInSeason}/${WEEKS_PER_SEASON})`;
  el('hud-stock-value').textContent = fmt(totalStockValue());

  const seasonIcons = ['🌱','☀️','🍂','❄️'];
  el('season-icon').textContent = seasonIcons[G.seasonIdx];

  // Phase indicator
  const phases = { supplier:'🏪 Approvisionnement', market:'🌿 Gestion du magasin', results:'📊 Résultats' };
  el('hud-phase').textContent = phases[G.phase] || '';

  // Boutons selon la phase
  const endBtn = el('btn-end-week');
  if (endBtn) endBtn.style.display = G.phase === 'market' ? 'inline-flex' : 'none';
  const supplierBtn = el('btn-supplier');
  if (supplierBtn) supplierBtn.style.display = G.phase === 'supplier' ? 'inline-flex' : 'none';
}

// ── Carte du magasin (top-down) ──────────────────────────────
function renderStoreMap() {
  const map = el('store-map');
  map.innerHTML = '';

  Object.entries(SECTIONS_DEF).forEach(([sid, def]) => {
    const sec = G.sections[sid];
    const div = document.createElement('div');
    div.className = 'section-tile' + (sec.owned ? ' owned' : ' locked');
    div.dataset.sid = sid;
    div.style.setProperty('--sec-color', def.color);
    div.style.setProperty('--sec-border', def.borderColor);
    div.style.setProperty('--sec-text', def.textColor);
    div.style.gridArea = def.gridArea;

    if (sec.owned) {
      const capacity  = sectionCapacity(sid);
      const stockQty  = sectionStockCount(sid);
      const fillPct   = Math.min(100, Math.round(stockQty / capacity * 100));
      const nearEnd   = nearEndOfSeason() && hasSeasonalStock(sid);
      const reserveQty = sec.reserve.reduce((a, r) => a + r.qty, 0);

      div.innerHTML = `
        <div class="tile-header">
          <span class="tile-icon">${def.icon}</span>
          <span class="tile-name">${def.name}</span>
          <span class="tile-level">${'★'.repeat(sec.level)}${'☆'.repeat(3 - sec.level)}</span>
        </div>
        <div class="shelf-bar-wrap">
          <div class="shelf-bar" style="width:${fillPct}%"></div>
        </div>
        <div class="tile-stats">
          <span>📦 ${stockQty}/${capacity}</span>
          ${reserveQty > 0 ? `<span class="reserve-badge ${isSaturated(sid) ? 'saturated' : ''}">🏠 ${reserveQty}${isSaturated(sid) ? ' 🔒' : ''}</span>` : ''}
          ${nearEnd ? '<span class="warn-badge">⚠️ Fin saison</span>' : ''}
        </div>
        <div class="shelf-mini">${renderMiniShelf(sid)}</div>
      `;
    } else {
      div.innerHTML = `
        <div class="tile-header">
          <span class="tile-icon">${def.icon}</span>
          <span class="tile-name">${def.name}</span>
        </div>
        <div class="tile-locked-info">
          <span class="lock-icon">🔒</span>
          <span class="lock-cost">${fmt(def.unlockCost)}</span>
        </div>
        <div class="tile-desc">${def.description}</div>
      `;
    }

    div.addEventListener('click', () => onSectionClick(sid));
    map.appendChild(div);
  });
}

function renderMiniShelf(sid) {
  const sec = G.sections[sid];
  const capacity = sectionCapacity(sid);
  let html = '';
  let total = 0;
  const items = [];

  sec.stock.forEach(item => {
    const prod = productDef(item.productId);
    const isSeasonal = prod.seasonal && prod.seasonal.includes(season());
    const isEndSeason = nearEndOfSeason() && prod.seasonal && prod.seasonal.includes(season());
    items.push({ item, prod, isSeasonal, isEndSeason });
    total += item.qty;
  });

  // Afficher jusqu'à 12 slots visuels
  const maxShow = Math.min(12, capacity);
  let shown = 0;
  items.forEach(({ item, prod, isEndSeason }) => {
    const slots = Math.ceil(item.qty / Math.ceil(capacity / maxShow));
    for (let i = 0; i < Math.min(slots, maxShow - shown); i++) {
      const discBadge = item.discount > 0 ? `<span class="mini-disc">-${Math.round(item.discount*100)}%</span>` : '';
      const warnClass = isEndSeason && item.discount === 0 ? ' warn' : '';
      html += `<div class="mini-slot${warnClass}" title="${prod.name} (×${item.qty})${item.discount > 0 ? ' -'+Math.round(item.discount*100)+'%' : ''}">${prod.icon}${discBadge}</div>`;
      shown++;
    }
  });
  // Slots vides
  for (let i = shown; i < maxShow; i++) {
    html += `<div class="mini-slot empty"></div>`;
  }
  return html;
}

function hasSeasonalStock(sid) {
  return G.sections[sid].stock.some(item => {
    const p = productDef(item.productId);
    return p.seasonal && p.seasonal.includes(season()) && item.discount === 0;
  });
}

// ── Journal ──────────────────────────────────────────────────
function renderLog() {
  const logEl = el('log');
  logEl.innerHTML = G.log.slice(0, 30).map(entry => {
    const cls = {
      info:'log-info', buy:'log-buy', sales:'log-sales',
      warning:'log-warn', restock:'log-restock', unlock:'log-unlock',
      season:'log-season', discount:'log-discount',
    }[entry.type] || 'log-info';
    return `<div class="log-entry ${cls}"><span class="log-week">S${entry.week}</span> ${entry.msg}</div>`;
  }).join('');
}

// ── Modal section ─────────────────────────────────────────────
function onSectionClick(sid) {
  const sec = G.sections[sid];
  if (!sec.owned) {
    openUnlockModal(sid);
  } else if (G.phase === 'supplier') {
    openSupplierModal(sid);
  } else {
    openStockModal(sid);
  }
}

// Modal déverrouillage
function openUnlockModal(sid) {
  const def = sectionDef(sid);
  const canAfford = G.money >= def.unlockCost;
  showModal(`
    <h2>${def.icon} ${def.name}</h2>
    <p class="modal-desc">${def.description}</p>
    <p>Coût d'ouverture : <strong>${fmt(def.unlockCost)}</strong></p>
    <p>Votre caisse : <strong>${fmt(G.money)}</strong></p>
    <div class="modal-actions">
      <button class="btn-primary" ${canAfford ? '' : 'disabled'} onclick="doUnlock('${sid}')">
        🔓 Ouvrir ce rayon
      </button>
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
    </div>
  `);
}

function doUnlock(sid) {
  const res = unlockSection(sid);
  closeModal();
  if (!res.ok) { showToast(res.error, 'error'); return; }
  // Générer les offres fournisseur pour ce rayon immédiatement
  const products = Object.entries(CATALOG)
    .filter(([, p]) => p.section === sid)
    .map(([pid]) => pid);
  const names = SUPPLIER_NAMES[sid];
  const numSuppliers = 2 + Math.floor(Math.random() * 2);
  const offers = [];
  const usedProducts = new Set();
  for (let s = 0; s < numSuppliers; s++) {
    const supplierName = names[s % names.length];
    const numProducts = 2 + Math.floor(Math.random() * 3);
    const available = products.filter(p => !usedProducts.has(p));
    const chosen = shuffle([...available]).slice(0, Math.min(numProducts, available.length));
    chosen.forEach(pid => {
      usedProducts.add(pid);
      const base = productDef(pid).price;
      const unitPrice = Math.round(base * (0.85 + Math.random() * 0.3) * 100) / 100;
      const qty = 3 + Math.floor(Math.random() * 8);
      offers.push({ supplierName, productId: pid, qty, unitPrice });
    });
  }
  G.supplierOffers[sid] = offers;
  G.cart[sid] = [];
  renderAll();
  showToast(`${sectionDef(sid).name} ouvert ! Passez commande.`, 'success');
}

// Modal fournisseur
function openSupplierModal(sid) {
  activeSection = sid;
  modalMode = 'supplier';
  // Si rayon saturé (réserve non vide), on affiche l'info et on bloque
  if (isSaturated(sid)) {
    const def = sectionDef(sid);
    const sec = G.sections[sid];
    const reserveQty = sec.reserve.reduce((a, r) => a + r.qty, 0);
    showModal(`
      <h2>${def.icon} ${def.name} — Rayon saturé</h2>
      <div class="saturated-msg">
        <span class="sat-icon">🏠</span>
        <div>
          <strong>Réserve pleine : ${reserveQty} article(s) en attente.</strong>
          <p>Le stock en réserve n'est pas encore écoulé. Aucune nouvelle commande n'est possible pour ce rayon tant que la réserve n'est pas vide.</p>
        </div>
      </div>
      ${sec.reserve.map(r => {
        const prod = productDef(r.productId);
        return `<div class="reserve-row">${prod.icon} <strong>${prod.name}</strong> ×${r.qty}</div>`;
      }).join('')}
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Fermer</button>
      </div>
    `);
    return;
  }
  renderSupplierModal(sid);
}

function renderSupplierModal(sid) {
  const def = sectionDef(sid);
  const sec = G.sections[sid];
  const offers = G.supplierOffers[sid] || [];
  const cart = G.cart[sid] || [];
  const cartTotal = cart.reduce((a, c) => a + c.qty * c.unitPrice, 0);
  const cap = sectionCapacity(sid);
  const onShelf = sectionStockCount(sid);
  const reserveQty = sec.reserve.reduce((a, r) => a + r.qty, 0);

  // Grouper offres par fournisseur
  const bySupplier = {};
  offers.forEach((o, idx) => {
    if (!bySupplier[o.supplierName]) bySupplier[o.supplierName] = [];
    bySupplier[o.supplierName].push({ ...o, idx });
  });

  const suppliersHtml = Object.entries(bySupplier).map(([name, items]) => `
    <div class="supplier-block">
      <div class="supplier-name">🚚 ${name}</div>
      ${items.map(({ productId, qty, unitPrice, idx }) => {
        const prod = productDef(productId);
        const inCart = cart.find(c => c.productId === productId);
        const sell = sellPrice(unitPrice);
        const profit = sell - unitPrice;
        const isSeasonal = prod.seasonal ? (prod.seasonal.includes(season()) ? '✅ En saison' : '❌ Hors saison') : '🔄 Toute saison';
        return `
          <div class="offer-row ${inCart ? 'in-cart' : ''}">
            <span class="offer-icon">${prod.icon}</span>
            <div class="offer-info">
              <strong>${prod.name}</strong>
              <small>${isSeasonal}</small>
            </div>
            <div class="offer-nums">
              <span class="offer-qty">×${qty}</span>
              <span class="offer-buy">Achat : ${fmt(unitPrice)}/u</span>
              <span class="offer-sell">Vente : ${fmt(sell)}/u <em>(+${fmt(profit)})</em></span>
              <span class="offer-total">Total : ${fmt(qty * unitPrice)}</span>
            </div>
            <button class="btn-add-cart ${inCart ? 'added' : ''}" onclick="toggleCartItem('${sid}', ${idx})">
              ${inCart ? '✓ Retiré du panier' : '+ Commander'}
            </button>
          </div>`;
      }).join('')}
    </div>
  `).join('');

  showModal(`
    <h2>${def.icon} ${def.name} — Commande fournisseur</h2>
    <div class="modal-stats-row">
      <span>Rayon : ${onShelf}/${cap} items</span>
      ${reserveQty > 0 ? `<span>Réserve : ${reserveQty} items</span>` : ''}
      <span>Caisse : ${fmt(G.money)}</span>
    </div>
    <div class="suppliers-list">${suppliersHtml}</div>
    <div class="cart-summary">
      <strong>🛒 Panier : ${cart.length} ligne(s) — Total : ${fmt(cartTotal)}</strong>
      ${cart.map(c => `<div class="cart-item">${productDef(c.productId).icon} ${productDef(c.productId).name} ×${c.qty} = ${fmt(c.qty * c.unitPrice)}</div>`).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">✓ Valider ce rayon</button>
    </div>
  `);
}

function toggleCartItem(sid, offerIdx) {
  const offer = G.supplierOffers[sid][offerIdx];
  const inCart = G.cart[sid].find(c => c.productId === offer.productId);
  if (inCart) {
    removeFromCart(sid, offer.productId);
  } else {
    addToCart(sid, offerIdx);
  }
  renderSupplierModal(sid);
}

// Modal stock / gestion rayon
function openStockModal(sid) {
  activeSection = sid;
  modalMode = 'stock';
  renderStockModal(sid);
}

function renderStockModal(sid) {
  const def = sectionDef(sid);
  const sec = G.sections[sid];
  const cap = sectionCapacity(sid);
  const onShelf = sectionStockCount(sid);
  const reserveQty = sec.reserve.reduce((a, r) => a + r.qty, 0);
  const upgradeLevel = sec.level < 3 ? sec.level : null;
  const upgradeCost  = upgradeLevel !== null ? def.upgradeCosts[sec.level - 1] : null;
  const canUpgrade   = upgradeCost !== null && G.money >= upgradeCost;

  const stockRows = sec.stock.length === 0
    ? `<p class="empty-stock">Aucun article en rayon.</p>`
    : sec.stock.map(item => {
        const prod = productDef(item.productId);
        const isSeasEnd = nearEndOfSeason() && prod.seasonal && prod.seasonal.includes(season());
        const discPct = Math.round(item.discount * 100);
        const sellAmt = sellPrice(item.buyPrice, item.discount);
        return `
          <div class="stock-row ${isSeasEnd && item.discount === 0 ? 'warn-row' : ''}">
            <span class="stock-icon">${prod.icon}</span>
            <div class="stock-info">
              <strong>${prod.name}</strong>
              <small>Acheté ${fmt(item.buyPrice)}/u · Prix vente ${fmt(sellAmt)}/u · Qté : ${item.qty}</small>
              ${isSeasEnd && item.discount === 0 ? '<span class="badge-warn">⚠️ Fin de saison !</span>' : ''}
              ${item.discount > 0 ? `<span class="badge-disc">🏷️ -${discPct}%</span>` : ''}
            </div>
            <div class="discount-ctrl">
              <label>Remise : <strong>${discPct}%</strong></label>
              <input type="range" min="0" max="50" step="5" value="${discPct}"
                oninput="previewDiscount(this, '${sid}', ${item.id})"
                onchange="applyDiscount('${sid}', ${item.id}, this.value)">
            </div>
          </div>`;
      }).join('');

  const reserveRows = sec.reserve.length === 0 ? '' : `
    <h3>🏠 Réserve (${reserveQty} articles)</h3>
    ${sec.reserve.map(r => {
      const prod = productDef(r.productId);
      return `<div class="reserve-row">${prod.icon} <strong>${prod.name}</strong> ×${r.qty} (acheté ${fmt(r.buyPrice)}/u)</div>`;
    }).join('')}`;

  showModal(`
    <h2>${def.icon} ${def.name} — Gestion du rayon</h2>
    <div class="modal-stats-row">
      <span>Niveau ${'★'.repeat(sec.level)}${'☆'.repeat(3-sec.level)}</span>
      <span>Rayon : ${onShelf}/${cap}</span>
      ${reserveQty > 0 ? `<span>Réserve : ${reserveQty}</span>` : ''}
    </div>
    <div class="stock-list">${stockRows}</div>
    ${reserveRows}
    <div class="modal-actions">
      ${upgradeCost !== null ? `
        <button class="btn-upgrade ${canUpgrade ? '' : 'disabled'}" onclick="doUpgrade('${sid}')">
          ⬆️ Agrandir le rayon — ${fmt(upgradeCost)}
        </button>` : '<span class="max-level">✅ Rayon au niveau maximum</span>'}
      <button class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `);
}

function previewDiscount(input, sid, itemId) {
  const pct = parseInt(input.value);
  const label = input.previousElementSibling;
  if (label) label.innerHTML = `Remise : <strong>${pct}%</strong>`;
}

function applyDiscount(sid, itemId, value) {
  setDiscount(sid, itemId, parseInt(value) / 100);
  renderStockModal(sid);
  renderStoreMap();
  renderLog();
}

function doUpgrade(sid) {
  const res = upgradeSection(sid);
  if (!res.ok) { showToast(res.error, 'error'); return; }
  closeModal();
  renderAll();
  showToast(`${sectionDef(sid).name} agrandi !`, 'success');
}

// ── Validation approvisionnement ─────────────────────────────
function doValidatePurchases() {
  const res = validatePurchases();
  if (!res.ok) { showToast(res.error, 'error'); return; }
  renderAll();
  showToast('Commandes validées ! Gérez votre magasin.', 'success');
}

// ── Fin de semaine ────────────────────────────────────────────
function doEndWeek() {
  const results = endWeek();
  renderAll();
  showResultsModal(results);
}

function showResultsModal(results) {
  let totalRevenue = 0;
  const rows = results.map(({ sectionId, items }) => {
    const secRevenue = items.reduce((a, r) => a + r.revenue, 0);
    totalRevenue += secRevenue;
    const def = sectionDef(sectionId);
    if (items.length === 0) return `
      <div class="result-section">
        <div class="result-section-header">${def.icon} ${def.name} — <em>Aucune vente</em></div>
      </div>`;
    return `
      <div class="result-section">
        <div class="result-section-header">${def.icon} ${def.name} — <strong>${fmt(secRevenue)}</strong></div>
        ${items.map(r => {
          const prod = productDef(r.productId);
          const discTxt = r.wasDiscounted ? ` <span class="disc-label">-${Math.round(r.discount*100)}%</span>` : '';
          return `<div class="result-row">${prod.icon} ${prod.name} — ${r.sold} vendu(s) × ${fmt(r.unitRevenue)}${discTxt} = <strong>${fmt(r.revenue)}</strong></div>`;
        }).join('')}
      </div>`;
  }).join('');

  showModal(`
    <h2>📊 Résultats — Semaine ${G.week - 1}</h2>
    <div class="results-total">CA total : <strong>${fmt(totalRevenue)}</strong> · Caisse : <strong>${fmt(G.money)}</strong></div>
    <div class="results-list">${rows}</div>
    <div class="modal-actions">
      <button class="btn-primary" onclick="startNextWeek()">▶ Semaine suivante</button>
    </div>
  `);
}

function startNextWeek() {
  closeModal();
  startSupplierPhase();
  renderAll();
}

// ── Helpers DOM ──────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function showModal(html) {
  const overlay = el('modal-overlay');
  const content = el('modal-content');
  content.innerHTML = html;
  overlay.classList.add('visible');
}

function closeModal() {
  el('modal-overlay').classList.remove('visible');
  activeSection = null;
  modalMode = null;
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
}

// ── Bindings globaux ─────────────────────────────────────────
function bindGlobalEvents() {
  el('btn-end-week').addEventListener('click', doEndWeek);
  el('btn-supplier').addEventListener('click', openSupplierPanel);
  el('modal-overlay').addEventListener('click', e => {
    if (e.target === el('modal-overlay')) closeModal();
  });
}

// Panneau récapitulatif fournisseur (vue globale de tous les paniers)
function openSupplierPanel() {
  const owned = ownedSections();
  const cartStatus = owned.map(sid => {
    const def = sectionDef(sid);
    const cart = G.cart[sid] || [];
    const total = cart.reduce((a, c) => a + c.qty * c.unitPrice, 0);
    const sat = isSaturated(sid);
    let statusText, rowClass;
    if (sat) {
      rowClass = 'saturated';
      statusText = '<em>🏠 Réserve pleine — commande bloquée</em>';
    } else if (cart.length > 0) {
      rowClass = 'has-items';
      statusText = `${cart.length} ligne(s) — ${fmt(total)}`;
    } else {
      rowClass = 'empty';
      statusText = '<em>⚠️ Aucune commande !</em>';
    }
    return `
      <div class="supplier-summary-row ${rowClass}">
        <span>${def.icon} ${def.name}</span>
        <span>${statusText}</span>
        <button class="btn-small" onclick="closeModal(); openSupplierModal('${sid}')">${sat ? 'Voir' : 'Modifier'}</button>
      </div>`;
  }).join('');

  // Tous les rayons non saturés doivent avoir une commande
  const allOrdered = owned.every(sid => isSaturated(sid) || (G.cart[sid] || []).length > 0);
  const grandTotal = owned.reduce((a, sid) => a + (G.cart[sid] || []).reduce((b, c) => b + c.qty * c.unitPrice, 0), 0);

  showModal(`
    <h2>🏪 Récapitulatif des commandes</h2>
    <p>Vous devez commander au moins 1 produit par rayon.</p>
    <div class="supplier-summary">${cartStatus}</div>
    <p class="grand-total">Total commandes : <strong>${fmt(grandTotal)}</strong> · Caisse : <strong>${fmt(G.money)}</strong></p>
    <div class="modal-actions">
      <button class="btn-primary ${allOrdered && grandTotal <= G.money ? '' : 'disabled'}"
        onclick="${allOrdered && grandTotal <= G.money ? 'closeModal(); doValidatePurchases()' : ''}">
        ✅ Valider toutes les commandes
      </button>
      <button class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `);
}
