// ═══════════════════════════════════════════════════════════════
//  UI — Rendu & Interactions
// ═══════════════════════════════════════════════════════════════

let activeSection = null;
let modalMode     = null;

// ── Init ─────────────────────────────────────────────────────
function uiInit() {
  bindGlobalEvents();
  showHomeScreen();
}

function renderAll() { renderHUD(); renderStoreMap(); renderLog(); }

// ── Audio ────────────────────────────────────────────────────
const VOLUME_KEY      = 'jardinerie_volume';
const DEFAULT_VOLUME  = 0.4;

function getMusicVolume() {
  const v = localStorage.getItem(VOLUME_KEY);
  return v !== null ? parseFloat(v) : DEFAULT_VOLUME;
}

function setMusicVolume(v) {
  v = Math.max(0, Math.min(1, v));
  localStorage.setItem(VOLUME_KEY, v);
  el('bg-music').volume = v;
  el('bg-music').muted  = v === 0;
  // Mettre à jour le label dans la modal options si elle est ouverte
  const lbl = document.getElementById('vol-lbl');
  if (lbl) lbl.textContent = Math.round(v * 100) + '%';
}

function startMusic() {
  const audio = el('bg-music');
  audio.volume = getMusicVolume();
  audio.muted  = getMusicVolume() === 0;
  // play() retourne une Promise — on ignore le reject (autoplay bloqué)
  audio.play().catch(() => {});
}

function stopMusic() {
  el('bg-music').pause();
}

// ── Écran d'accueil ──────────────────────────────────────────
function showHomeScreen() {
  el('home-screen').style.display = 'flex';
  el('app').style.display         = 'none';

  const meta = getSaveMeta();
  if (meta) {
    el('btn-continue').style.display = 'inline-flex';
    const seasons = ['🌱 Printemps','☀️ Été','🍂 Automne','❄️ Hiver'];
    const savedDate = meta.savedAt
      ? new Date(meta.savedAt).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' })
      : '';
    el('home-save-info').innerHTML =
      `<span class="home-save-chip">💾 Semaine ${meta.week} · ${seasons[meta.seasonIdx]} · ${fmt(meta.money)}${savedDate ? ` · Sauvé le ${savedDate}` : ''}</span>`;
  } else {
    el('btn-continue').style.display = 'none';
    el('home-save-info').innerHTML   = '';
  }
}

function hideHomeScreen() {
  el('home-screen').style.display = 'none';
  el('app').style.display         = 'grid';
  startMusic();
}

function doNewGame() {
  if (hasSave()) {
    showConfirmModal(
      '🆕 Nouvelle partie',
      'La sauvegarde existante sera effacée. Continuer ?',
      () => {
        deleteSave();
        closeModal();
        hideHomeScreen();
        initGame();
        renderAll();
        if (!isTutorialDone()) setTimeout(startTutorial, 400);
      }
    );
  } else {
    hideHomeScreen();
    initGame();
    renderAll();
    // Lancer le tutoriel pour les nouveaux joueurs
    if (!isTutorialDone()) {
      setTimeout(startTutorial, 400);
    }
  }
}

function doContinueGame() {
  if (!loadGame()) {
    showToast('Impossible de charger la sauvegarde.', 'error');
    return;
  }
  hideHomeScreen();
  renderAll();
  showToast('Partie chargée !', 'success');
}

// ── Options ──────────────────────────────────────────────────
function openOptionsModal() {
  const meta      = getSaveMeta();
  const savedDate = meta?.savedAt
    ? new Date(meta.savedAt).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' })
    : null;
  const saveInfo  = savedDate
    ? `<p class="options-save-info">Dernière sauvegarde : ${savedDate}</p>`
    : `<p class="options-save-info" style="color:var(--text-dim)">Aucune sauvegarde.</p>`;

  const vol    = getMusicVolume();
  const volPct = Math.round(vol * 100);

  showModal(`
    <h2>⚙️ Options</h2>

    <div class="options-section">
      <div class="options-section-title">🎵 Musique d'ambiance</div>
      <div class="volume-ctrl">
        <span class="volume-icon">${vol === 0 ? '🔇' : vol < 0.4 ? '🔈' : '🔊'}</span>
        <input type="range" id="vol-slider" class="volume-slider"
          min="0" max="100" step="5" value="${volPct}"
          oninput="applyVolumeSlider(this.value)"
          style="background:linear-gradient(to right,var(--green) ${volPct}%,var(--border) ${volPct}%)">
        <span class="volume-pct" id="vol-lbl">${volPct}%</span>
      </div>
    </div>

    <div class="options-section">
      <div class="options-section-title">💾 Sauvegarde</div>
      ${saveInfo}
      <button class="options-btn" onclick="doSaveGame()">💾 Sauvegarder la partie</button>
    </div>

    <div class="options-section">
      <div class="options-section-title">🎮 Partie</div>
      <div class="options-list">
        <button class="options-btn secondary" onclick="doGoHome()">🏠 Menu principal</button>
        <button class="options-btn danger" onclick="doNewGameFromOptions()">🆕 Nouvelle partie</button>
      </div>
      <button class="tuto-launch-btn" onclick="closeModal(); resetTutorial(); startTutorial()">🎓 Revoir le tutoriel</button>
    </div>

    <div class="modal-actions" style="margin-top:16px">
      <button class="btn-secondary" onclick="closeModal()">← Fermer</button>
    </div>
  `);
}

function applyVolumeSlider(value) {
  const pct  = parseInt(value);
  const v    = pct / 100;
  setMusicVolume(v);
  // Piste colorée
  const slider = document.getElementById('vol-slider');
  if (slider) slider.style.background =
    `linear-gradient(to right, var(--green) ${pct}%, var(--border) ${pct}%)`;
  // Icône
  const icon = document.querySelector('.volume-icon');
  if (icon) icon.textContent = v === 0 ? '🔇' : v < 0.4 ? '🔈' : '🔊';
}

function doSaveGame() {
  const ok = saveGame();
  closeModal();
  showToast(ok ? '💾 Partie sauvegardée !' : 'Erreur lors de la sauvegarde.', ok ? 'success' : 'error');
}

function doGoHome() {
  closeModal();
  stopMusic();
  showHomeScreen();
}

function doNewGameFromOptions() {
  showConfirmModal(
    '🆕 Nouvelle partie',
    'Attention : la partie en cours ne sera pas sauvegardée. Recommencer quand même ?',
    () => {
      deleteSave();
      resetTutorial();
      closeModal();
      hideHomeScreen();
      initGame();
      renderAll();
      setTimeout(startTutorial, 400);
    }
  );
}

// Modal de confirmation générique
let _confirmCallback = null;
function showConfirmModal(title, message, onConfirm) {
  _confirmCallback = onConfirm;
  showModal(`
    <h2>${title}</h2>
    <p style="margin:14px 0;color:var(--text-dim)">${message}</p>
    <div class="modal-actions">
      <button class="btn-danger" onclick="_confirmCallback && _confirmCallback()">✓ Confirmer</button>
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
    </div>
  `);
}

// ── HUD ──────────────────────────────────────────────────────
function renderHUD() {
  el('hud-money').textContent       = fmt(G.money);
  el('hud-week').textContent        = `Semaine ${G.week}`;
  el('hud-season').textContent      = season();
  el('hud-season-week').textContent = `(${G.weekInSeason}/${WEEKS_PER_SEASON})`;
  el('hud-stock-value').textContent = fmt(totalStockValue());
  el('season-icon').textContent     = ['🌱','☀️','🍂','❄️'][G.seasonIdx];

  // Météo
  const weatherChip = el('hud-weather');
  if (G.weather.current) {
    const cur  = G.weather.current;
    const nxt  = G.weather.next;
    weatherChip.style.display      = 'flex';
    el('hud-weather-icon').textContent  = cur.icon;
    el('hud-weather-label').textContent = cur.label;
    el('hud-weather-next').textContent  = nxt ? `→ ${nxt.icon} ${nxt.label}` : '';
    weatherChip.dataset.weather = cur.id;
  } else {
    weatherChip.style.display = 'none';
  }

  // Événement saisonnier
  const eventChip = el('hud-event');
  if (eventChip) {
    if (G.currentEvent) {
      eventChip.style.display = 'flex';
      eventChip.innerHTML = `<span>${G.currentEvent.icon}</span><span class="hud-event-name">${G.currentEvent.name}</span>`;
      eventChip.title = G.currentEvent.desc;
    } else if (G.nextEvent) {
      eventChip.style.display = 'flex';
      eventChip.innerHTML = `<span class="hud-event-soon">→</span><span class="hud-event-name" style="color:var(--text-dim)">${G.nextEvent.icon} ${G.nextEvent.name} (sem. prochaine)</span>`;
    } else {
      eventChip.style.display = 'none';
    }
  }

  // Réputation
  const repChip = el('hud-reputation');
  if (repChip) {
    const stars = reputationStars(G.reputation);
    repChip.innerHTML = `<span class="rep-stars">${stars}</span><span class="rep-score">${G.reputation}</span>`;
    repChip.title = `Réputation : ${G.reputation}/100`;
  }

  // Objectifs hebdomadaires (pastille)
  const objBtn = el('btn-objectives');
  if (objBtn) {
    const done = G.weeklyObjectives.filter(o => o.done).length;
    const total = G.weeklyObjectives.length;
    objBtn.innerHTML = `🎯 Objectifs <span class="obj-count ${done === total && total > 0 ? 'all-done' : ''}">${done}/${total}</span>`;
    objBtn.style.display = total > 0 ? 'inline-flex' : 'none';
  }

  // Publicité : badge actif
  const adBtn = el('btn-ad');
  if (adBtn) {
    adBtn.style.display = (G.phase === 'supplier' || G.phase === 'allocation') ? 'inline-flex' : 'none';
    if (G.adBoost) {
      adBtn.innerHTML = `📢 Pub active <span class="ad-active-badge">${sectionDef(G.adBoost.sectionId).icon}</span>`;
      adBtn.classList.add('ad-active');
    } else {
      adBtn.innerHTML = `📢 Publicité`;
      adBtn.classList.remove('ad-active');
    }
  }

  // Badges
  const badgesBtn = el('btn-badges');
  if (badgesBtn) {
    const count = G.achievements ? G.achievements.length : 0;
    const total = ACHIEVEMENTS.length;
    badgesBtn.innerHTML = `🏅 <span class="badge-count">${count}/${total}</span>`;
    badgesBtn.title = `Badges : ${count} débloqués sur ${total}`;
  }

  // Parking
  const parkingChip = el('hud-parking');
  if (parkingChip) {
    const numClients = Math.max(1, Math.round(G.parking.slots * reputationMult()));
    parkingChip.innerHTML = `<span>🅿️</span><span>${G.parking.slots} places</span><span class="parking-clients">👤 ~${numClients}</span>`;
    parkingChip.title = `Parking : ${G.parking.slots} places · ~${numClients} clients/semaine`;
  }

  const phaseLabels = {
    supplier:   '🏪 Approvisionnement',
    allocation: '📤 Mise en rayon',
    results:    '📊 Résultats',
  };
  el('hud-phase').textContent = phaseLabels[G.phase] || '';

  el('btn-supplier').style.display = G.phase === 'supplier' ? 'inline-flex' : 'none';

  // Allocation : bouton change selon l'état de la réserve
  if (G.phase === 'allocation') {
    const pending = ownedSections().reduce((a, sid) =>
      a + G.sections[sid].reserve.reduce((b, r) => b + r.qty, 0), 0);
    el('btn-allocation').style.display = 'inline-flex';
    if (pending === 0) {
      el('btn-allocation').className     = 'btn-hud primary open-store-btn';
      el('btn-allocation').innerHTML     = '🏪 Ouvrir le magasin';
    } else {
      el('btn-allocation').className = 'btn-hud secondary';
      el('btn-allocation').innerHTML =
        `📤 Mise en rayon <span class="btn-alloc-count">${pending}</span>`;
    }
  } else {
    el('btn-allocation').style.display = 'none';
  }
}

function reputationStars(rep) {
  const filled = Math.round(rep / 20); // 0-5 étoiles
  return Array.from({length:5}, (_, i) =>
    `<span class="${i < filled ? 'star-on' : 'star-off'}">★</span>`
  ).join('');
}

// ── Carte du magasin ─────────────────────────────────────────
function renderStoreMap() {
  const map = el('store-map');
  map.innerHTML = '';

  Object.entries(SECTIONS_DEF).forEach(([sid, def]) => {
    const sec = G.sections[sid];
    const div = document.createElement('div');
    div.dataset.sid = sid;
    div.style.gridArea = def.gridArea;

    if (!sec.owned) {
      div.className = 'section-tile locked';
      div.style.setProperty('--sec-border', def.borderColor);
      div.innerHTML = `
        <div class="tile-locked-compact">
          <span>${def.icon}</span>
          <span class="lock-name-compact">${def.name}</span>
          <span class="lock-cost-compact">${fmt(def.unlockCost)}</span>
        </div>`;
      div.addEventListener('click', () => onSectionClick(sid));
      map.appendChild(div);
      return;
    }

    // Section owned
    div.style.setProperty('--sec-color',  def.color);
    div.style.setProperty('--sec-border', def.borderColor);
    div.style.setProperty('--sec-text',   def.textColor);

    const used       = occupiedSlots(sid);
    const total      = sectionCapacity(sid);
    const fillPct    = total > 0 ? Math.round(used / total * 100) : 0;
    const nearEnd    = nearEndOfSeason() && hasSeasonalStock(sid);
    const reserveQty = sec.reserve.reduce((a, r) => a + r.qty, 0);
    const hasAlloc   = G.phase === 'allocation' && reserveQty > 0;
    const isPromo    = G.phase === 'supplier' && G.promoSectionId === sid;
    const canPlace   = hasAlloc && sec.reserve.some(r => typeOnShelf(sid, r.productId) || freeSlots(sid) > 0);

    div.className = 'section-tile owned'
      + (hasAlloc ? ' needs-alloc' : '')
      + (canPlace ? ' can-place' : '');

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
        ${hasAlloc
          ? `<span class="alloc-badge${canPlace ? ' actionable' : ' full'}">📦 ${reserveQty} à placer</span>`
          : (reserveQty > 0
              ? `<span class="reserve-badge ${isSaturated(sid) ? 'saturated' : ''}">🏠 ${reserveQty}</span>`
              : '')}
        ${nearEnd ? '<span class="warn-badge">⚠️ Fin saison</span>' : ''}
      </div>
      ${hasAlloc
        ? `<div class="alloc-cta">Cliquez pour allouer →</div>`
        : `<div class="shelf-mini">${renderMiniShelf(sid)}</div>`}`;

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
    const prod    = productDef(item.productId);
    const oos     = isOutOfSeason(item.productId);
    const nearEnd = nearEndOfSeason() && prod.seasonal && prod.seasonal.includes(season());
    const hasDisc = item.discount > 0;

    const isHot  = G.weeklyForecast.hot.includes(item.productId);
    const isCold = G.weeklyForecast.cold.includes(item.productId);

    let slotClass = '';
    if (oos && !hasDisc)           slotClass = ' out-season';
    else if (oos)                  slotClass = ' out-season discounted';
    else if (nearEnd && !hasDisc)  slotClass = ' warn';
    if (isHot)                     slotClass += ' trend-hot';
    else if (isCold)               slotClass += ' trend-cold';

    const discBadge = hasDisc ? `<span class="mini-disc">-${Math.round(item.discount*100)}%</span>` : '';
    const oosBadge  = oos && !hasDisc ? `<span class="mini-oos">↓1</span>` : '';
    const trendTip  = isHot ? ' · 🔥 Hausse prévue' : (isCold ? ' · ❄️ Baisse prévue' : '');
    const tooltip   = `${prod.name} ×${item.qty}${oos ? ' · ⚠ Hors saison' : ''}${hasDisc ? ` · -${Math.round(item.discount*100)}%` : ''}${trendTip}`;

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
  const visible = G.log.filter(e => !e.gazetteOnly).slice(0, 30);
  el('log').innerHTML = visible.map(entry => {
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
  const res = unlockSection(sid); // initialise cart[sid] + offres via _generateOffersForSection
  closeModal();
  if (!res.ok) { showToast(res.error, 'error'); return; }
  renderAll();
  showToast(`${sectionDef(sid).name} ouvert !`, 'success');
}

// ── Modal fournisseur ────────────────────────────────────────
function openSupplierModal(sid) {
  if (isSaturated(sid)) {
    const sec  = G.sections[sid];
    const def  = sectionDef(sid);
    const qty  = sec.reserve.reduce((a, r) => a + r.qty, 0);
    showModal(`
      <h2>${def.icon} ${def.name} — Rayon saturé</h2>
      <div class="saturated-msg">
        <span class="sat-icon">🏠</span>
        <div>
          <strong>${qty} article(s) en réserve — commande bloquée.</strong>
          <p>Attendez que la réserve se vide avant de recommander.</p>
        </div>
      </div>
      <h3>Réserve</h3>
      ${sec.reserve.map(r => {
        const p = productDef(r.productId);
        return `<div class="reserve-row">${p.icon} <strong>${p.name}</strong> ×${r.qty}</div>`;
      }).join('')}
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
      ${items.map(({ productId, maxQty, unitPrice, originalPrice, promoRate, idx }) => {
        const prod      = productDef(productId);
        const ordered   = cartQty(sid, productId);
        const sellAmt   = catalogSellPrice(productId);

        const alreadyOn = typeOnShelf(sid, productId);
        const shelfItem = sec.stock.find(s => s.productId === productId);
        const resItem   = sec.reserve.find(r => r.productId === productId);

        const slotTag = alreadyOn
          ? '<span class="slot-tag existing">🔄 Réassort</span>'
          : (free > 0
              ? '<span class="slot-tag new-slot">➕ Nouveau slot</span>'
              : '<span class="slot-tag no-slot">📦 → Réserve</span>');

        const stockInfo = [
          shelfItem ? `<span class="stock-cur shelf-cur">🛍️ Rayon: ×${shelfItem.qty}</span>` : '',
          resItem   ? `<span class="stock-cur reserve-cur">🏠 Réserve: ×${resItem.qty}</span>` : '',
        ].filter(Boolean).join(' ');

        const isHot  = G.weeklyForecast.hot.includes(productId);
        const isCold = G.weeklyForecast.cold.includes(productId);
        const forecastTag = isHot
          ? '<span class="forecast-hot">🔥 Tendance hausse</span>'
          : (isCold ? '<span class="forecast-cold">❄️ Tendance baisse</span>' : '');

        const demandInfo = G.weeklyDemand[productId];
        const demandTag  = demandInfo
          ? `<span class="demand-hint" title="Demande clients estimée cette semaine">🛒 ~${demandInfo.wanted}</span>`
          : '';

        const priceHtml = promoRate > 0
          ? `<span class="offer-buy promo">Achat : <strong>${fmt(unitPrice)}</strong>/u <s class="orig-price">${fmt(originalPrice)}</s> <span class="promo-rate-badge">-${Math.round(promoRate*100)}%</span></span>`
          : `<span class="offer-buy">Achat : ${fmt(unitPrice)}/u</span>`;

        const rowTotal = ordered > 0 ? `<span class="stepper-total">${fmt(ordered * unitPrice)}</span>` : '';

        return `
          <div class="offer-row ${ordered > 0 ? 'in-cart' : ''} ${promoRate > 0 ? 'has-promo' : ''}">
            <span class="offer-icon">${prod.icon}</span>
            <div class="offer-info">
              <strong>${prod.name}</strong> ${topBadge(productId)}${forecastTag}${demandTag}
              <small>${slotTag}</small>
              ${stockInfo ? `<div class="offer-stock-cur">${stockInfo}</div>` : ''}
            </div>
            <div class="offer-nums">
              ${priceHtml}
              <span class="offer-sell">Vente : <strong>${fmt(sellAmt)}</strong>/u</span>
              <span class="offer-max">Dispo : ${maxQty}</span>
            </div>
            <div class="stepper-wrap">
              <div class="stepper" data-sid="${sid}" data-idx="${idx}" data-max="${maxQty}">
                <button class="stepper-btn" onclick="stepperChange('${sid}',${idx},${maxQty},-1)">−</button>
                <input class="stepper-input" type="number" min="0" max="${maxQty}" value="${ordered}"
                  oninput="stepperSet('${sid}',${idx},${maxQty},this.value)"
                  onblur="stepperSet('${sid}',${idx},${maxQty},this.value)"
                  onfocus="this.select()">
                <button class="stepper-btn" onclick="stepperChange('${sid}',${idx},${maxQty},+1)">+</button>
              </div>
              <div class="stepper-total">${ordered > 0 ? fmt(ordered * unitPrice) : ''}</div>
            </div>
          </div>`;
      }).join('')}
    </div>`).join('');

  const cartHtml = cart.length === 0
    ? `<p class="empty-stock">Aucun article commandé.</p>`
    : cart.map(c => {
        const promoTxt = c.promoRate > 0 ? ` <span class="promo-rate-badge">-${Math.round(c.promoRate*100)}%</span>` : '';
        return `<div class="cart-item">${productDef(c.productId).icon} ${productDef(c.productId).name} ×${c.qty}<br><small>${fmt(c.qty * c.unitPrice)}${promoTxt}</small></div>`;
      }).join('');

  showModal(`
    <h2>${def.icon} ${def.name} — Commande fournisseur
      ${isPromoSection ? '<span class="promo-header-badge">🏷️ SEMAINE PROMO</span>' : ''}
    </h2>
    <div class="modal-stats-row">
      <span>Slots : <strong>${used}/${total}</strong> (${free} libre${free !== 1 ? 's' : ''})</span>
      <span>Caisse : ${fmt(G.money)}</span>
    </div>
    <div class="supplier-modal-body">
      <div class="suppliers-list">${suppliersHtml}</div>
      <div class="cart-panel">
        <div class="cart-panel-title">🛒 Panier</div>
        <div class="cart-panel-items">${cartHtml}</div>
        <div class="cart-panel-total">Total : <strong>${fmt(cartTotal)}</strong></div>
        <button class="btn-secondary" style="width:100%;margin-top:8px" onclick="closeModal()">✓ Valider</button>
      </div>
    </div>
  `);
}

// Stepper : +/- d'une unité
function stepperChange(sid, offerIdx, maxQty, delta) {
  const current = cartQty(sid, G.supplierOffers[sid][offerIdx].productId);
  const newQty  = Math.max(0, Math.min(maxQty, current + delta));
  addToCart(sid, offerIdx, newQty);
  _refreshSupplierModalCart(sid);
}

// Stepper : saisie directe
function stepperSet(sid, offerIdx, maxQty, rawValue) {
  const newQty = Math.max(0, Math.min(maxQty, Math.round(parseFloat(rawValue) || 0)));
  addToCart(sid, offerIdx, newQty);
  _refreshSupplierModalCart(sid);
}

// Mise à jour légère : ne re-render que le panier + les totaux de ligne, sans reconstruire la liste
function _refreshSupplierModalCart(sid) {
  const cart      = G.cart[sid] || [];
  const cartTotal = cart.reduce((a, c) => a + c.qty * c.unitPrice, 0);

  // Mettre à jour les totaux de ligne dans les steppers
  const offers = G.supplierOffers[sid] || [];
  offers.forEach((offer, idx) => {
    const stepper = document.querySelector(`.stepper[data-sid="${sid}"][data-idx="${idx}"]`);
    if (!stepper) return;
    const ordered = cartQty(sid, offer.productId);
    const inputEl = stepper.querySelector('.stepper-input');
    if (inputEl && document.activeElement !== inputEl) inputEl.value = ordered;
    // Total sous le stepper (dans .stepper-wrap)
    const wrap    = stepper.closest('.stepper-wrap');
    const totalEl = wrap?.querySelector('.stepper-total');
    if (totalEl) totalEl.textContent = ordered > 0 ? fmt(ordered * offer.unitPrice) : '';
    // Highlight de la ligne
    const row = stepper.closest('.offer-row');
    if (row) row.classList.toggle('in-cart', ordered > 0);
  });

  // Mettre à jour le panneau panier
  const cartPanel = document.querySelector('.cart-panel-items');
  if (cartPanel) {
    cartPanel.innerHTML = cart.length === 0
      ? `<p class="empty-stock">Aucun article commandé.</p>`
      : cart.map(c => {
          const promoTxt = c.promoRate > 0 ? ` <span class="promo-rate-badge">-${Math.round(c.promoRate*100)}%</span>` : '';
          return `<div class="cart-item">${productDef(c.productId).icon} ${productDef(c.productId).name} ×${c.qty}<br><small>${fmt(c.qty * c.unitPrice)}${promoTxt}</small></div>`;
        }).join('');
  }
  const totalEl = document.querySelector('.cart-panel-total');
  if (totalEl) totalEl.innerHTML = `Total : <strong>${fmt(cartTotal)}</strong>`;
}

// ── Widget tendance de la semaine ────────────────────────────
function renderWeeklyForecastWidget() {
  const { hot, cold } = G.weeklyForecast;
  if (hot.length === 0 && cold.length === 0) return '';

  // Ventes semaine précédente
  const lastWeekLine = (pid) => {
    const last = getLastWeekSales(pid);
    if (!last) return '';
    const profit = last.revenue - last.qty * (G.salesHistory.length > 0
      ? (G.salesHistory[G.salesHistory.length-1].items.find(i=>i.productId===pid)?.buyPrice || 0)
      : 0);
    return `<span class="fw-last-week">Sem. préc. : ×${last.qty} · ${fmt(last.revenue)} CA · +${fmt(Math.max(0,profit))} bén.</span>`;
  };

  const hotRows = hot.map(pid => {
    const prod = productDef(pid);
    return `<div class="fw-row fw-hot">
      <span class="fw-icon">🔥</span>
      <div class="fw-info">
        <strong>${prod.icon} ${prod.name}</strong>
        ${lastWeekLine(pid)}
      </div>
      <span class="fw-badge hot">Hausse probable</span>
    </div>`;
  }).join('');

  const coldRows = cold.map(pid => {
    const prod = productDef(pid);
    return `<div class="fw-row fw-cold">
      <span class="fw-icon">❄️</span>
      <div class="fw-info">
        <strong>${prod.icon} ${prod.name}</strong>
        ${lastWeekLine(pid)}
      </div>
      <span class="fw-badge cold">Baisse probable</span>
    </div>`;
  }).join('');

  return `<div class="forecast-widget">
    <div class="forecast-title">📈 Tendance de la semaine <span class="forecast-note">(prévisions marché)</span></div>
    <div class="forecast-grid">
      <div class="forecast-col">
        <div class="forecast-col-title">🔥 Devrait bien se vendre</div>
        ${hotRows || '<div class="fw-empty">—</div>'}
      </div>
      <div class="forecast-col">
        <div class="forecast-col-title">❄️ Devrait moins se vendre</div>
        ${coldRows || '<div class="fw-empty">—</div>'}
      </div>
    </div>
  </div>`;
}

// ── Modal allocation ─────────────────────────────────────────
function openAllocationModal(sid) { renderAllocationModal(sid); }

function renderAllocationModal(sid) {
  const def        = sectionDef(sid);
  const sec        = G.sections[sid];
  const used       = occupiedSlots(sid);
  const total      = sectionCapacity(sid);
  const free       = freeSlots(sid);
  const reserveQty = sec.reserve.reduce((a, r) => a + r.qty, 0);
  const canBuySlot = total < MAX_SLOTS && G.money >= nextSlotCost(sid);

  if (sec.reserve.length === 0) {
    showModal(`
      <h2>${def.icon} ${def.name} — Mise en rayon</h2>
      <div class="alloc-done-banner">✅ Tout est en rayon !</div>
      ${renderShelfDiscounts(sid)}
      <div class="modal-actions">
        <button class="btn-primary" onclick="openAllocationOverview()">← Retour</button>
        ${renderSlotBuyInline(sid)}
      </div>
    `);
    return;
  }

  // Réserve triée : promos en premier, puis OOS, puis normal
  const sorted = [...sec.reserve].sort((a, b) => {
    const aScore = (a.promoRate > 0 ? 100 : 0) + (isOutOfSeason(a.productId) ? -10 : 0);
    const bScore = (b.promoRate > 0 ? 100 : 0) + (isOutOfSeason(b.productId) ? -10 : 0);
    return bScore - aScore;
  });

  // Nb d'articles qui nécessitent un nouveau slot
  const needNewSlot = sorted.filter(r => !typeOnShelf(sid, r.productId)).length;
  const canPlaceAll = reserveQty > 0 && (
    sorted.every(r => typeOnShelf(sid, r.productId)) || free >= needNewSlot
  );

  const reserveRows = sorted.map(r => {
    const prod      = productDef(r.productId);
    const oos       = isOutOfSeason(r.productId);
    const alreadyOn = typeOnShelf(sid, r.productId);
    const freeDyn   = freeSlots(sid);
    const canMove   = alreadyOn || freeDyn > 0;
    const isPromo   = r.promoRate > 0;

    const slotInfo = alreadyOn
      ? '<span class="slot-tag existing">🔄 Réassort — même slot</span>'
      : (freeDyn > 0
          ? `<span class="slot-tag new-slot">➕ 1 slot libre (${freeDyn} dispo)</span>`
          : '<span class="slot-tag no-slot">⚠️ Plus de slot libre</span>');

    const oosTag   = oos     ? `<span class="badge-oos">🍂 Hors saison</span>` : '';
    const promoTag = isPromo ? `<span class="alloc-promo-tag">🏷️ PROMO -${Math.round(r.promoRate*100)}%</span>` : '';

    // Tendance : icône + libellé court sur la même ligne que le nom
    const isHot  = G.weeklyForecast.hot.includes(r.productId);
    const isCold = G.weeklyForecast.cold.includes(r.productId);
    const trendTag = isHot
      ? `<span class="alloc-trend hot">🔥 Hausse</span>`
      : (isCold ? `<span class="alloc-trend cold">❄️ Baisse</span>` : '');

    const profitPerUnit = catalogSellPrice(r.productId) - r.buyPrice;

    return `
      <div class="alloc-row ${oos ? 'out-season' : ''} ${isPromo ? 'is-promo' : ''} ${canMove ? '' : 'blocked'}">
        <div class="alloc-row-left">
          <span class="stock-icon">${prod.icon}</span>
          <div class="stock-info">
            <div class="alloc-name-row">
              <strong>${prod.name}</strong>${topBadge(r.productId)}${trendTag}${promoTag}
            </div>
            <small>achat <strong>${fmt(r.buyPrice)}/u</strong> · vente ${fmt(catalogSellPrice(r.productId))}/u
              · bén. <strong class="${profitPerUnit > 0 ? 'profit-pos' : 'profit-neg'}">${fmt(profitPerUnit)}/u</strong>
            </small>
            <div class="alloc-tags">${slotInfo}${oosTag}</div>
          </div>
        </div>
        <button class="btn-alloc-place ${canMove ? '' : 'disabled'}"
          onclick="${canMove ? `doMoveToShelf('${sid}', '${r.productId}')` : ''}">
          ${canMove ? `📤 En rayon <span class="btn-alloc-qty">×${r.qty}</span>` : '⛔ Slot plein'}
        </button>
      </div>`;
  }).join('');

  showModal(`
    <div class="alloc-modal-header">
      <div>
        <h2>${def.icon} ${def.name} — Mise en rayon</h2>
        <div class="alloc-slot-bar">
          ${Array.from({length: total}, (_, i) =>
            `<div class="slot-pip ${i < used ? 'used' : 'free'}"></div>`).join('')}
          <span class="alloc-slot-label">${used}/${total} · ${free} libre${free !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="alloc-reserve-count">
        <span class="alloc-reserve-num">${reserveQty}</span>
        <span class="alloc-reserve-label">article${reserveQty > 1 ? 's' : ''}<br>en réserve</span>
      </div>
    </div>

    ${canPlaceAll
      ? `<button class="btn-alloc-all" onclick="doMoveAllToShelf('${sid}')">📤 Tout mettre en rayon</button>`
      : `<div class="alloc-noplaceall">⚠️ Slots insuffisants pour tout placer — placez manuellement ou achetez un slot.</div>`}

    <div class="alloc-list">${reserveRows}</div>

    ${renderShelfDiscounts(sid)}

    <div class="modal-actions">
      <button class="btn-secondary" onclick="openAllocationOverview()">← Retour</button>
      ${renderSlotBuyInline(sid)}
    </div>
  `);
}

function renderShelfPreview(sid) {
  const sec = G.sections[sid];
  if (sec.stock.length === 0) return `<p class="empty-stock" style="padding:6px 0">Rayon vide pour l'instant.</p>`;
  return `<div class="alloc-shelf">${sec.stock.map(i => {
    const p = productDef(i.productId);
    return `<div class="alloc-shelf-row">${p.icon} ${p.name} <span class="qty-chip">×${i.qty}</span></div>`;
  }).join('')}</div>`;
}

// Sliders de remise pour les articles déjà en rayon
function renderShelfDiscounts(sid) {
  const sec = G.sections[sid];
  if (sec.stock.length === 0) return '';
  const rows = sec.stock.map(item => {
    const prod    = productDef(item.productId);
    const oos     = isOutOfSeason(item.productId);
    const discPct = Math.round(item.discount * 100);
    const sellAmt = sellPrice(item.productId, item.discount);
    const isHot   = G.weeklyForecast.hot.includes(item.productId);
    const isCold  = G.weeklyForecast.cold.includes(item.productId);
    const trendCls = isHot ? 'disc-trend-hot' : (isCold ? 'disc-trend-cold' : '');
    const trendTag = isHot
      ? '<span class="disc-trend-badge hot">🔥 Hausse</span>'
      : (isCold ? '<span class="disc-trend-badge cold">❄️ Baisse</span>' : '');
    return `<div class="discount-row ${oos ? 'oos-row' : ''} ${trendCls}">
      <span class="disc-row-name">${prod.icon} <strong>${prod.name}</strong>
        ${trendTag}${oos ? '<span class="badge-oos" style="font-size:0.65rem;margin-left:3px">🍂</span>' : ''}
      </span>
      <span class="disc-qty-badge">×${item.qty}</span>
      <span class="disc-sell-preview">Vente : ${fmt(sellAmt)}</span>
      <div class="discount-ctrl">
        <label>Remise : <strong id="dlbl-${item.id}">${discPct}%</strong></label>
        <input type="range" min="0" max="50" step="5" value="${discPct}"
          oninput="previewDiscountAlloc(this, '${item.id}')"
          onchange="applyDiscountAlloc('${sid}', ${item.id}, this.value)">
      </div>
    </div>`;
  }).join('');
  return `<div class="shelf-discounts">
    <div class="shelf-discounts-title">🏷️ Remises sur le rayon</div>
    ${rows}
  </div>`;
}

function renderSlotBuyInline(sid) {
  const total = sectionCapacity(sid);
  if (total >= MAX_SLOTS) return `<span class="max-level" style="margin-left:auto">✅ Max slots</span>`;
  const cost   = nextSlotCost(sid);
  const canBuy = G.money >= cost;
  return `<button class="btn-upgrade ${canBuy ? '' : 'disabled'}" style="margin-left:auto"
    onclick="${canBuy ? `doBuySlotAlloc('${sid}')` : ''}">
    📐 +1 slot — ${fmt(cost)}
  </button>`;
}

// Retourne un badge médaille si le produit est dans le Top 3 semaine précédente
function topBadge(productId) {
  if (G.week === 1 || G.top3Pids.length === 0) return '';
  const rank = G.top3Pids.indexOf(productId);
  if (rank === -1) return '';
  const medals = ['🥇', '🥈', '🥉'];
  return `<span class="top-badge top-badge-${rank + 1}" title="Top ${rank + 1} ventes sem. précédente">${medals[rank]} Top ${rank + 1}</span>`;
}

function previewDiscountAlloc(input, itemId) {
  const lbl = document.getElementById(`dlbl-${itemId}`);
  if (lbl) lbl.textContent = `${input.value}%`;
}

function applyDiscountAlloc(sid, itemId, value) {
  setDiscount(sid, itemId, parseInt(value) / 100);
  renderAllocationModal(sid);
  renderStoreMap();
}

function doBuySlotAlloc(sid) {
  const res = buySlot(sid);
  if (!res.ok) { showToast(res.error, 'error'); return; }
  renderAllocationModal(sid);
  renderStoreMap();
  renderHUD();
}

function doMoveToShelf(sid, productId) {
  const res = moveToShelf(sid, productId);
  if (!res.ok) { showToast(res.error, 'error'); return; }
  renderAllocationModal(sid);
  renderStoreMap();
  renderHUD();
}

function doMoveAllToShelf(sid) {
  const toPlace = [...G.sections[sid].reserve].map(r => r.productId);
  let placed = 0;
  toPlace.forEach(pid => {
    const res = moveToShelf(sid, pid);
    if (res.ok) placed++;
  });
  if (placed === 0) showToast('Aucun article placé (slots insuffisants)', 'error');
  renderAllocationModal(sid);
  renderStoreMap();
  renderHUD();
}

// ── Modal stock (phases autres) ──────────────────────────────
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
          badge = `<span class="badge-oos">🍂 Hors saison — perd 1/semaine</span>`;
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
        <div class="reserve-header">🏠 Réserve — ${reserveQty} article(s)</div>
        ${sec.reserve.map(r => {
          const prod = productDef(r.productId);
          const oos  = isOutOfSeason(r.productId);
          const on   = typeOnShelf(sid, r.productId);
          const tag  = on ? '<span class="slot-tag existing">🔄</span>'
            : (free > 0 ? '<span class="slot-tag new-slot">➕</span>' : '<span class="slot-tag no-slot">⏳</span>');
          return `<div class="reserve-row-detail ${oos ? 'out-season' : ''}">
            <span class="stock-icon">${prod.icon}</span>
            <div class="stock-info">
              <strong>${prod.name}</strong>
              <small>×${r.qty} · ${fmt(r.buyPrice)}/u · vente ${fmt(catalogSellPrice(r.productId))}/u</small>
              ${tag}${oos ? '<span class="badge-oos" style="font-size:0.65rem;margin-left:4px">🍂</span>' : ''}
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

// ── Validation approvisionnement ─────────────────────────────
function doValidatePurchases() {
  const res = validatePurchases();
  if (!res.ok) { showToast(res.error, 'error'); return; }
  renderAll();
  showToast('Commandes validées ! Mettez vos articles en rayon.', 'success');
}

// ── Ouvrir le magasin = fin de semaine ────────────────────────
function doOpenStore() {
  confirmAllocation();
  endWeek();
  startSupplierPhase(); // génère les objectifs de la semaine à venir
  if (G.gazette) G.gazette.nextObjectives = G.weeklyObjectives.map(o => ({ ...o }));
  renderAll();
  openGazette();
}

/* showResultsModal — supprimée en v0.7.0, remplacée par openGazette() */

function _unused_showResultsModal(results) {
  let totalRevenue = 0, totalProfit = 0;

  const sectionBlocks = results.map(({ sectionId, items, slotCost }) => {
    const rev    = items.reduce((a, r) => a + r.revenue, 0);
    const pft    = items.reduce((a, r) => a + r.profit,  0);
    const netPft = pft - (slotCost || 0);
    totalRevenue += rev;
    totalProfit  += netPft;
    const def = sectionDef(sectionId);

    const slotLine = slotCost > 0
      ? `<div class="result-slot-cost">📐 Achat slot : <span class="profit-neg">−${fmt(slotCost)}</span></div>`
      : '';

    if (!items.length) return `
      <div class="result-section result-reveal">
        <div class="result-section-header">${def.icon} ${def.name} — <em>Aucune vente</em>${slotCost > 0 ? ` · Bén. net <strong class="profit-neg">${fmt(netPft)}</strong>` : ''}</div>
        ${slotLine}
      </div>`;

    const sorted = [...items].sort((a, b) => (b.sold * b.profit) - (a.sold * a.profit));
    const pftClass = netPft >= 0 ? 'profit-pos' : 'profit-neg';
    return `
      <div class="result-section result-reveal">
        <div class="result-section-header">
          ${def.icon} ${def.name} — CA <strong>${fmt(rev)}</strong>
          · Bén. <strong class="${pftClass}">${fmt(netPft)}</strong>
          ${slotCost > 0 ? `<span class="result-slot-badge">📐 −${fmt(slotCost)}</span>` : ''}
        </div>
        ${sorted.map(r => {
          const prod    = productDef(r.productId);
          const disc    = r.wasDiscounted ? ` <span class="disc-label">-${Math.round(r.discount*100)}%</span>` : '';
          const soldOut = r.soldOut ? ` <span class="rupture-badge">💨 Rupture !</span>` : '';
          return `<div class="result-row">${prod.icon} ${prod.name} — ${r.sold}× ${fmt(r.unitRevenue)}${disc} = <strong>${fmt(r.revenue)}</strong> · bén. <span class="profit-pos">${fmt(r.profit)}</span>${soldOut}</div>`;
        }).join('')}
        ${slotLine}
      </div>`;
  });

  // Bloc objectifs
  const doneObjs   = G.weeklyObjectives.filter(o => o.done);
  const failedObjs = G.weeklyObjectives.filter(o => !o.done);
  const bonusTotal = doneObjs.reduce((s, o) => s + o.reward, 0);
  const objBlock   = G.weeklyObjectives.length > 0 ? `
    <div class="result-objectives result-reveal">
      <div class="result-obj-title">🎯 Objectifs de la semaine</div>
      ${doneObjs.map(o => `<div class="result-obj-row done">✅ ${o.desc} <span class="obj-reward-chip">+${fmt(o.reward)}</span></div>`).join('')}
      ${failedObjs.map(o => `<div class="result-obj-row failed">❌ ${o.desc}</div>`).join('')}
      ${bonusTotal > 0 ? `<div class="result-obj-bonus">🎁 Bonus reçu : <strong>+${fmt(bonusTotal)}</strong></div>` : ''}
    </div>` : '';

  // Bloc réputation
  const repStars  = reputationStars(G.reputation);
  const repBlock  = `<div class="result-reputation result-reveal">
    <span class="rep-label">⭐ Réputation</span>
    <span class="rep-stars-result">${repStars}</span>
    <span class="rep-score-result">${G.reputation}/100</span>
  </div>`;

  // Bloc demande clients — affiché en tête, toujours visible (pas de délai progressif)
  const demandEntries = Object.entries(G.weeklyDemand).sort((a, b) => b[1].wanted - a[1].wanted);
  let demandBlock = '';
  if (demandEntries.length > 0) {
    const totalW = demandEntries.reduce((s, [, d]) => s + d.wanted, 0);
    const totalS = demandEntries.reduce((s, [, d]) => s + (d.satisfied || 0), 0);
    const totalU = totalW - totalS;
    const pct = totalW > 0 ? Math.round((totalS / totalW) * 100) : 100;
    const pctClass = pct >= 85 ? 'demand-pct-good' : pct >= 50 ? 'demand-pct-mid' : 'demand-pct-bad';
    const rows = demandEntries.map(([pid, d]) => {
      const prod = productDef(pid);
      const sat  = d.satisfied || 0;
      const unf  = d.wanted - sat;
      const ok   = unf === 0;
      return `<div class="demand-row ${ok ? '' : 'demand-unmet'}">
        <span class="demand-prod">${prod.icon} ${prod.name}</span>
        <span class="demand-numbers">${sat}✅${unf > 0 ? ` <span class="demand-unf">${unf}❌</span>` : ''}</span>
      </div>`;
    }).join('');
    demandBlock = `
      <div class="result-demand visible">
        <div class="demand-header">
          <span class="demand-title">🛒 Besoins clients</span>
          <span class="demand-pct ${pctClass}">${pct}% comblés</span>
          <span class="demand-totals">${totalS} / ${totalW}</span>
        </div>
        <div class="demand-rows">${rows}</div>
        ${totalU > 0 ? `<div class="demand-unmet-notice">⚠️ ${totalU} besoin(s) non comblé(s) — impact négatif sur la réputation</div>` : `<div class="demand-all-ok">✅ Tous les besoins ont été satisfaits !</div>`}
      </div>`;
  }

  showModal(`
    <h2>📊 Résultats — Semaine ${G.week - 1}</h2>
    <div class="results-list" id="results-list">
      ${demandBlock}
      ${sectionBlocks.join('')}
      ${objBlock}
      ${repBlock}
    </div>
    <div class="results-total result-reveal" id="results-total-block">
      CA : <strong>${fmt(totalRevenue)}</strong>
      · Bénéfice : <strong class="profit-pos">${fmt(totalProfit)}</strong>
      · Caisse : <strong>${fmt(G.money)}</strong>
    </div>
    <div class="modal-actions result-reveal" id="results-actions-block">
      <button class="btn-primary" onclick="startNextWeek()">▶ Semaine suivante</button>
    </div>
  `);

  // Révélation progressive : sections une par une, puis CA + bouton ensemble
  const sections = document.querySelectorAll('#results-list .result-reveal');
  sections.forEach((block, i) => {
    setTimeout(() => block.classList.add('visible'), i * 1000);
  });
  const finalDelay = sections.length * 1000;
  setTimeout(() => {
    document.getElementById('results-total-block')?.classList.add('visible');
    document.getElementById('results-actions-block')?.classList.add('visible');
  }, finalDelay);
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
          const prod  = productDef(r.productId);
          const oos   = isOutOfSeason(r.productId);
          const on    = typeOnShelf(sid, r.productId);
          const tag   = on ? '<span class="slot-tag existing">🔄</span>'
            : (f > 0 ? '<span class="slot-tag new-slot">➕</span>' : '<span class="slot-tag no-slot">⏳</span>');
          const promo = r.promoRate > 0
            ? `<span class="promo-rate-badge" style="font-size:0.6rem">-${Math.round(r.promoRate*100)}%</span>` : '';
          return `<div class="reserve-row-detail ${oos ? 'out-season' : ''}">
            <span class="stock-icon">${prod.icon}</span>
            <div class="stock-info">
              <strong>${prod.name}</strong>${promo}
              <small>×${r.qty} · ${fmt(r.buyPrice)}/u · vente ${fmt(catalogSellPrice(r.productId))}/u</small>
              ${tag}${oos ? '<span class="badge-oos" style="font-size:0.65rem;margin-left:4px">🍂</span>' : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }).join('');

  showModal(`
    <h2>📦 Réserve globale — ${total} article(s)</h2>
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
    if (sat)                { rowClass = 'saturated'; statusText = '<em>🏠 Réserve pleine</em>'; }
    else if (cart.length > 0) { rowClass = 'has-items'; statusText = `${cart.length} ligne(s) — ${fmt(tot)}`; }
    else                    { rowClass = 'empty';     statusText = '<em>⚠️ Aucune commande</em>'; }
    const hasPromo = cart.some(c => c.promoRate > 0);
    return `
      <div class="supplier-summary-row ${rowClass}">
        <span>${def.icon} ${def.name}${hasPromo ? ' <span class="promo-rate-badge" style="font-size:0.65rem">PROMO</span>' : ''}</span>
        <span>${statusText}</span>
        <button class="btn-small" onclick="closeModal(); openSupplierModal('${sid}')">${sat ? 'Voir' : 'Modifier'}</button>
      </div>`;
  }).join('');

  const allOrdered  = owned.every(sid => isSaturated(sid) || (G.cart[sid] || []).length > 0);
  const grandTotal  = owned.reduce((a, sid) => a + (G.cart[sid] || []).reduce((b, c) => b + c.qty * c.unitPrice, 0), 0);

  showModal(`
    <h2>🏪 Récapitulatif des commandes</h2>
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

// ── Vue globale allocation ────────────────────────────────────
function openAllocationOverview() {
  const pending = ownedSections().reduce((a, sid) =>
    a + G.sections[sid].reserve.reduce((b, r) => b + r.qty, 0), 0);

  const owned = ownedSections();
  const withReserve    = owned.filter(sid => G.sections[sid].reserve.length > 0);
  const withoutReserve = owned.filter(sid => G.sections[sid].reserve.length === 0);

  const pendingRows = withReserve.map(sid => {
    const def    = sectionDef(sid);
    const sec    = G.sections[sid];
    const qty    = sec.reserve.reduce((a, r) => a + r.qty, 0);
    const free   = freeSlots(sid);
    const canAny = sec.reserve.some(r => typeOnShelf(sid, r.productId) || free > 0);
    const hasPromo = sec.reserve.some(r => r.promoRate > 0);
    return `
      <div class="alloc-overview-row ${canAny ? '' : 'blocked'}">
        <span class="alloc-ov-icon">${def.icon}</span>
        <div class="alloc-ov-info">
          <strong>${def.name}${hasPromo ? ' <span class="promo-rate-badge" style="font-size:0.6rem">PROMO</span>' : ''}</strong>
          <small>${qty} article${qty>1?'s':''} en réserve · ${free} slot${free!==1?'s':''} libre${free!==1?'s':''}</small>
        </div>
        <button class="btn-alloc-go ${canAny ? '' : 'full'}"
          onclick="closeModal(); openAllocationModal('${sid}')">
          ${canAny ? '📤 Allouer →' : '🔒 Complet — +slot ?'}
        </button>
      </div>`;
  }).join('');

  const doneRows = withoutReserve.map(sid => {
    const def = sectionDef(sid);
    return `<div class="alloc-overview-row done"><span>${def.icon} ${def.name}</span><span class="alloc-done-check">✅</span></div>`;
  }).join('');

  // Bandeau selon l'état
  const bannerHtml = pending > 0
    ? `<div class="alloc-progress-banner">
        <strong>${pending} article${pending>1?'s':''}</strong> en attente dans ${withReserve.length} rayon${withReserve.length>1?'s':''}
       </div>`
    : `<div class="alloc-progress-banner alloc-ready">
        ✅ Tous les rayons sont prêts — vous pouvez ouvrir le magasin.
       </div>`;

  // Liste des rayons avec réserve (ou message si tout est alloué)
  const pendingSection = pending > 0
    ? `<div class="alloc-overview-list">${pendingRows}</div>`
    : '';

  // Rayons terminés
  const doneSection = withoutReserve.length > 0
    ? (pending > 0
        ? `<details>
            <summary style="font-size:0.82rem;color:var(--text-dim);cursor:pointer;margin:10px 0">
              ✅ Rayons sans réserve (${withoutReserve.length})
            </summary>
            <div class="alloc-overview-done">${doneRows}</div>
           </details>`
        : `<div class="alloc-overview-done">${doneRows}</div>`)
    : '';

  // Bouton principal : "Ouvrir" mis en avant quand tout est alloué
  const openBtn = pending === 0
    ? `<button class="btn-primary open-store-btn" onclick="closeModal(); doOpenStore()">🏪 Ouvrir le magasin</button>`
    : `<button class="btn-open-store" onclick="closeModal(); doOpenStore()">🏪 Ouvrir le magasin quand même</button>`;

  showModal(`
    <h2>📤 Mise en rayon</h2>
    <p class="modal-desc">Choisissez ce que vous exposez. Ce qui reste en réserve sera réassorti automatiquement la semaine prochaine.</p>
    ${bannerHtml}
    ${pendingSection}
    ${doneSection}
    <div class="modal-actions" style="margin-top:20px;border-top:1px solid var(--border);padding-top:14px">
      ${pending > 0 ? `<button class="btn-secondary" onclick="closeModal()">← Fermer</button>` : ''}
      ${openBtn}
    </div>
  `);
}

// ── Objectifs hebdomadaires ──────────────────────────────────
function openObjectivesModal() {
  const objs = G.weeklyObjectives;
  if (!objs || objs.length === 0) {
    showModal(`<h2>🎯 Objectifs de la semaine</h2>
      <p class="modal-desc">Aucun objectif cette semaine.</p>
      <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Fermer</button></div>`);
    return;
  }

  const rows = objs.map(obj => {
    const pct  = obj.target > 0 ? Math.min(100, Math.round((obj.current / obj.target) * 100)) : 0;
    const statusIcon = obj.done ? '✅' : (G.phase === 'results' ? '❌' : '⏳');
    const barColor   = obj.done ? 'var(--green)' : 'var(--gold)';
    return `
      <div class="obj-row ${obj.done ? 'obj-done' : ''}">
        <div class="obj-header">
          <span class="obj-status">${statusIcon}</span>
          <span class="obj-desc">${obj.desc}</span>
          <span class="obj-reward">+${fmt(obj.reward)}</span>
        </div>
        ${obj.type !== 'no_decay' ? `
        <div class="obj-progress-wrap">
          <div class="obj-progress-bar" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div class="obj-progress-label">${fmt(obj.current)} / ${fmt(obj.target)}</div>` : ''}
      </div>`;
  }).join('');

  const doneCount = objs.filter(o => o.done).length;
  const bonusTotal = objs.filter(o => o.done).reduce((s, o) => s + o.reward, 0);

  showModal(`
    <h2>🎯 Objectifs — Semaine ${G.week}</h2>
    <p class="modal-desc">Accomplissez ces objectifs pour recevoir des bonus en fin de semaine.</p>
    ${doneCount > 0 ? `<div class="obj-bonus-banner">🎉 ${doneCount} objectif${doneCount>1?'s':''} accompli${doneCount>1?'s':''} — bonus total : <strong>${fmt(bonusTotal)}</strong></div>` : ''}
    <div class="obj-list">${rows}</div>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Fermer</button></div>
  `);
}

// ── Publicité ────────────────────────────────────────────────
function openAdModal() {
  if (G.adBoost) {
    const lvl = AD_LEVELS[G.adBoost.levelIdx];
    const sid = G.adBoost.sectionId;
    showModal(`
      <h2>📢 Publicité active</h2>
      <div class="ad-active-info">
        <span class="ad-active-icon">${lvl.icon}</span>
        <div>
          <strong>${lvl.label}</strong> pour <strong>${sectionDef(sid).icon} ${sectionDef(sid).name}</strong>
          <p>Boost ventes : ×${lvl.mult} · Coût payé : ${fmt(lvl.cost)}</p>
        </div>
      </div>
      <p class="modal-desc">La publicité sera retirée automatiquement au début de la semaine suivante.</p>
      <div class="ad-cancel-box">
        <p class="ad-cancel-warn">⚠️ Vous pouvez annuler la publicité et être <strong>remboursé intégralement</strong> (${fmt(lvl.cost)}) si le magasin n'est pas encore ouvert.</p>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Garder la publicité</button>
        <button class="btn-danger" onclick="doCancelAd()">🗑️ Annuler et rembourser</button>
      </div>
    `);
    return;
  }

  const owned = ownedSections();
  const sectionSelect = owned.map(sid => {
    const def = sectionDef(sid);
    return `<option value="${sid}">${def.icon} ${def.name}</option>`;
  }).join('');

  const levelBtns = AD_LEVELS.map((lvl, idx) => {
    const canAfford = G.money >= lvl.cost;
    return `
      <div class="ad-level-card ${canAfford ? '' : 'ad-disabled'}">
        <div class="ad-level-icon">${lvl.icon}</div>
        <div class="ad-level-info">
          <strong>${lvl.label}</strong>
          <span>Boost ventes : ×${lvl.mult}</span>
          <span>Coût : <strong>${fmt(lvl.cost)}</strong></span>
        </div>
        <button class="btn-primary ${canAfford ? '' : 'disabled'}"
          onclick="${canAfford ? `doAdBoost(${idx})` : ''}">
          ${canAfford ? 'Acheter' : '💸 Insuffisant'}
        </button>
      </div>`;
  }).join('');

  showModal(`
    <h2>📢 Lancer une publicité</h2>
    <p class="modal-desc">Boostez les ventes d'un rayon pour cette semaine. Une seule pub active à la fois.</p>
    <div class="ad-section-select">
      <label>Rayon ciblé :</label>
      <select id="ad-section-select" class="ad-select">${sectionSelect}</select>
    </div>
    <div class="ad-levels">${levelBtns}</div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
    </div>
  `);
}

function doAdBoost(levelIdx) {
  const sid = document.getElementById('ad-section-select')?.value;
  if (!sid) return;
  const res = buyAdBoost(sid, levelIdx);
  closeModal();
  if (!res.ok) { showToast(res.error, 'error'); return; }
  renderHUD();
  showToast(`📢 Publicité lancée pour ${sectionDef(sid).name} !`, 'success');
}

function doCancelAd() {
  const res = cancelAdBoost();
  if (res.ok) {
    renderHUD();
    openAdModal();
    showToast(`💸 Publicité annulée — ${fmt(res.refund)} remboursé.`, 'success');
  }
}

// ── Graphique des ventes ─────────────────────────────────────
function openSalesChart() {
  if (G.salesHistory.length === 0) {
    showModal(`<h2>📈 Graphique des ventes</h2>
      <p class="modal-desc">Pas encore de données. Jouez quelques semaines !</p>
      <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Fermer</button></div>`);
    return;
  }

  const weeks  = G.salesHistory;
  const caData = weeks.map(w => w.items.reduce((s, i) => s + i.revenue, 0));
  const pfData = weeks.map(w => w.items.reduce((s, i) => s + i.revenue - i.qty * (i.buyPrice || 0), 0));
  const maxVal = Math.max(...caData, 1);

  const W = 540, H = 180, pad = 30, barW = Math.floor((W - pad * 2) / weeks.length) - 4;

  const bars = weeks.map((w, i) => {
    const x     = pad + i * ((W - pad * 2) / weeks.length);
    const caH   = Math.max(2, Math.round((caData[i] / maxVal) * (H - 20)));
    const pfH   = Math.max(0, Math.round((Math.max(0, pfData[i]) / maxVal) * (H - 20)));
    const caY   = H - caH;
    const pfY   = H - pfH;
    const sIcon = ['🌱','☀️','🍂','❄️'][w.seasonIdx];
    return `
      <rect x="${x}" y="${caY}" width="${barW}" height="${caH}" fill="#4caf50" opacity="0.6" rx="2">
        <title>S${w.week} · CA : ${fmt(caData[i])}</title>
      </rect>
      <rect x="${x}" y="${pfY}" width="${barW}" height="${pfH}" fill="#f0d080" opacity="0.8" rx="2">
        <title>S${w.week} · Bén. : ${fmt(pfData[i])}</title>
      </rect>
      <text x="${x + barW/2}" y="${H + 16}" text-anchor="middle" font-size="9" fill="#7a9a7a">${sIcon}S${w.week}</text>`;
  }).join('');

  // Lignes de grille horizontales
  const gridLines = [0.25, 0.5, 0.75, 1].map(ratio => {
    const y   = H - Math.round(ratio * (H - 20));
    const val = Math.round(maxVal * ratio);
    return `<line x1="${pad}" y1="${y}" x2="${W - pad}" y2="${y}" stroke="#2e4a2e" stroke-width="1"/>
            <text x="${pad - 4}" y="${y + 4}" text-anchor="end" font-size="9" fill="#7a9a7a">${fmt(val)}</text>`;
  }).join('');

  const svg = `<svg viewBox="0 0 ${W} ${H + 30}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-height:240px">
    ${gridLines}${bars}
    <line x1="${pad}" y1="0" x2="${pad}" y2="${H}" stroke="#2e4a2e" stroke-width="1"/>
    <line x1="${pad}" y1="${H}" x2="${W - pad}" y2="${H}" stroke="#2e4a2e" stroke-width="1"/>
  </svg>`;

  // Tableau récapitulatif
  const tableRows = weeks.map((w, i) => {
    const pf = pfData[i];
    return `<tr>
      <td>S${w.week}</td>
      <td>${['🌱 Printemps','☀️ Été','🍂 Automne','❄️ Hiver'][w.seasonIdx]}</td>
      <td class="chart-ca">${fmt(caData[i])}</td>
      <td class="${pf >= 0 ? 'profit-pos' : 'profit-neg'}">${fmt(pf)}</td>
    </tr>`;
  }).join('');

  // Objectif annuel
  const annualPct  = Math.min(100, Math.round((G.annualCA / G.annualTarget) * 100));
  const annualBar  = `<div class="annual-progress-wrap">
    <div class="annual-progress-fill" style="width:${annualPct}%"></div>
  </div>
  <div class="annual-progress-label">
    Année ${G.year} : ${fmt(G.annualCA)} / ${fmt(G.annualTarget)} (${annualPct}%)
    ${G.annualCA >= G.annualTarget ? '<span class="obj-done-badge">✅ Objectif atteint !</span>' : ''}
  </div>`;

  showModal(`
    <h2>📈 Ventes — ${weeks.length} dernière${weeks.length > 1 ? 's' : ''} semaine${weeks.length > 1 ? 's' : ''}</h2>
    <div class="chart-legend">
      <span class="legend-ca">■ CA</span>
      <span class="legend-pf">■ Bénéfice</span>
    </div>
    <div class="chart-wrap">${svg}</div>
    <h3 style="margin:14px 0 8px;font-size:0.9rem">🏆 Objectif annuel — Année ${G.year}</h3>
    ${annualBar}
    <table class="chart-table">
      <thead><tr><th>Sem.</th><th>Saison</th><th>CA</th><th>Bénéfice</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Fermer</button></div>
  `);
}

// ── Parking ──────────────────────────────────────────────────
function openParkingModal() {
  const slots      = G.parking.slots;
  const numClients = Math.max(1, Math.round(slots * reputationMult()));
  const canBuy     = G.money >= PARKING_UPGRADE_COST;

  showModal(`
    <h2>🅿️ Gestion du Parking</h2>
    <div class="parking-info">
      <div class="parking-stat">
        <span class="parking-stat-icon">🅿️</span>
        <span class="parking-stat-value">${slots}</span>
        <span class="parking-stat-label">places</span>
      </div>
      <div class="parking-stat">
        <span class="parking-stat-icon">👤</span>
        <span class="parking-stat-value">~${numClients}</span>
        <span class="parking-stat-label">clients/sem.</span>
      </div>
      <div class="parking-stat">
        <span class="parking-stat-icon">⭐</span>
        <span class="parking-stat-value">${G.reputation}</span>
        <span class="parking-stat-label">réputation</span>
      </div>
    </div>
    <p class="parking-desc">
      Chaque place de parking attire <strong>1 client</strong> par semaine.
      La réputation module ce nombre (×${reputationMult().toFixed(2)}).
      Chaque extension ajoute <strong>+10 places</strong>.
    </p>
    <div class="parking-upgrade-box ${canBuy ? '' : 'disabled'}">
      <div class="parking-upgrade-title">⬆️ Agrandir le parking</div>
      <div class="parking-upgrade-detail">+10 places · <strong>${fmt(PARKING_UPGRADE_COST)}</strong></div>
      <div class="parking-upgrade-result">→ ${slots + 10} places · ~${Math.max(1, Math.round((slots + 10) * reputationMult()))} clients</div>
      <button class="btn-primary" ${canBuy ? `onclick="doBuyParking()"` : 'disabled'}>
        ${canBuy ? `🅿️ Acheter (+10 places)` : `❌ Budget insuffisant (${fmt(G.money)} / ${fmt(PARKING_UPGRADE_COST)})`}
      </button>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `);
}

function doBuyParking() {
  const result = buyParking();
  if (result.ok) {
    renderHUD();
    openParkingModal();
    showToast('🅿️ Parking agrandi !', 'success');
  } else {
    showToast(result.error, 'error');
  }
}

// ── Helpers DOM ──────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function showModal(html) {
  el('modal-content').innerHTML = html;
  el('modal-overlay').classList.add('visible');
}
function closeModal() {
  const ov = el('modal-overlay');
  ov.classList.remove('visible', 'gazette-open');
  // Remettre les styles par défaut de #modal-content
  el('modal-content').style.cssText = '';
  activeSection = null; modalMode = null;
}
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 1000);
}

function toggleLog() {
  const sidebar  = el('sidebar');
  const mainBody = el('main-body');
  const icon     = el('log-toggle-icon');
  sidebar.classList.toggle('collapsed');
  mainBody.classList.toggle('log-hidden');
  icon.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
}

function bindGlobalEvents() {
  el('btn-supplier').addEventListener('click', openSupplierPanel);
  el('btn-allocation').addEventListener('click', openAllocationOverview);
  el('btn-reserve').addEventListener('click', openReserveModal);
  el('btn-options').addEventListener('click', openOptionsModal);
  el('btn-new-game').addEventListener('click', doNewGame);
  el('btn-continue').addEventListener('click', doContinueGame);
  el('btn-objectives')?.addEventListener('click', openObjectivesModal);
  el('btn-ad')?.addEventListener('click', openAdModal);
  el('btn-gazette')?.addEventListener('click', openGazette);
  el('btn-chart')?.addEventListener('click', openSalesChart);
  el('btn-badges')?.addEventListener('click', openBadgesModal);
  el('modal-overlay').addEventListener('click', e => {
    if (e.target === el('modal-overlay')) closeModal();
  });
}

// ── Gazette de la Centrale ────────────────────────────────────
function openGazette() {
  const g = G.gazette;
  if (!g) {
    showToast('Aucune gazette disponible — terminez d\'abord une semaine.', 'info');
    return;
  }

  const seasonIcon = ['🌱','☀️','🍂','❄️'][['Printemps','Été','Automne','Hiver'].indexOf(g.season)] || '🌿';
  const repDir  = g.reputation.delta >= 0 ? '▲' : '▼';
  const repColor= g.reputation.delta >= 0 ? '#66bb6a' : '#ef5350';
  const satPct  = g.satisfaction.pct ?? 0;
  const satColor= satPct >= 85 ? '#66bb6a' : satPct >= 65 ? '#ffa726' : '#ef5350';
  const annualPct = g.annualTarget > 0 ? Math.min(100, Math.round(g.annualCA / g.annualTarget * 100)) : 0;

  // ── COLONNE GAUCHE : résultats financiers + sections ──
  const topSec = g.sections.slice(0, 5);
  const sectionRows = topSec.map(s =>
    `<div class="gaz-sec-row">
      <span class="gaz-sec-icon">${s.icon}</span>
      <span class="gaz-sec-name">${s.name}</span>
      <span class="gaz-sec-rev">${fmt(s.revenue)}</span>
    </div>`
  ).join('');

  const noSales = g.sections.length === 0;

  // ── COLONNE DROITE : clients + objectifs ──
  const satBar = satPct !== null ? `
    <div class="gaz-sat-bar-wrap">
      <div class="gaz-sat-bar" style="width:${satPct}%; background:${satColor}"></div>
    </div>
    <div class="gaz-sat-nums">
      <span style="color:${satColor};font-weight:800">${satPct}%</span>
      <span class="gaz-dim">${g.satisfaction.satisfied}/${g.satisfaction.wanted} besoins</span>
      <span class="gaz-dim">~${g.satisfaction.numClients} clients</span>
    </div>` : `<div class="gaz-dim">Aucune demande générée.</div>`;

  const objRows = g.objectives.map(o => {
    const icon = o.done ? '✅' : '❌';
    const pct  = o.target > 0 ? Math.min(100, Math.round(o.current / o.target * 100)) : 0;
    return `<div class="gaz-obj-row ${o.done ? 'done' : 'miss'}">
      <span>${icon}</span>
      <span class="gaz-obj-text">${o.desc || ''}</span>
      ${o.done
        ? `<span class="gaz-obj-bonus">+${fmt(o.reward)}</span>`
        : `<span class="gaz-obj-pct gaz-dim">${pct}%</span>`}
    </div>`;
  }).join('') || '<div class="gaz-dim">Aucun objectif cette semaine.</div>';

  const nextObjRows = (g.nextObjectives || []).map(o =>
    `<div class="gaz-obj-row next">
      <span>🎯</span>
      <span class="gaz-obj-text">${o.desc || ''}</span>
      <span class="gaz-obj-bonus gaz-dim">+${fmt(o.reward)}</span>
    </div>`
  ).join('') || '<div class="gaz-dim">Aucun objectif pour la semaine à venir.</div>';

  // ── RUBRIQUE BADGES ──
  const badgesHtml = g.newBadges.length > 0
    ? g.newBadges.map(b => `
        <div class="gaz-badge-item">
          <span class="gaz-badge-icon">${b.icon}</span>
          <div>
            <div class="gaz-badge-name">${b.name}</div>
            <div class="gaz-dim" style="font-size:0.68rem">${b.desc}</div>
            ${b.reward > 0 ? `<div style="color:var(--gold);font-size:0.72rem;font-weight:700">+${fmt(b.reward)}</div>` : ''}
          </div>
        </div>`).join('')
    : '<div class="gaz-dim">Aucun badge cette semaine.</div>';

  // ── RUBRIQUE ALERTES & INFOS ──
  const alertRows = [];
  if (g.promoInfo) alertRows.push(`<div class="gaz-alert-row promo">🏷️ ${g.promoInfo}</div>`);
  g.decayItems.forEach(d => alertRows.push(`<div class="gaz-alert-row decay">🍂 ${d.qty}× <em>${d.name}</em> perdu${d.qty > 1 ? 's' : ''}</div>`));
  if (g.weather) alertRows.push(`<div class="gaz-alert-row weather">${g.weather.icon} Météo : ${g.weather.label}</div>`);
  if (g.event)   alertRows.push(`<div class="gaz-alert-row event">${g.event.icon} Événement : ${g.event.name}</div>`);
  const alertsHtml = alertRows.length > 0
    ? alertRows.join('')
    : '<div class="gaz-dim">Rien de particulier à signaler.</div>';

  const html = `
  <div class="gazette-modal">

    <!-- EN-TÊTE JOURNAL -->
    <div class="gaz-header">
      <div class="gaz-header-left">
        <div class="gaz-title">📰 La Gazette de la Centrale</div>
        <div class="gaz-subtitle">Votre bilan de la semaine</div>
      </div>
      <div class="gaz-header-right">
        <div class="gaz-week">${seasonIcon} Semaine ${g.week}</div>
        <div class="gaz-season">${g.season} — Année ${g.year}</div>
      </div>
    </div>
    <div class="gaz-rule"></div>

    <!-- MANCHETTE : CA TOTAL -->
    <div class="gaz-headline">
      <div class="gaz-headline-main">
        <div class="gaz-ca-label">Chiffre d'affaires</div>
        <div class="gaz-ca-amount">${fmt(g.totalRevenue)}</div>
        <div class="gaz-ca-profit">bénéfice net : ${fmt(g.totalProfit)}</div>
      </div>
      <div class="gaz-annual-progress">
        <div class="gaz-annual-label">Objectif annuel</div>
        <div class="gaz-annual-bar-wrap">
          <div class="gaz-annual-bar" style="width:${annualPct}%"></div>
        </div>
        <div class="gaz-annual-nums">${fmt(g.annualCA)} / ${fmt(g.annualTarget)} <span class="gaz-dim">(${annualPct}%)</span></div>
      </div>
    </div>
    <div class="gaz-rule"></div>

    <!-- CORPS : 2 COLONNES -->
    <div class="gaz-body">

      <!-- COL 1 : rayons + alertes -->
      <div class="gaz-col">
        <div class="gaz-section-title">📋 Résultats par rayon</div>
        <div class="gaz-sections">
          ${noSales
            ? '<div class="gaz-dim">Aucune vente cette semaine.</div>'
            : sectionRows}
        </div>

        <div class="gaz-section-title" style="margin-top:10px">📌 À noter</div>
        <div class="gaz-alerts">${alertsHtml}</div>
      </div>

      <!-- COL 2 : clients + objectifs + badges -->
      <div class="gaz-col">
        <div class="gaz-section-title">👥 Vos clients</div>
        <div class="gaz-sat-block">${satBar}</div>
        <div class="gaz-rep-line">
          Réputation : <strong>${Math.round(g.reputation.current)}/100</strong>
          <span style="color:${repColor}; font-weight:700"> ${repDir}${Math.abs(g.reputation.delta)}</span>
          <span class="gaz-stars">${reputationStars(g.reputation.current)}</span>
        </div>

        <div class="gaz-section-title" style="margin-top:10px">🎯 Objectifs — semaine écoulée</div>
        <div class="gaz-objectives">${objRows}</div>

        <div class="gaz-section-title gaz-next-obj-title" style="margin-top:10px">📋 Objectifs — semaine à venir</div>
        <div class="gaz-objectives">${nextObjRows}</div>

        <div class="gaz-section-title" style="margin-top:10px">🏅 Badges obtenus</div>
        <div class="gaz-badges">${badgesHtml}</div>
      </div>
    </div>
    <div class="gaz-rule"></div>

    <!-- PIED DE PAGE -->
    <div class="gaz-footer">
      <button class="btn-primary gaz-close-btn" onclick="closeGazette()">Continuer →</button>
    </div>

  </div>`;

  // Modale spéciale gazette — neutralise les styles de #modal-content
  const overlay = el('modal-overlay');
  const content = el('modal-content');
  content.innerHTML = html;
  // Supprimer les styles par défaut du conteneur pour laisser la gazette gérer son propre look
  content.style.cssText = 'background:transparent;border:none;padding:0;max-width:none;width:auto;max-height:none;overflow:visible;box-shadow:none;animation:none;border-radius:0;';
  overlay.classList.add('visible', 'gazette-open');
  const inner = content.querySelector('.gazette-modal');
  if (inner) {
    inner.addEventListener('animationend', () => inner.classList.add('gazette-landed'), { once: true });
  }
}

function closeGazette() {
  const gaz = document.querySelector('.gazette-modal');
  const finish = () => {
    closeModal();
    renderAll();
    saveGame();
    showToast('💾 Partie sauvegardée automatiquement.', 'info');
  };
  if (!gaz) { finish(); return; }
  gaz.classList.add('gazette-closing');
  gaz.addEventListener('animationend', finish, { once: true });
}

// ── Badges ────────────────────────────────────────────────────
const BADGE_CATS = [
  { id: 'progression', label: '📈 Progression' },
  { id: 'performance',  label: '🏆 Performance'  },
  { id: 'maitrise',     label: '🎓 Maîtrise'     },
  { id: 'longevite',    label: '🌳 Longévité'    },
];

function openBadgesModal() {
  const unlocked = G.achievements || [];
  const total    = ACHIEVEMENTS.length;
  const count    = unlocked.length;

  let html = `
    <div class="modal-header">
      <span>🏅 Mes badges</span>
      <span class="badge-header-count">${count} / ${total}</span>
    </div>
    <div class="badge-progress-bar">
      <div class="badge-progress-fill" style="width:${Math.round((count/total)*100)}%"></div>
    </div>
  `;

  BADGE_CATS.forEach(cat => {
    const items = ACHIEVEMENTS.filter(a => a.cat === cat.id);
    html += `<div class="badge-category">
      <div class="badge-cat-title">${cat.label}</div>
      <div class="badge-grid">`;
    items.forEach(a => {
      const done = unlocked.includes(a.id);
      const rewardTxt = a.reward > 0 ? `<div class="badge-reward">+${fmt(a.reward)}</div>` : '';
      html += `
        <div class="badge-card ${done ? 'unlocked' : 'locked'}" title="${a.desc}${a.reward > 0 ? ` (+${fmt(a.reward)})` : ''}">
          <div class="badge-icon">${done ? a.icon : '🔒'}</div>
          <div class="badge-name">${a.name}</div>
          <div class="badge-desc">${done ? a.desc : '???'}</div>
          ${done && a.reward > 0 ? rewardTxt : ''}
        </div>`;
    });
    html += `</div></div>`;
  });

  html += `<div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Fermer</button></div>`;
  showModal(html);
}

function showBadgeToast(def) {
  // Toast spécial pour les badges : plus grande et avec animation
  const t = document.createElement('div');
  t.className = 'toast toast-badge';
  t.innerHTML = `
    <div class="badge-toast-icon">${def.icon}</div>
    <div class="badge-toast-body">
      <div class="badge-toast-title">Badge débloqué !</div>
      <div class="badge-toast-name">${def.name}</div>
      ${def.reward > 0 ? `<div class="badge-toast-reward">+${fmt(def.reward)} 💶</div>` : ''}
    </div>`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 600); }, 4000);
}
