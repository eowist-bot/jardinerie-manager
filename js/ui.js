// ═══════════════════════════════════════════════════════════════
//  UI — Rendu & Interactions
// ═══════════════════════════════════════════════════════════════

let activeSection = null;
let modalMode     = null;

function uiInit() { initGame(); renderAll(); bindGlobalEvents(); }

function renderAll() { renderHUD(); renderStoreMap(); renderLog(); }

// ── HUD ──────────────────────────────────────────────────────
function renderHUD() {
  el('hud-money').textContent       = fmt(G.money);
  el('hud-week').textContent        = `Semaine ${G.week}`;
  el('hud-season').textContent      = season();
  el('hud-season-week').textContent = `(${G.weekInSeason}/${WEEKS_PER_SEASON})`;
  el('hud-stock-value').textContent = fmt(totalStockValue());
  el('season-icon').textContent     = ['🌱','☀️','🍂','❄️'][G.seasonIdx];

  const phaseLabels = {
    supplier:   '🏪 Approvisionnement',
    allocation: '📤 Mise en rayon',
    market:     '🌿 Gestion du magasin',
    results:    '📊 Résultats',
  };
  el('hud-phase').textContent = phaseLabels[G.phase] || '';

  el('btn-supplier').style.display   = G.phase === 'supplier'   ? 'inline-flex' : 'none';
  el('btn-allocation').style.display = G.phase === 'allocation' ? 'inline-flex' : 'none';
  el('btn-end-week').style.display   = G.phase === 'market'     ? 'inline-flex' : 'none';
}

// ── Carte du magasin ─────────────────────────────────────────
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
      const fillPct    = total > 0 ? Math.round(used / total * 100) : 0;
      const nearEnd    = nearEndOfSeason() && hasSeasonalStock(sid);
      const reserveQty = sec.reserve.reduce((a, r) => a + r.qty, 0);
      const hasAlloc   = G.phase === 'allocation' && reserveQty > 0;
      const isPromo    = G.phase === 'supplier' && G.promoSectionId === sid;

      div.innerHTML = `
        <div class="tile-header">
          <span class="tile-icon">${def.icon}</span>
          <span class="tile-name">${def.name}</span>
          <span class="tile-slots">${used}/${total}</span>
          ${isPromo ? '<span class="promo-tile-badge">🏷️ PROMO</span>' : ''}
        </div>
        <div class="shelf-bar-wrap">
          <div class="shelf-bar" style="width:${fillPct}%"></div>
        </div>
        <div class="tile-stats">
          ${reserveQty > 0 ? `<span class="reserve-badge ${isSaturated(sid) ? 'saturated' : ''}">${hasAlloc ? '📤' : '🏠'} ${reserveQty}${isSaturated(sid) && !hasAlloc ? ' 🔒' : ''}</span>` : ''}
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

function renderMiniShelf(sid) {
  const sec        = G.sections[sid];
  const totalSlots = sectionCapacity(sid);
  let html = '', shown = 0;

  sec.stock.forEach(item => {
    if (shown >= totalSlots) return;
    const prod       = productDef(item.productId);
    const oos        = isOutOfSeason(item.productId);
    const nearEnd    = nearEndOfSeason() && prod.seasonal && prod.seasonal.includes(season());
    const hasDisc    = item.discount > 0;

    let slotClass = '';
    if (oos && !hasDisc)   slotClass = ' out-season';
    else if (oos)          slotClass = ' out-season discounted';
    else if (nearEnd && !hasDisc) slotClass = ' warn';

    const discBadge = hasDisc ? `<span class="mini-disc">-${Math.round(item.discount*100)}%</span>` : '';
    const oosBadge  = oos && !hasDisc ? `<span class="mini-oos">↓1</span>` : '';
    const tooltip   = `${prod.name} ×${item.qty}${oos ? ' · ⚠ Hors saison (-1/sem)' : ''}${hasDisc ? ` · -${Math.round(item.discount*100)}%` : ''}`;

    html += `<div class="mini-slot${slotClass}" title="${tooltip}">${prod.icon}${discBadge}${oosBadge}<span class="mini-qty">×${item.qty}</span></div>`;
    shown++;
  });
  for (let i = shown; i < totalSlots; i++) html += `<div class="mini-slot empty"></div>`;
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
  el('log').innerHTML = G.log.slice(0, 30).map(entry => {
    const cls = {
      info:'log-info', buy:'log-buy', sales:'log-sales', warning:'log-warn',
      restock:'log-restock', unlock:'log-unlock', season:'log-season',
      discount:'log-discount', decay:'log-decay',
    }[entry.type] || 'log-info';
    return `<div class="log-entry ${cls}"><span class="log-week">S${entry.week}</span> ${entry.msg}</div>`;
  }).join('');
}

// ── Routing clic section ─────────────────────────────────────
function onSectionClick(sid) {
  const sec = G.sections[sid];
  if (!sec.owned)                    openUnlockModal(sid);
  else if (G.phase === 'supplier')   openSupplierModal(sid);
  else if (G.phase === 'allocation') openAllocationModal(sid);
  else                               openStockModal(sid);
}

// ── Modal déverrouillage ─────────────────────────────────────
function openUnlockModal(sid) {
  const def = sectionDef(sid);
  showModal(`
    <h2>${def.icon} ${def.name}</h2>
    <p class="modal-desc">${def.description}</p>
    <p>Coût : <strong>${fmt(def.unlockCost)}</strong> · Caisse : <strong>${fmt(G.money)}</strong></p>
    <div class="modal-actions">
      <button class="btn-primary" ${G.money >= def.unlockCost ? '' : 'disabled'} onclick="doUnlock('${sid}')">
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
  const products = Object.keys(CATALOG).filter(pid => CATALOG[pid].section === sid && !isOutOfSeason(pid));
  const names = SUPPLIER_NAMES[sid];
  const offers = []; const used = new Set();
  for (let s = 0; s < 2 + Math.floor(Math.random() * 2); s++) {
    const supplierName = names[s % names.length];
    shuffle(products.filter(p => !used.has(p))).slice(0, 3).forEach(pid => {
      used.add(pid);
      const base = productDef(pid).price;
      const unitPrice = Math.round(base * (0.85 + Math.random() * 0.3) * 100) / 100;
      offers.push({ supplierName, productId: pid, qty: 3 + Math.floor(Math.random() * 8), unitPrice, promoRate: 0, originalPrice: unitPrice });
    });
  }
  G.supplierOffers[sid] = offers;
  G.cart[sid] = [];
  renderAll();
  showToast(`${sectionDef(sid).name} ouvert !`, 'success');
}

// ── Modal fournisseur ────────────────────────────────────────
function openSupplierModal(sid) {
  if (isSaturated(sid)) {
    const sec      = G.sections[sid];
    const def      = sectionDef(sid);
    const resTotal = sec.reserve.reduce((a, r) => a + r.qty, 0);
    showModal(`
      <h2>${def.icon} ${def.name} — Rayon saturé</h2>
      <div class="saturated-msg">
        <span class="sat-icon">🏠</span>
        <div>
          <strong>${resTotal} article(s) en réserve — commande bloquée.</strong>
          <p>Attendez que la réserve se vide avant de recomander.</p>
        </div>
      </div>
      <h3>Réserve</h3>
      ${sec.reserve.map(r => { const p = productDef(r.productId); return `<div class="reserve-row">${p.icon} <strong>${p.name}</strong> ×${r.qty}</div>`; }).join('')}
      <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Fermer</button></div>
    `);
    return;
  }
  renderSupplierModal(sid);
}

function renderSupplierModal(sid) {
  const def    = sectionDef(sid);
  const sec    = G.sections[sid];
  const offers = G.supplierOffers[sid] || [];
  const cart   = G.cart[sid] || [];
  const cartTotal = cart.reduce((a, c) => a + c.qty * c.unitPrice, 0);
  const used   = occupiedSlots(sid), total = sectionCapacity(sid), free = freeSlots(sid);
  const isPromoSection = G.promoSectionId === sid;

  const bySupplier = {};
  offers.forEach((o, idx) => {
    if (!bySupplier[o.supplierName]) bySupplier[o.supplierName] = [];
    bySupplier[o.supplierName].push({ ...o, idx });
  });

  const suppliersHtml = Object.entries(bySupplier).map(([name, items]) => `
    <div class="supplier-block">
      <div class="supplier-name">🚚 ${name}</div>
      ${items.map(({ productId, qty, unitPrice, originalPrice, promoRate, idx }) => {
        const prod    = productDef(productId);
        const inCart  = cart.find(c => c.productId === productId);
        const sell    = sellPrice(productId);
        const profit  = sell - unitPrice;
        const alreadyOn = typeOnShelf(sid, productId);
        const slotTag = alreadyOn
          ? '<span class="slot-tag existing">🔄 Réassort</span>'
          : (free > 0
              ? '<span class="slot-tag new-slot">➕ Nouveau slot</span>'
              : '<span class="slot-tag no-slot">📦 → Réserve</span>');
        const seasonLabel = prod.seasonal
          ? (prod.seasonal.includes(season()) ? '✅ En saison' : '❌ Hors saison')
          : '🔄 Toute saison';

        // Affichage prix promo
        const priceHtml = promoRate > 0
          ? `<span class="offer-buy promo">
               Achat : <strong>${fmt(unitPrice)}</strong>/u
               <s class="orig-price">${fmt(originalPrice)}</s>
             </span>
             <span class="promo-rate-badge">-${Math.round(promoRate*100)}%</span>`
          : `<span class="offer-buy">Achat : ${fmt(unitPrice)}/u</span>`;

        return `
          <div class="offer-row ${inCart ? 'in-cart' : ''} ${promoRate > 0 ? 'has-promo' : ''}">
            <span class="offer-icon">${prod.icon}</span>
            <div class="offer-info">
              <strong>${prod.name}</strong>
              <small>${seasonLabel} ${slotTag}</small>
            </div>
            <div class="offer-nums">
              <span class="offer-qty">×${qty}</span>
              ${priceHtml}
              <span class="offer-sell">Vente : ${fmt(sell)}/u <em class="profit-tag">+${fmt(profit)}</em></span>
              <span class="offer-total">Total : ${fmt(qty * unitPrice)}</span>
            </div>
            <button class="btn-add-cart ${inCart ? 'added' : ''}" onclick="toggleCartItem('${sid}', ${idx})">
              ${inCart ? '✓ Retiré' : '+ Commander'}
            </button>
          </div>`;
      }).join('')}
    </div>`).join('');

  const top3Html = renderTop3Widget(sid);

  showModal(`
    <h2>${def.icon} ${def.name} — Commande fournisseur
      ${isPromoSection ? '<span class="promo-header-badge">🏷️ SEMAINE PROMO</span>' : ''}
    </h2>
    <div class="modal-stats-row">
      <span>Slots : <strong>${used}/${total}</strong> (${free} libre${free !== 1 ? 's' : ''})</span>
      <span>Caisse : ${fmt(G.money)}</span>
    </div>
    ${top3Html}
    <div class="suppliers-list">${suppliersHtml}</div>
    <div class="cart-summary">
      <strong>🛒 Panier : ${cart.length} ligne(s) — ${fmt(cartTotal)}</strong>
      ${cart.map(c => {
        const promoTxt = c.promoRate > 0 ? ` <span class="promo-rate-badge">-${Math.round(c.promoRate*100)}%</span>` : '';
        return `<div class="cart-item">${productDef(c.productId).icon} ${productDef(c.productId).name} ×${c.qty} = ${fmt(c.qty * c.unitPrice)}${promoTxt}</div>`;
      }).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">✓ Valider ce rayon</button>
    </div>
  `);
}

function toggleCartItem(sid, offerIdx) {
  const offer = G.supplierOffers[sid][offerIdx];
  if (G.cart[sid].find(c => c.productId === offer.productId))
    removeFromCart(sid, offer.productId);
  else
    addToCart(sid, offerIdx);
  renderSupplierModal(sid);
}

// ── Modal allocation ─────────────────────────────────────────
function openAllocationModal(sid) {
  renderAllocationModal(sid);
}

function renderAllocationModal(sid) {
  const def      = sectionDef(sid);
  const sec      = G.sections[sid];
  const used     = occupiedSlots(sid);
  const total    = sectionCapacity(sid);
  const free     = freeSlots(sid);
  const reserveQty = sec.reserve.reduce((a, r) => a + r.qty, 0);

  if (sec.reserve.length === 0) {
    showModal(`
      <h2>${def.icon} ${def.name} — Mise en rayon</h2>
      <p class="empty-stock" style="padding:20px 0;text-align:center">Aucun article en réserve pour ce rayon.</p>
      <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Fermer</button></div>
    `);
    return;
  }

  const reserveRows = sec.reserve.map(r => {
    const prod    = productDef(r.productId);
    const oos     = isOutOfSeason(r.productId);
    const alreadyOn = typeOnShelf(sid, r.productId);
    const canMove  = alreadyOn || free > 0;
    const slotInfo = alreadyOn
      ? '<span class="slot-tag existing">🔄 Réassort (même slot)</span>'
      : (free > 0
          ? `<span class="slot-tag new-slot">➕ Utilise 1 slot libre (${free} dispo)</span>`
          : '<span class="slot-tag no-slot">⚠️ Plus de slot libre</span>');
    const oosTag = oos ? `<span class="badge-oos" style="font-size:0.65rem">🍂 Hors saison</span>` : '';

    return `
      <div class="alloc-row ${oos ? 'out-season' : ''}">
        <span class="stock-icon">${prod.icon}</span>
        <div class="stock-info">
          <strong>${prod.name}</strong>
          <small>×${r.qty} · achat ${fmt(r.buyPrice)}/u · vente ${fmt(sellPrice(r.productId))}/u</small>
          ${slotInfo} ${oosTag}
        </div>
        <button class="btn-alloc ${canMove ? '' : 'disabled'}"
          onclick="${canMove ? `doMoveToShelf('${sid}', '${r.productId}')` : ''}">
          ${canMove ? '▶ Mettre en rayon' : '⛔ Pas de slot'}
        </button>
      </div>`;
  }).join('');

  // Stock déjà en rayon (pour visualiser l'état)
  const shelfPreview = sec.stock.length === 0
    ? `<p class="empty-stock">Rayon vide.</p>`
    : sec.stock.map(i => {
        const p = productDef(i.productId);
        return `<div class="alloc-shelf-row">${p.icon} ${p.name} <span class="qty-chip">×${i.qty}</span></div>`;
      }).join('');

  showModal(`
    <h2>${def.icon} ${def.name} — Mise en rayon</h2>
    <div class="modal-stats-row">
      <span>Slots : ${used}/${total} · ${free} libre${free !== 1 ? 's' : ''}</span>
      <span>Réserve : ${reserveQty} article(s)</span>
    </div>

    <h3>📦 En réserve — choisissez ce que vous mettez en rayon</h3>
    <div class="alloc-list">${reserveRows}</div>

    <h3>🛍️ Déjà en rayon</h3>
    <div class="alloc-shelf">${shelfPreview}</div>

    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `);
}

function doMoveToShelf(sid, productId) {
  const res = moveToShelf(sid, productId);
  if (!res.ok) { showToast(res.error, 'error'); return; }
  renderAllocationModal(sid);
  renderStoreMap();
}

// ── Modal stock (phase marché) ───────────────────────────────
function openStockModal(sid) { renderStockModal(sid); }

function renderStockModal(sid) {
  const def      = sectionDef(sid);
  const sec      = G.sections[sid];
  const used     = occupiedSlots(sid);
  const total    = sectionCapacity(sid);
  const free     = freeSlots(sid);
  const reserveQty = sec.reserve.reduce((a, r) => a + r.qty, 0);

  const slotsViz = Array.from({ length: MAX_SLOTS }, (_, i) => {
    if (i < used)  return `<div class="slot-dot used"></div>`;
    if (i < total) return `<div class="slot-dot free"></div>`;
    return `<div class="slot-dot locked"></div>`;
  }).join('');

  const sortedStock = [...sec.stock].sort((a, b) => {
    const aOos = isOutOfSeason(a.productId) && a.discount === 0;
    const bOos = isOutOfSeason(b.productId) && b.discount === 0;
    return (bOos ? 1 : 0) - (aOos ? 1 : 0);
  });

  const stockRows = sortedStock.length === 0
    ? `<p class="empty-stock">Aucun article en rayon.</p>`
    : sortedStock.map(item => {
        const prod    = productDef(item.productId);
        const oos     = isOutOfSeason(item.productId);
        const nearEnd = nearEndOfSeason() && prod.seasonal && prod.seasonal.includes(season());
        const discPct = Math.round(item.discount * 100);
        const sellAmt = sellPrice(item.productId, item.discount);

        let rowClass = '', badge = '';
        if (oos && item.discount === 0) {
          rowClass = 'oos-row';
          badge = `<span class="badge-oos">🍂 Hors saison — perd 1 unité/semaine</span>`;
        } else if (oos) {
          rowClass = 'oos-row discounted';
          badge = `<span class="badge-oos-disc">🏷️ En solde hors saison</span>`;
        } else if (nearEnd && item.discount === 0) {
          rowClass = 'warn-row';
          badge = `<span class="badge-warn">⚠️ Fin de saison proche</span>`;
        }

        return `
          <div class="stock-row ${rowClass}">
            <span class="stock-icon">${prod.icon}</span>
            <div class="stock-info">
              <strong>${prod.name}</strong>
              <small>Acheté ~${fmt(item.buyPrice)}/u · Vente ${fmt(sellAmt)}/u · Qté : <strong>${item.qty}</strong></small>
              ${badge}
            </div>
            <div class="discount-ctrl">
              <label>Remise : <strong>${discPct}%</strong></label>
              <input type="range" min="0" max="50" step="5" value="${discPct}"
                oninput="previewDiscount(this)"
                onchange="applyDiscount('${sid}', ${item.id}, this.value)">
            </div>
          </div>`;
      }).join('');

  const reserveSection = sec.reserve.length === 0
    ? `<div class="reserve-section empty-reserve"><div class="reserve-header">🏠 Réserve</div><p class="empty-stock">Vide.</p></div>`
    : `<div class="reserve-section">
        <div class="reserve-header">🏠 Réserve — ${reserveQty} article(s)
          <span class="reserve-note">Réassort auto en début de semaine</span>
        </div>
        ${sec.reserve.map(r => {
          const prod = productDef(r.productId);
          const oos  = isOutOfSeason(r.productId);
          const on   = typeOnShelf(sid, r.productId);
          const tag  = on
            ? '<span class="slot-tag existing">🔄 Réassort</span>'
            : (free > 0 ? '<span class="slot-tag new-slot">➕ Slot libre</span>' : '<span class="slot-tag no-slot">⏳ Attente</span>');
          return `<div class="reserve-row-detail ${oos ? 'out-season' : ''}">
            <span class="stock-icon">${prod.icon}</span>
            <div class="stock-info">
              <strong>${prod.name}</strong>
              <small>×${r.qty} · achat ${fmt(r.buyPrice)}/u · vente ${fmt(sellPrice(r.productId))}/u</small>
              ${tag}${oos ? '<span class="badge-oos" style="font-size:0.65rem">🍂 Hors saison</span>' : ''}
            </div>
          </div>`;
        }).join('')}
       </div>`;

  const canBuyMore = total < MAX_SLOTS;
  const nextCost   = canBuyMore ? nextSlotCost(sid) : null;
  const slotBtn    = canBuyMore
    ? `<button class="btn-upgrade ${G.money >= nextCost ? '' : 'disabled'}" onclick="doBuySlot('${sid}')">
         📐 Acheter un slot — ${fmt(nextCost)} (${total + 1}/${MAX_SLOTS})
       </button>`
    : `<span class="max-level">✅ Max slots atteint</span>`;

  showModal(`
    <h2>${def.icon} ${def.name} — Gestion</h2>
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
    <h3>📦 En rayon</h3>
    <div class="stock-list">${stockRows}</div>
    ${reserveSection}
    <div class="modal-actions">
      ${slotBtn}
      <button class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `);
}

function previewDiscount(input) {
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
}

// ── Widget Top 3 ventes ──────────────────────────────────────
function renderTop3Widget(filterSectionId = null) {
  if (G.salesHistory.length === 0) return '';
  const top = getTopSales(3, 4);
  if (top.length === 0) return '';

  const trendIcon = (productId) => {
    const t = getSalesTrend(productId);
    return { up:'↑', stable:'→', down:'↓', new:'🆕', declining:'⚠️', absent:'·' }[t] || '·';
  };
  const trendClass = (productId) => {
    const t = getSalesTrend(productId);
    return { up:'trend-up', stable:'trend-stable', down:'trend-down', new:'trend-new', declining:'trend-declining' }[t] || '';
  };

  const rows = top.map((s, i) => {
    const prod = productDef(s.productId);
    const icon = trendIcon(s.productId);
    const cls  = trendClass(s.productId);
    return `<div class="top3-row">
      <span class="top3-rank">${i + 1}</span>
      <span class="top3-icon">${prod.icon}</span>
      <span class="top3-name">${prod.name}</span>
      <span class="top3-revenue">${fmt(s.revenue)}</span>
      <span class="top3-trend ${cls}">${icon}</span>
    </div>`;
  }).join('');

  return `<div class="top3-widget">
    <div class="top3-title">🏆 Top ventes (4 sem.)</div>
    ${rows}
  </div>`;
}

// ── Validation approvisionnement ─────────────────────────────
function doValidatePurchases() {
  const res = validatePurchases();
  if (!res.ok) { showToast(res.error, 'error'); return; }
  renderAll();
  showToast('Commandes validées ! Mettez vos articles en rayon.', 'success');
}

// ── Fin de semaine ────────────────────────────────────────────
function doEndWeek() {
  showResultsModal(endWeek());
  renderAll();
}

function showResultsModal(results) {
  let totalRevenue = 0;
  const rows = results.map(({ sectionId, items }) => {
    const rev = items.reduce((a, r) => a + r.revenue, 0);
    totalRevenue += rev;
    const def = sectionDef(sectionId);
    if (!items.length) return `<div class="result-section"><div class="result-section-header">${def.icon} ${def.name} — <em>Aucune vente</em></div></div>`;
    return `
      <div class="result-section">
        <div class="result-section-header">${def.icon} ${def.name} — <strong>${fmt(rev)}</strong></div>
        ${items.map(r => {
          const prod = productDef(r.productId);
          const disc = r.wasDiscounted ? ` <span class="disc-label">-${Math.round(r.discount*100)}%</span>` : '';
          return `<div class="result-row">${prod.icon} ${prod.name} — ${r.sold}× ${fmt(r.unitRevenue)}${disc} = <strong>${fmt(r.revenue)}</strong></div>`;
        }).join('')}
      </div>`;
  }).join('');

  const top3Html = renderTop3Widget();

  showModal(`
    <h2>📊 Résultats — Semaine ${G.week - 1}</h2>
    <div class="results-total">CA total : <strong>${fmt(totalRevenue)}</strong> · Caisse : <strong>${fmt(G.money)}</strong></div>
    ${top3Html}
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

// ── Modal réserve globale ────────────────────────────────────
function openReserveModal() {
  const owned = ownedSections().filter(sid => G.sections[sid].reserve.length > 0);
  const total = owned.reduce((a, sid) => a + G.sections[sid].reserve.reduce((b, r) => b + r.qty, 0), 0);

  if (!owned.length) {
    showModal(`<h2>📦 Réserve globale</h2><p class="empty-stock" style="text-align:center;padding:24px">🎉 Réserve vide !</p>
      <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Fermer</button></div>`);
    return;
  }

  const html = owned.map(sid => {
    const def = sectionDef(sid);
    const sec = G.sections[sid];
    const f   = freeSlots(sid), u = occupiedSlots(sid), t = sectionCapacity(sid);
    return `
      <div class="reserve-section" style="margin-bottom:10px">
        <div class="reserve-header">${def.icon} ${def.name}
          <span class="reserve-note">${u}/${t} slots · ${f} libre${f !== 1 ? 's' : ''}</span>
        </div>
        ${sec.reserve.map(r => {
          const prod = productDef(r.productId);
          const oos  = isOutOfSeason(r.productId);
          const on   = typeOnShelf(sid, r.productId);
          const tag  = on ? '<span class="slot-tag existing">🔄</span>'
            : (f > 0 ? '<span class="slot-tag new-slot">➕</span>' : '<span class="slot-tag no-slot">⏳</span>');
          return `<div class="reserve-row-detail ${oos ? 'out-season' : ''}">
            <span class="stock-icon">${prod.icon}</span>
            <div class="stock-info">
              <strong>${prod.name}</strong>
              <small>×${r.qty} · ${fmt(r.buyPrice)}/u · vente ${fmt(sellPrice(r.productId))}/u</small>
              ${tag}${oos ? '<span class="badge-oos" style="font-size:0.65rem;margin-left:4px">🍂 Hors saison</span>' : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }).join('');

  showModal(`
    <h2>📦 Réserve globale — ${total} article(s)</h2>
    <p style="font-size:0.82rem;color:var(--text-dim);margin-bottom:14px">Réassort automatique au début de chaque semaine.</p>
    ${html}
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Fermer</button></div>
  `);
}

// ── Panneau récapitulatif commandes ──────────────────────────
function openSupplierPanel() {
  const owned = ownedSections();
  const cartStatus = owned.map(sid => {
    const def  = sectionDef(sid);
    const cart = G.cart[sid] || [];
    const tot  = cart.reduce((a, c) => a + c.qty * c.unitPrice, 0);
    const sat  = isSaturated(sid);
    let statusText, rowClass;
    if (sat)           { rowClass = 'saturated'; statusText = '<em>🏠 Réserve pleine</em>'; }
    else if (cart.length > 0) { rowClass = 'has-items';  statusText = `${cart.length} ligne(s) — ${fmt(tot)}`; }
    else               { rowClass = 'empty';     statusText = '<em>⚠️ Aucune commande</em>'; }
    const hasPromo = cart.some(c => c.promoRate > 0);
    return `
      <div class="supplier-summary-row ${rowClass}">
        <span>${def.icon} ${def.name}${hasPromo ? ' <span class="promo-rate-badge" style="font-size:0.65rem">PROMO</span>' : ''}</span>
        <span>${statusText}</span>
        <button class="btn-small" onclick="closeModal(); openSupplierModal('${sid}')">${sat ? 'Voir' : 'Modifier'}</button>
      </div>`;
  }).join('');

  const allOrdered = owned.every(sid => isSaturated(sid) || (G.cart[sid] || []).length > 0);
  const grandTotal = owned.reduce((a, sid) => a + (G.cart[sid] || []).reduce((b, c) => b + c.qty * c.unitPrice, 0), 0);

  showModal(`
    <h2>🏪 Récapitulatif des commandes</h2>
    ${renderTop3Widget()}
    <div class="supplier-summary">${cartStatus}</div>
    <p class="grand-total">Total : <strong>${fmt(grandTotal)}</strong> · Caisse : <strong>${fmt(G.money)}</strong></p>
    <div class="modal-actions">
      <button class="btn-primary ${allOrdered && grandTotal <= G.money ? '' : 'disabled'}"
        onclick="${allOrdered && grandTotal <= G.money ? 'closeModal(); doValidatePurchases()' : ''}">
        ✅ Valider (→ tout part en réserve)
      </button>
      <button class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `);
}

// ── Helpers DOM ──────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function showModal(html) {
  el('modal-content').innerHTML = html;
  el('modal-overlay').classList.add('visible');
}
function closeModal() {
  el('modal-overlay').classList.remove('visible');
  activeSection = null; modalMode = null;
}
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
}

function bindGlobalEvents() {
  el('btn-end-week').addEventListener('click', doEndWeek);
  el('btn-supplier').addEventListener('click', openSupplierPanel);
  el('btn-allocation').addEventListener('click', () => {
    showModal(`
      <h2>📤 Mise en rayon</h2>
      <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:14px">
        Cliquez sur un rayon de la carte pour choisir ce que vous y mettez.
        Laissez en réserve ce que vous ne souhaitez pas exposer encore.
      </p>
      <div class="modal-actions">
        <button class="btn-primary" onclick="closeModal(); doConfirmAllocation()">🏪 Ouvrir le magasin</button>
        <button class="btn-secondary" onclick="closeModal()">Continuer à allouer</button>
      </div>
    `);
  });
  el('btn-reserve').addEventListener('click', openReserveModal);
  el('modal-overlay').addEventListener('click', e => {
    if (e.target === el('modal-overlay')) closeModal();
  });
}

function doConfirmAllocation() {
  confirmAllocation();
  renderAll();
  showToast('Magasin ouvert ! Gérez vos promotions.', 'success');
}
