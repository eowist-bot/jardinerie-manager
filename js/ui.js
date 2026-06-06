// ═══════════════════════════════════════════════════════════════
//  UI — Rendu & Interactions
// ═══════════════════════════════════════════════════════════════

let activeSection = null;
let modalMode     = null;

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

// ── HUD ──────────────────────────────────────────────────────
function renderHUD() {
  el('hud-money').textContent       = fmt(G.money);
  el('hud-week').textContent        = `Semaine ${G.week}`;
  el('hud-season').textContent      = season();
  el('hud-season-week').textContent = `(${G.weekInSeason}/${WEEKS_PER_SEASON})`;
  el('hud-stock-value').textContent = fmt(totalStockValue());
  el('season-icon').textContent     = ['🌱','☀️','🍂','❄️'][G.seasonIdx];

  const phases = { supplier:'🏪 Approvisionnement', market:'🌿 Gestion du magasin', results:'📊 Résultats' };
  el('hud-phase').textContent = phases[G.phase] || '';

  el('btn-end-week').style.display = G.phase === 'market'   ? 'inline-flex' : 'none';
  el('btn-supplier').style.display = G.phase === 'supplier' ? 'inline-flex' : 'none';
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
    div.style.setProperty('--sec-color',  def.color);
    div.style.setProperty('--sec-border', def.borderColor);
    div.style.setProperty('--sec-text',   def.textColor);
    div.style.gridArea = def.gridArea;

    if (sec.owned) {
      const used       = occupiedSlots(sid);
      const total      = sectionCapacity(sid);
      const fillPct    = Math.round(used / total * 100);
      const nearEnd    = nearEndOfSeason() && hasSeasonalStock(sid);
      const reserveQty = sec.reserve.reduce((a, r) => a + r.qty, 0);

      div.innerHTML = `
        <div class="tile-header">
          <span class="tile-icon">${def.icon}</span>
          <span class="tile-name">${def.name}</span>
          <span class="tile-slots">${used}/${total} 🪣</span>
        </div>
        <div class="shelf-bar-wrap">
          <div class="shelf-bar" style="width:${fillPct}%"></div>
        </div>
        <div class="tile-stats">
          ${reserveQty > 0 ? `<span class="reserve-badge ${isSaturated(sid) ? 'saturated' : ''}">🏠 ${reserveQty}${isSaturated(sid) ? ' 🔒' : ''}</span>` : ''}
          ${nearEnd ? '<span class="warn-badge">⚠️ Fin saison</span>' : ''}
        </div>
        <div class="shelf-mini">${renderMiniShelf(sid)}</div>`;
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
        <div class="tile-desc">${def.description}</div>`;
    }

    div.addEventListener('click', () => onSectionClick(sid));
    map.appendChild(div);
  });
}

// Mini-étagère : exactement `sec.slots` cases, 1 case = 1 type de produit
function renderMiniShelf(sid) {
  const sec        = G.sections[sid];
  const totalSlots = sectionCapacity(sid);
  let html  = '';
  let shown = 0;

  sec.stock.forEach(item => {
    if (shown >= totalSlots) return;
    const prod       = productDef(item.productId);
    const oos        = isOutOfSeason(item.productId);
    const nearEnd    = nearEndOfSeason() && prod.seasonal && prod.seasonal.includes(season());
    const hasDisc    = item.discount > 0;

    // Priorité des classes : hors-saison > fin de saison > normal
    let slotClass = '';
    if (oos && !hasDisc)    slotClass = ' out-season';
    else if (oos && hasDisc) slotClass = ' out-season discounted';
    else if (nearEnd && !hasDisc) slotClass = ' warn';

    const discBadge = hasDisc
      ? `<span class="mini-disc">-${Math.round(item.discount * 100)}%</span>` : '';
    const oosBadge = oos && !hasDisc
      ? `<span class="mini-oos">↓1</span>` : '';   // indicateur -1/semaine
    const tooltip = `${prod.name} ×${item.qty}`
      + (oos ? ' · ⚠ Hors saison (-1/sem)' : '')
      + (hasDisc ? ` · -${Math.round(item.discount * 100)}%` : '');

    html += `<div class="mini-slot${slotClass}" title="${tooltip}">${prod.icon}${discBadge}${oosBadge}<span class="mini-qty">×${item.qty}</span></div>`;
    shown++;
  });

  for (let i = shown; i < totalSlots; i++) {
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
    const cls = { info:'log-info', buy:'log-buy', sales:'log-sales', warning:'log-warn',
      restock:'log-restock', unlock:'log-unlock', season:'log-season', discount:'log-discount',
      decay:'log-decay',
    }[entry.type] || 'log-info';
    return `<div class="log-entry ${cls}"><span class="log-week">S${entry.week}</span> ${entry.msg}</div>`;
  }).join('');
}

// ── Routing clic section ─────────────────────────────────────
function onSectionClick(sid) {
  const sec = G.sections[sid];
  if (!sec.owned)               openUnlockModal(sid);
  else if (G.phase === 'supplier') openSupplierModal(sid);
  else                          openStockModal(sid);
}

// ── Modal déverrouillage ─────────────────────────────────────
function openUnlockModal(sid) {
  const def       = sectionDef(sid);
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
  // Générer offres fournisseur pour le nouveau rayon
  const products     = Object.entries(CATALOG).filter(([, p]) => p.section === sid).map(([pid]) => pid);
  const names        = SUPPLIER_NAMES[sid];
  const numSuppliers = 2 + Math.floor(Math.random() * 2);
  const offers       = [];
  const usedProducts = new Set();
  for (let s = 0; s < numSuppliers; s++) {
    const supplierName = names[s % names.length];
    const available    = products.filter(p => !usedProducts.has(p));
    shuffle([...available]).slice(0, Math.min(2 + Math.floor(Math.random() * 3), available.length)).forEach(pid => {
      usedProducts.add(pid);
      const base      = productDef(pid).price;
      const unitPrice = Math.round(base * (0.85 + Math.random() * 0.3) * 100) / 100;
      offers.push({ supplierName, productId: pid, qty: 3 + Math.floor(Math.random() * 8), unitPrice });
    });
  }
  G.supplierOffers[sid] = offers;
  G.cart[sid] = [];
  renderAll();
  showToast(`${sectionDef(sid).name} ouvert ! Passez commande.`, 'success');
}

// ── Modal fournisseur ────────────────────────────────────────
function openSupplierModal(sid) {
  activeSection = sid;
  modalMode     = 'supplier';

  if (isSaturated(sid)) {
    const def      = sectionDef(sid);
    const sec      = G.sections[sid];
    const resTotal = sec.reserve.reduce((a, r) => a + r.qty, 0);
    showModal(`
      <h2>${def.icon} ${def.name} — Rayon saturé</h2>
      <div class="saturated-msg">
        <span class="sat-icon">🏠</span>
        <div>
          <strong>Réserve non vide : ${resTotal} article(s) en attente.</strong>
          <p>Les emplacements sont tous occupés et la réserve déborde encore.
          Aucune nouvelle commande n'est possible tant que la réserve ne se vide pas.</p>
        </div>
      </div>
      <h3>Contenu de la réserve</h3>
      ${sec.reserve.map(r => {
        const prod = productDef(r.productId);
        return `<div class="reserve-row">${prod.icon} <strong>${prod.name}</strong> ×${r.qty} · acheté ${fmt(r.buyPrice)}/u</div>`;
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
  const def      = sectionDef(sid);
  const sec      = G.sections[sid];
  const offers   = G.supplierOffers[sid] || [];
  const cart     = G.cart[sid] || [];
  const cartTotal = cart.reduce((a, c) => a + c.qty * c.unitPrice, 0);
  const used     = occupiedSlots(sid);
  const total    = sectionCapacity(sid);
  const free     = freeSlots(sid);

  const bySupplier = {};
  offers.forEach((o, idx) => {
    if (!bySupplier[o.supplierName]) bySupplier[o.supplierName] = [];
    bySupplier[o.supplierName].push({ ...o, idx });
  });

  const suppliersHtml = Object.entries(bySupplier).map(([name, items]) => `
    <div class="supplier-block">
      <div class="supplier-name">🚚 ${name}</div>
      ${items.map(({ productId, qty, unitPrice, idx }) => {
        const prod      = productDef(productId);
        const inCart    = cart.find(c => c.productId === productId);
        const sell      = sellPrice(unitPrice);
        const profit    = sell - unitPrice;
        const alreadyOn = typeOnShelf(sid, productId);
        const needSlot  = !alreadyOn;
        const slotLabel = alreadyOn
          ? '<span class="slot-tag existing">🔄 Réassort</span>'
          : (free > 0
              ? '<span class="slot-tag new-slot">➕ Nouveau slot</span>'
              : '<span class="slot-tag no-slot">📦 → Réserve</span>');
        const seasonLabel = prod.seasonal
          ? (prod.seasonal.includes(season()) ? '✅ En saison' : '❌ Hors saison')
          : '🔄 Toute saison';
        return `
          <div class="offer-row ${inCart ? 'in-cart' : ''}">
            <span class="offer-icon">${prod.icon}</span>
            <div class="offer-info">
              <strong>${prod.name}</strong>
              <small>${seasonLabel} ${slotLabel}</small>
            </div>
            <div class="offer-nums">
              <span class="offer-qty">×${qty}</span>
              <span class="offer-buy">Achat : ${fmt(unitPrice)}/u</span>
              <span class="offer-sell">Vente : ${fmt(sell)}/u <em>(+${fmt(profit)})</em></span>
              <span class="offer-total">Total : ${fmt(qty * unitPrice)}</span>
            </div>
            <button class="btn-add-cart ${inCart ? 'added' : ''}" onclick="toggleCartItem('${sid}', ${idx})">
              ${inCart ? '✓ Retiré' : '+ Commander'}
            </button>
          </div>`;
      }).join('')}
    </div>
  `).join('');

  showModal(`
    <h2>${def.icon} ${def.name} — Commande fournisseur</h2>
    <div class="modal-stats-row">
      <span>Emplacements : <strong>${used}/${total}</strong> (${free} libre${free > 1 ? 's' : ''})</span>
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
  if (inCart) removeFromCart(sid, offer.productId);
  else        addToCart(sid, offerIdx);
  renderSupplierModal(sid);
}

// ── Modal stock / gestion rayon ──────────────────────────────
function openStockModal(sid) {
  activeSection = sid;
  modalMode     = 'stock';
  renderStockModal(sid);
}

function renderStockModal(sid) {
  const def      = sectionDef(sid);
  const sec      = G.sections[sid];
  const used     = occupiedSlots(sid);
  const total    = sectionCapacity(sid);
  const free     = freeSlots(sid);
  const reserveQty = sec.reserve.reduce((a, r) => a + r.qty, 0);

  // ── Indicateur visuel des slots ──
  const slotsViz = Array.from({ length: MAX_SLOTS }, (_, i) => {
    if (i < used)  return `<div class="slot-dot used" title="Occupé"></div>`;
    if (i < total) return `<div class="slot-dot free" title="Libre"></div>`;
    return `<div class="slot-dot locked" title="Non acheté"></div>`;
  }).join('');

  // ── Rayon (stock) ──
  // Trier : hors saison sans remise en premier (urgence)
  const sortedStock = [...sec.stock].sort((a, b) => {
    const aOos = isOutOfSeason(a.productId) && a.discount === 0;
    const bOos = isOutOfSeason(b.productId) && b.discount === 0;
    return (bOos ? 1 : 0) - (aOos ? 1 : 0);
  });

  const stockRows = sortedStock.length === 0
    ? `<p class="empty-stock">Aucun article en rayon.</p>`
    : sortedStock.map(item => {
        const prod      = productDef(item.productId);
        const oos       = isOutOfSeason(item.productId);
        const isSeasEnd = nearEndOfSeason() && prod.seasonal && prod.seasonal.includes(season());
        const discPct   = Math.round(item.discount * 100);
        const sellAmt   = sellPrice(item.buyPrice, item.discount);

        let rowClass = '';
        let urgenceBadge = '';
        if (oos && item.discount === 0) {
          rowClass = 'oos-row';
          urgenceBadge = `<span class="badge-oos">🍂 Hors saison — perd 1 unité/semaine !</span>`;
        } else if (oos && item.discount > 0) {
          rowClass = 'oos-row discounted';
          urgenceBadge = `<span class="badge-oos-disc">🏷️ En solde hors saison</span>`;
        } else if (isSeasEnd && item.discount === 0) {
          rowClass = 'warn-row';
          urgenceBadge = `<span class="badge-warn">⚠️ Fin de saison proche !</span>`;
        }

        return `
          <div class="stock-row ${rowClass}">
            <span class="stock-icon">${prod.icon}</span>
            <div class="stock-info">
              <strong>${prod.name}</strong>
              <small>Acheté ${fmt(item.buyPrice)}/u · Vente ${fmt(sellAmt)}/u · Qté : <strong>${item.qty}</strong></small>
              ${urgenceBadge}
              ${item.discount > 0 && !oos ? `<span class="badge-disc">🏷️ -${discPct}%</span>` : ''}
            </div>
            <div class="discount-ctrl">
              <label>Remise : <strong>${discPct}%</strong></label>
              <input type="range" min="0" max="50" step="5" value="${discPct}"
                oninput="previewDiscount(this, '${sid}', ${item.id})"
                onchange="applyDiscount('${sid}', ${item.id}, this.value)">
            </div>
          </div>`;
      }).join('');

  // ── Réserve ──
  const reserveSection = sec.reserve.length === 0
    ? `<div class="reserve-section empty-reserve">
        <div class="reserve-header">🏠 Réserve</div>
        <p class="empty-stock">Réserve vide.</p>
       </div>`
    : `<div class="reserve-section">
        <div class="reserve-header">🏠 Réserve — ${reserveQty} article(s) en attente
          <span class="reserve-note">Sera réapprovisionné automatiquement en début de semaine</span>
        </div>
        ${sec.reserve.map(r => {
          const prod = productDef(r.productId);
          const alreadyOnShelf = typeOnShelf(sid, r.productId);
          const label = alreadyOnShelf
            ? `<span class="slot-tag existing">🔄 Type déjà en rayon</span>`
            : (free > 0
                ? `<span class="slot-tag new-slot">➕ Prendra un slot libre</span>`
                : `<span class="slot-tag no-slot">⏳ Attente slot libre</span>`);
          return `
            <div class="reserve-row-detail">
              <span class="stock-icon">${prod.icon}</span>
              <div class="stock-info">
                <strong>${prod.name}</strong>
                <small>×${r.qty} · acheté ${fmt(r.buyPrice)}/u · vente ${fmt(sellPrice(r.buyPrice))}/u</small>
                ${label}
              </div>
            </div>`;
        }).join('')}
       </div>`;

  // ── Achat de slot supplémentaire ──
  const canBuyMore = total < MAX_SLOTS;
  const nextCost   = canBuyMore ? nextSlotCost(sid) : null;
  const canAfford  = nextCost !== null && G.money >= nextCost;
  const slotBuyHtml = canBuyMore
    ? `<button class="btn-upgrade ${canAfford ? '' : 'disabled'}" onclick="doBuySlot('${sid}')">
         📐 Acheter un emplacement supplémentaire — ${fmt(nextCost)}
         <small style="display:block;font-size:0.72rem;font-weight:400;opacity:0.8">
           ${total + 1}/${MAX_SLOTS} emplacements
         </small>
       </button>`
    : `<span class="max-level">✅ Emplacements au maximum (${MAX_SLOTS}/${MAX_SLOTS})</span>`;

  showModal(`
    <h2>${def.icon} ${def.name} — Gestion du rayon</h2>

    <div class="slots-overview">
      <div class="slots-viz">${slotsViz}</div>
      <div class="slots-legend">
        <span class="slot-dot used"></span> Occupé (${used})
        &nbsp;·&nbsp;
        <span class="slot-dot free"></span> Libre (${free})
        &nbsp;·&nbsp;
        <span class="slot-dot locked"></span> Non acheté (${MAX_SLOTS - total})
      </div>
    </div>

    <h3>📦 En rayon (${used} emplacement${used > 1 ? 's' : ''} occupé${used > 1 ? 's' : ''})</h3>
    <div class="stock-list">${stockRows}</div>

    ${reserveSection}

    <div class="modal-actions">
      ${slotBuyHtml}
      <button class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `);
}

function previewDiscount(input, sid, itemId) {
  const label = input.previousElementSibling;
  if (label) label.innerHTML = `Remise : <strong>${input.value}%</strong>`;
}

function applyDiscount(sid, itemId, value) {
  setDiscount(sid, itemId, parseInt(value) / 100);
  renderStockModal(sid);
  renderStoreMap();
  renderLog();
}

function doBuySlot(sid) {
  const res = buySlot(sid);
  if (!res.ok) { showToast(res.error, 'error'); return; }
  renderStockModal(sid);
  renderStoreMap();
  renderHUD();
  renderLog();
  showToast(`Nouvel emplacement acheté ! ${sectionDef(sid).name} : ${G.sections[sid].slots}/${MAX_SLOTS}`, 'success');
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
  showResultsModal(endWeek());
  renderAll();
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
          const prod    = productDef(r.productId);
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
function el(id)     { return document.getElementById(id); }

function showModal(html) {
  el('modal-content').innerHTML = html;
  el('modal-overlay').classList.add('visible');
}

function closeModal() {
  el('modal-overlay').classList.remove('visible');
  activeSection = null;
  modalMode     = null;
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
}

// ── Modal réserve globale ────────────────────────────────────
function openReserveModal() {
  const owned = ownedSections();
  const sectionsWithReserve = owned.filter(sid => G.sections[sid].reserve.length > 0);
  const totalItems = sectionsWithReserve.reduce((a, sid) =>
    a + G.sections[sid].reserve.reduce((b, r) => b + r.qty, 0), 0);

  if (sectionsWithReserve.length === 0) {
    showModal(`
      <h2>📦 Réserve globale</h2>
      <p class="empty-stock" style="text-align:center;padding:24px 0">
        🎉 Aucun article en réserve — tous les rayons sont à jour !
      </p>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Fermer</button>
      </div>
    `);
    return;
  }

  const sectionsHtml = sectionsWithReserve.map(sid => {
    const def  = sectionDef(sid);
    const sec  = G.sections[sid];
    const used = occupiedSlots(sid);
    const tot  = sectionCapacity(sid);
    const free = freeSlots(sid);

    const items = sec.reserve.map(r => {
      const prod    = productDef(r.productId);
      const oos     = isOutOfSeason(r.productId);
      const onShelf = typeOnShelf(sid, r.productId);
      const slotTag = onShelf
        ? `<span class="slot-tag existing">🔄 Réassort</span>`
        : (free > 0
            ? `<span class="slot-tag new-slot">➕ Slot libre dispo</span>`
            : `<span class="slot-tag no-slot">⏳ Attente slot</span>`);
      const oosTag = oos
        ? `<span class="badge-oos" style="font-size:0.65rem">🍂 Hors saison</span>`
        : '';
      return `
        <div class="reserve-row-detail ${oos ? 'out-season' : ''}">
          <span class="stock-icon">${prod.icon}</span>
          <div class="stock-info">
            <strong>${prod.name}</strong>
            <small>×${r.qty} · acheté ${fmt(r.buyPrice)}/u · vente ${fmt(sellPrice(r.buyPrice))}/u</small>
            ${oosTag} ${slotTag}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="reserve-section" style="margin-bottom:10px">
        <div class="reserve-header">
          ${def.icon} ${def.name}
          <span class="reserve-note">${used}/${tot} slots · ${free} libre${free !== 1 ? 's' : ''}</span>
        </div>
        ${items}
      </div>`;
  }).join('');

  showModal(`
    <h2>📦 Réserve globale — ${totalItems} article(s)</h2>
    <p style="font-size:0.82rem;color:var(--text-dim);margin-bottom:14px">
      Les articles en réserve sont automatiquement mis en rayon en début de semaine dès qu'un slot se libère.
    </p>
    ${sectionsHtml}
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `);
}

// ── Bindings globaux ─────────────────────────────────────────
function bindGlobalEvents() {
  el('btn-end-week').addEventListener('click', doEndWeek);
  el('btn-supplier').addEventListener('click', openSupplierPanel);
  el('btn-reserve').addEventListener('click', openReserveModal);
  el('modal-overlay').addEventListener('click', e => {
    if (e.target === el('modal-overlay')) closeModal();
  });
}

// ── Panneau récapitulatif fournisseur ────────────────────────
function openSupplierPanel() {
  const owned = ownedSections();
  const cartStatus = owned.map(sid => {
    const def   = sectionDef(sid);
    const cart  = G.cart[sid] || [];
    const total = cart.reduce((a, c) => a + c.qty * c.unitPrice, 0);
    const sat   = isSaturated(sid);
    let statusText, rowClass;
    if (sat) {
      rowClass   = 'saturated';
      statusText = '<em>🏠 Réserve pleine — commande bloquée</em>';
    } else if (cart.length > 0) {
      rowClass   = 'has-items';
      statusText = `${cart.length} ligne(s) — ${fmt(total)}`;
    } else {
      rowClass   = 'empty';
      statusText = '<em>⚠️ Aucune commande !</em>';
    }
    return `
      <div class="supplier-summary-row ${rowClass}">
        <span>${def.icon} ${def.name}</span>
        <span>${statusText}</span>
        <button class="btn-small" onclick="closeModal(); openSupplierModal('${sid}')">${sat ? 'Voir' : 'Modifier'}</button>
      </div>`;
  }).join('');

  const allOrdered = owned.every(sid => isSaturated(sid) || (G.cart[sid] || []).length > 0);
  const grandTotal = owned.reduce((a, sid) => a + (G.cart[sid] || []).reduce((b, c) => b + c.qty * c.unitPrice, 0), 0);

  showModal(`
    <h2>🏪 Récapitulatif des commandes</h2>
    <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:12px">Au moins 1 produit commandé par rayon disponible.</p>
    <div class="supplier-summary">${cartStatus}</div>
    <p class="grand-total">Total : <strong>${fmt(grandTotal)}</strong> · Caisse : <strong>${fmt(G.money)}</strong></p>
    <div class="modal-actions">
      <button class="btn-primary ${allOrdered && grandTotal <= G.money ? '' : 'disabled'}"
        onclick="${allOrdered && grandTotal <= G.money ? 'closeModal(); doValidatePurchases()' : ''}">
        ✅ Valider toutes les commandes
      </button>
      <button class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `);
}
