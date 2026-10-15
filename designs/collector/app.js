// Collector: the studio's games as a set of premium trading cards. All content comes from /games.json.
import {
  loadCatalog, icon, esc, releaseLabel, onRoute, openGame, closeGame, playTrailer, stopTrailer,
  reducedMotion, setPageMeta, addStructuredData, privacyLinks, portLabel, PLATFORM_LABELS,
} from '/assets/site/catalog.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const canHover = matchMedia('(hover: hover) and (pointer: fine)');

const state = { platform: 'all', genre: 'all', sort: 'newest', query: '' };
let catalog;
let numbers;
let current = null;
let returnFocus = null;
let deckIndex = 0;

// Platform marks for the card footer. iOS and web reuse the shared brand icons.
const PLATFORM_PATHS = {
  pc: 'M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v9h16V6H4Z',
  android: 'M17.6 9.5l1.8-3.2a.5.5 0 0 0-.9-.5l-1.8 3.2a11.4 11.4 0 0 0-9.4 0L5.5 5.8a.5.5 0 0 0-.9.5l1.8 3.2A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.5ZM7 15.3a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm10 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z',
};

function platformIcon(platform, size = 16) {
  if (platform === 'ios') return icon('appstore', { size });
  if (!PLATFORM_PATHS[platform]) return icon('web', { size });
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${PLATFORM_PATHS[platform]}"/></svg>`;
}

// Rarity marks in the card's top corner: a four point star for holo cards, arrows for ports, a dot for commons.
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6Z" fill="currentColor"/></svg>';
const PORT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7V7Zm10 10H6l3 3-1.4 1.4L2.2 16l5.4-5.4L9 12l-3 3h11v2Z" fill="currentColor"/></svg>';
const DOT = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>';

init();

async function init() {
  try {
    catalog = await loadCatalog();
  } catch {
    $('#grid-own').innerHTML = '<li class="load-error">The games could not be loaded. Please refresh the page.</li>';
    return;
  }
  // Collector numbers follow release order, oldest first, so a new game always gets the next number.
  const byRelease = [...catalog.games].sort((a, b) => a.released.localeCompare(b.released));
  numbers = new Map(byRelease.map((g, i) => [g.id, i + 1]));

  renderHero();
  renderControls();
  renderCollection();
  renderAbout();
  renderFooter();
  addStructuredData(catalog);
  setupGyro();
  setupDetail();
  document.addEventListener('click', onCardClick);
  onRoute(catalog, game => (game ? showDetail(game) : hideDetail()));
}

// ---------------------------------------------------------------- cards

function rarityOf(game) {
  if (game.isPort) return 'port';
  return game.featured ? 'holo' : 'common';
}

const RARITY_NAMES = { holo: 'Holo', port: 'Port', common: 'Common' };
const RARITY_ICONS = { holo: STAR, port: PORT_ICON, common: DOT };

function cardNumber(game) {
  const pad = n => String(n).padStart(3, '0');
  return `${pad(numbers.get(game.id))}/${pad(catalog.games.length)}`;
}

/** The card itself, without its list item or button. */
function cardFace(game, { lazy = true } = {}) {
  const rarity = rarityOf(game);
  const art = game.media.hero || game.media.cover;
  const text = game.isPort
    ? `<span class="card-origin">${esc(portLabel(game))} of the original game by <b>${esc(game.originalDeveloper)}</b>.</span>`
    : `<span class="card-flavor">${esc(game.tagline)}</span>`;
  return `
    <span class="card-tilt">
      <span class="card-face">
        <span class="card-head">
          <span class="card-name${game.title.length > 18 ? ' card-name-long' : ''}">${esc(game.title)}</span>
          <span class="card-rarity">${RARITY_ICONS[rarity]}</span>
        </span>
        <span class="card-art">
          <img src="${esc(art)}" alt="" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">
          ${game.isPort ? `<span class="card-plaque">${PORT_ICON}<span>${esc(portLabel(game))}</span></span>` : ''}
          <span class="card-foil" aria-hidden="true"></span>
        </span>
        <span class="card-type"><span>${esc(game.genres.slice(0, 2).join(' · '))}</span></span>
        <span class="card-text">${text}</span>
        <span class="card-foot">
          <span class="card-no">${cardNumber(game)} · ${RARITY_NAMES[rarity]}</span>
          <span class="card-plats">${game.platforms.map(p => platformIcon(p, 14)).join('')}</span>
        </span>
      </span>
      <span class="card-glare" aria-hidden="true"></span>
    </span>`;
}

function cardHTML(game, { tag = 'li', interactive = true, lazy = true, attrs = '' } = {}) {
  const rarity = rarityOf(game);
  const kind = game.isPort
    ? `${portLabel(game).toLowerCase()}, original by ${game.originalDeveloper}`
    : `${RARITY_NAMES[rarity].toLowerCase()} card`;
  const label = `${game.title}, ${kind}, ${releaseLabel(game)}. Open details`;
  const inner = interactive
    ? `<button class="card-btn" type="button" data-open="${esc(game.id)}" aria-label="${esc(label)}">${cardFace(game, { lazy })}</button>`
    : `<span class="card-btn card-static">${cardFace(game, { lazy })}</span>`;
  return `<${tag} class="card ${rarity}" style="--accent:${esc(game.accent)}" data-id="${esc(game.id)}" ${attrs}>${inner}</${tag}>`;
}

function bindCards(root) {
  $$('.card-btn', root).forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    bindTilt(btn);
    bindHoverLoop(btn);
  });
}

// Pointer tilt and glare. Touch screens get a slow shimmer (CSS) or the gyroscope instead.
function bindTilt(btn) {
  if (reducedMotion() || !canHover.matches) return;
  const tilt = $('.card-tilt', btn);
  let frame = 0;
  btn.addEventListener('pointermove', e => {
    const r = btn.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      tilt.style.setProperty('--rx', `${((x - 0.5) * 14).toFixed(2)}deg`);
      tilt.style.setProperty('--ry', `${((0.5 - y) * 14).toFixed(2)}deg`);
      tilt.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      tilt.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    });
  });
  btn.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    ['--rx', '--ry', '--mx', '--my'].forEach(p => tilt.style.removeProperty(p));
  });
}

// On hover the art window plays the game's silent clip, one card at a time.
function bindHoverLoop(btn) {
  const game = catalog.byId.get(btn.closest('.card')?.dataset.id);
  if (!game?.media.loop || reducedMotion() || !canHover.matches) return;
  const art = $('.card-art', btn);
  btn.addEventListener('pointerenter', () => {
    if ($('video', art)) return;
    const video = document.createElement('video');
    Object.assign(video, { muted: true, loop: true, playsInline: true, autoplay: true, src: game.media.loop });
    video.setAttribute('aria-hidden', 'true');
    video.addEventListener('playing', () => video.classList.add('on'), { once: true });
    $('.card-foil', art).before(video);
    video.play().catch(() => {});
  });
  btn.addEventListener('pointerleave', () => $('video', art)?.remove());
}

// Android phones report tilt without a permission prompt; iOS needs one, so iOS keeps the idle shimmer.
function setupGyro() {
  const touch = matchMedia('(hover: none)').matches;
  if (!touch || reducedMotion() || !('DeviceOrientationEvent' in window)) return;
  if (typeof DeviceOrientationEvent.requestPermission === 'function') return;
  const root = document.documentElement;
  let frame = 0;
  addEventListener('deviceorientation', e => {
    if (e.gamma == null || e.beta == null) return;
    const gx = Math.max(-1, Math.min(1, e.gamma / 25));
    const gy = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      root.classList.add('gyro');
      root.style.setProperty('--gx', gx.toFixed(3));
      root.style.setProperty('--gy', gy.toFixed(3));
    });
  });
}

function onCardClick(e) {
  const btn = e.target.closest('button[data-open]');
  if (!btn) return;
  // A card further back in the hero deck comes to the front first; the front card opens.
  const deckCard = btn.closest('.deck .card');
  if (deckCard && Number(deckCard.dataset.pos) !== 0) {
    setDeck(Number(deckCard.dataset.index));
    return;
  }
  returnFocus = btn;
  openGame(btn.dataset.open);
}

// ---------------------------------------------------------------- hero

function renderHero() {
  const { studio, platforms, spotlight } = catalog;
  $('#hero-kicker').textContent = ['Independent game studio', studio.location, studio.since && `since ${studio.since}`]
    .filter(Boolean).join(' · ');
  $('#hero-title').textContent = studio.name;
  $('#hero-lead').textContent = studio.tagline;
  $('#hero-sub').textContent = `${catalogSummary()} for ${listOf(platforms.map(p => PLATFORM_LABELS[p]))}.`;

  $('#deck').innerHTML = spotlight.map((g, i) => cardHTML(g, { lazy: i > 0, attrs: `data-index="${i}"` })).join('');
  bindCards($('#deck'));
  $('#deck-prev').addEventListener('click', () => setDeck(deckIndex - 1));
  $('#deck-next').addEventListener('click', () => setDeck(deckIndex + 1));
  $('#showcase').hidden = !spotlight.length;
  $('.showcase-bar').hidden = spotlight.length < 2;
  setupSwipe($('#deck'));
  setDeck(0);
}

// Puts card i at the front of the hero deck; the others fan out behind it in order.
function setDeck(i) {
  const cards = $$('#deck .card');
  const n = cards.length;
  if (!n) return;
  deckIndex = (i + n) % n;
  cards.forEach((card, j) => {
    const pos = (j - deckIndex + n) % n;
    card.dataset.pos = pos;
    card.style.setProperty('--pos', pos);
    const btn = $('.card-btn', card);
    btn.tabIndex = pos === 0 ? 0 : -1;
    card.setAttribute('aria-hidden', pos === 0 ? 'false' : 'true');
  });
  const game = catalog.spotlight[deckIndex];
  $('#showcase').style.setProperty('--accent', game.accent);
  $('#deck-caption').innerHTML = `<span class="deck-num">${String(deckIndex + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}</span><span class="deck-name">${esc(game.title)}</span>`;
}

function setupSwipe(el) {
  let start = null;
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') start = { x: e.clientX, y: e.clientY }; });
  el.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) setDeck(deckIndex + (dx < 0 ? 1 : -1));
  });
  el.addEventListener('pointercancel', () => { start = null; });
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// "5 games and 2 ports" style summary of Bart's own games and his ports.
function catalogSummary() {
  const { originals, ports } = catalog;
  return ports.length ? `${plural(originals.length, 'game')} and ${plural(ports.length, 'port')}` : plural(originals.length, 'game');
}

function listOf(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

// ---------------------------------------------------------------- collection

function renderControls() {
  const { platforms, genres, games } = catalog;
  const tabs = [['all', 'All'], ...platforms.map(p => [p, PLATFORM_LABELS[p]])];
  $('#platform-tabs').innerHTML = tabs.map(([value, label]) => `
    <button class="tab" type="button" data-platform="${value}" aria-pressed="${value === state.platform}">${esc(label)}</button>`).join('');
  $('#platform-tabs').hidden = platforms.length < 2;

  $('#genre').innerHTML = [['all', 'Any genre'], ...genres.map(g => [g, g])]
    .map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
  $('#genre-wrap').hidden = genres.length < 2;
  $('#search-wrap').hidden = games.length <= 12;
  $('#ports-note').textContent = `Games by other studios, brought to new platforms by ${catalog.studio.name}.`;

  $('#platform-tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    state.platform = tab.dataset.platform;
    syncTabs();
    renderCollection();
  });
  $('#genre').addEventListener('change', e => { state.genre = e.target.value; renderCollection(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; renderCollection(); });
  $('#search').addEventListener('input', e => { state.query = e.target.value.trim().toLowerCase(); renderCollection(); });
  $('#reset').addEventListener('click', () => {
    Object.assign(state, { platform: 'all', genre: 'all', query: '' });
    $('#search').value = '';
    $('#genre').value = 'all';
    syncTabs();
    renderCollection();
  });
}

function syncTabs() {
  $$('[data-platform]').forEach(t => t.setAttribute('aria-pressed', t.dataset.platform === state.platform));
}

function visibleGames() {
  const list = catalog.games.filter(g =>
    (state.platform === 'all' || g.platforms.includes(state.platform)) &&
    (state.genre === 'all' || g.genres.includes(state.genre)) &&
    (!state.query || `${g.title} ${g.subtitle} ${g.genres.join(' ')}`.toLowerCase().includes(state.query)));
  if (state.sort === 'oldest' || state.sort === 'number') list.reverse();
  if (state.sort === 'az') list.sort((a, b) => a.title.localeCompare(b.title));
  return list;
}

function renderCollection() {
  const list = visibleGames();
  const groups = {
    own: list.filter(g => !g.isPort && g.featured),
    ports: list.filter(g => g.isPort),
    earlier: list.filter(g => !g.isPort && !g.featured),
  };
  // Sorting by card number shows one continuous set, the way a collector's binder is ordered.
  if (state.sort === 'number') {
    groups.own = list;
    groups.ports = [];
    groups.earlier = [];
  }
  $('#grid-own').innerHTML = groups.own.map((g, i) => cardHTML(g, { lazy: i > 4 })).join('');
  $('#grid-ports').innerHTML = groups.ports.map(g => cardHTML(g)).join('');
  $('#grid-earlier').innerHTML = groups.earlier.map(g => cardHTML(g)).join('');
  $('#grid-own').hidden = !groups.own.length;
  $('#ports').hidden = !groups.ports.length;
  $('#earlier').hidden = !groups.earlier.length;
  $('#empty').hidden = list.length > 0;
  $('#count').innerHTML = countHTML(list);
  bindCards($('#collection'));
}

// "5 games, 2 ports" when everything shows, "3 of 5 games, 1 of 2 ports" when filtered.
function countHTML(list) {
  const { originals, ports } = catalog;
  const filtered = list.length < catalog.games.length;
  const part = (shown, total, word) => filtered
    ? `<strong>${shown}</strong> of ${plural(total, word)}`
    : `<strong>${total}</strong> ${word}${total === 1 ? '' : 's'}`;
  const shownPorts = list.filter(g => g.isPort).length;
  return [
    part(list.length - shownPorts, originals.length, 'game'),
    ports.length && part(shownPorts, ports.length, 'port'),
  ].filter(Boolean).join('<span class="count-sep"> · </span>');
}

// ---------------------------------------------------------------- about, contact and footer

function renderAbout() {
  const { studio, originals, ports } = catalog;
  const since = studio.since ? String(studio.since) : '';
  // The developer's own card, number 000, with an engraved monogram instead of art.
  const initials = studio.name.split(' ').map(w => w[0]).join('').slice(0, 2);
  $('#about-card').innerHTML = `
    <div class="card holo dev" style="--accent:#c9ccd3">
      <span class="card-btn card-static">
        <span class="card-tilt">
          <span class="card-face">
            <span class="card-head"><span class="card-name">${esc(studio.name)}</span><span class="card-rarity">${STAR}</span></span>
            <span class="card-art dev-art"><span class="monogram">${esc(initials)}</span><span class="card-foil" aria-hidden="true"></span></span>
            <span class="card-type"><span>Solo developer${studio.location ? ` · ${esc(studio.location)}` : ''}</span></span>
            <span class="card-text dev-stats">
              ${since ? `<span><b>${esc(since)}</b>First release</span>` : ''}
              <span><b>${originals.length}</b>${originals.length === 1 ? 'Game' : 'Games'}</span>
              ${ports.length ? `<span><b>${ports.length}</b>${ports.length === 1 ? 'Port' : 'Ports'}</span>` : ''}
            </span>
            <span class="card-foot"><span class="card-no">000/${String(catalog.games.length).padStart(3, '0')} · Developer</span></span>
          </span>
          <span class="card-glare" aria-hidden="true"></span>
        </span>
      </span>
    </div>`;
  bindCards($('#about-card'));

  $('#about-title').textContent = `A solo developer${studio.location ? ` from ${studio.location}` : ''}`;
  $('#about-body').innerHTML = studio.about.map(p => `<p>${esc(p)}</p>`).join('');
  // The first release year is already on the card and in the hero, so the stats skip it.
  $('#stats').innerHTML = studio.stats.filter(s => s.value !== since)
    .map(s => `<div class="stat"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('');

  const mail = $('#mail');
  mail.href = `mailto:${studio.email}`;
  mail.innerHTML = `${icon('mail', { size: 20 })}<span>${esc(studio.email).replace('@', '<wbr>@')}</span>`;
  $('#links').innerHTML = studio.links.map(l => `
    <li><a href="${esc(l.url)}" rel="noopener me" target="_blank">${icon(l.type, { size: 18 })}<span>${esc(l.label)}</span></a></li>`).join('');
}

function renderFooter() {
  const { studio } = catalog;
  const policies = privacyLinks(catalog);
  $('#footer').innerHTML = `
    <p class="footer-brand"><img src="/designs/collector/favicon.svg" alt="" width="20" height="20"><span>© ${new Date().getFullYear()} ${esc(studio.name)}</span></p>
    ${policies.length ? `<nav aria-label="Privacy policies"><ul class="footer-links">
      ${policies.map(p => `<li><a href="${esc(p.url)}">${esc(p.label)}</a></li>`).join('')}
    </ul></nav>` : ''}
    <a class="footer-top" href="#top">Back to top</a>`;
}

// ---------------------------------------------------------------- detail view

const STORE_PREFIX = { web: 'Play now', crazygames: 'Play on' };

function storeButton(store) {
  return `<a class="store-btn" href="${esc(store.url)}" rel="noopener" target="_blank">
    ${icon(store.type, { size: 24 })}
    <span><small>${STORE_PREFIX[store.type] || 'Get it on'}</small><strong>${esc(store.label)}</strong></span>
  </a>`;
}

function detailHTML(game) {
  const m = game.media;
  const studio = catalog.studio.name;
  const rarity = rarityOf(game);
  const facts = [
    ['Card', `${cardNumber(game)}, ${RARITY_NAMES[rarity]}`],
    ['Released', releaseLabel(game, { month: true })],
    ['Platforms', game.platformLabels.join(', ')],
    ['Genre', game.genres.join(', ')],
    ['Made by', game.isPort ? `${game.originalDeveloper} (original), ${studio} (port)` : studio],
  ];
  const links = [
    game.website && `<a href="${esc(game.website)}">${icon('web', { size: 18 })}<span>Game website</span></a>`,
    game.privacy && `<a href="${esc(game.privacy)}">Privacy policy</a>`,
  ].filter(Boolean);
  return `
    <button class="icon-btn sheet-close" type="button" id="detail-close" aria-label="Close ${esc(game.title)}">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M18.3 7.1 16.9 5.7 12 10.6 7.1 5.7 5.7 7.1l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9z" fill="currentColor"/></svg>
    </button>
    <div class="d-grid">
      <div class="d-card">${cardHTML(game, { tag: 'div', interactive: false, lazy: false })}</div>
      <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="d-main">
        <p class="kicker">${esc(game.genres.join(' · '))}</p>
        <h2 class="d-title" id="detail-title">${esc(game.title)}</h2>
        ${game.subtitle ? `<p class="d-subtitle">${esc(game.subtitle)}</p>` : ''}
        ${game.isPort ? `<p class="d-port">${PORT_ICON}<span><strong>${esc(portLabel(game))}.</strong> Original game by ${esc(game.originalDeveloper)}.</span></p>` : ''}
        <p class="d-flavor">${esc(game.tagline)}</p>
        ${game.badge ? `<p class="d-badge">${STAR}<span>${esc(game.badge)}</span></p>` : ''}
        <div class="stores">${game.stores.map(storeButton).join('')}</div>
        <div class="d-media" id="d-media">
          <img class="d-media-art" src="${esc(m.hero || m.cover)}" alt="" decoding="async">
          ${m.loop && !reducedMotion() ? `<video class="d-loop" src="${esc(m.loop)}" ${m.loopPoster ? `poster="${esc(m.loopPoster)}"` : ''} muted loop playsinline autoplay aria-hidden="true"></video>` : ''}
          ${m.trailer ? `<button class="btn btn-solid d-trailer-btn" type="button" id="trailer-btn">${icon('play', { size: 18 })}<span>Watch trailer</span></button>` : ''}
          ${m.trailer ? '<video class="d-trailer" id="trailer" playsinline hidden></video>' : ''}
        </div>
        ${game.highlights.length ? `<ul class="highlights" aria-label="Highlights">${game.highlights.map(h => `<li>${STAR}<span>${esc(h)}</span></li>`).join('')}</ul>` : ''}
        <div class="d-text">${(game.description.length ? game.description : [game.summary]).map(p => `<p>${esc(p)}</p>`).join('')}</div>
        ${game.features.length ? `<h3 class="d-heading">Features</h3>
          <ul class="features">${game.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
        ${m.screenshots.length ? `<h3 class="d-heading">Screenshots</h3>
          <ul class="shots" aria-label="Screenshots">${m.screenshots.map((s, i) => `
            <li><button class="shot" type="button" data-shot="${i}" aria-label="Open screenshot ${i + 1} of ${m.screenshots.length}">
              <img src="${esc(s.src)}" alt="${esc(game.title)} screenshot ${i + 1}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async">
            </button></li>`).join('')}</ul>` : ''}
        ${game.credits ? `<p class="credits">${esc(game.credits)}</p>` : ''}
        ${links.length ? `<p class="d-links">${links.join('')}</p>` : ''}
      </div>
    </div>`;
}

function setupDetail() {
  const dialog = $('#detail');
  dialog.addEventListener('cancel', e => {
    e.preventDefault();
    if (!$('#lightbox').hidden) closeLightbox();
    else closeGame();
  });
  dialog.addEventListener('click', e => {
    if (e.target === dialog) return closeGame();
    if (e.target.closest('#detail-close')) return closeGame();
    if (e.target.closest('#trailer-btn')) return startTrailer();
    const shot = e.target.closest('[data-shot]');
    if (shot) openLightbox(Number(shot.dataset.shot));
  });
  $('#lightbox-close').addEventListener('click', closeLightbox);
  $('#lightbox-prev').addEventListener('click', () => stepLightbox(-1));
  $('#lightbox-next').addEventListener('click', () => stepLightbox(1));
  $('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });
  $('#lightbox').addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
  });
}

function showDetail(game) {
  const dialog = $('#detail');
  const sheet = $('#sheet');
  stopDetailMedia();
  closeLightbox();
  current = game;
  if (!returnFocus || !document.contains(returnFocus)) returnFocus = document.activeElement;
  sheet.style.setProperty('--accent', game.accent);
  sheet.innerHTML = detailHTML(game);
  bindCards(sheet);
  if (!dialog.open) {
    dialog.showModal();
    document.documentElement.classList.add('modal-open');
  }
  dialog.scrollTop = 0;
  setPageMeta(game, catalog.studio);
  watchLoop(dialog);
  $('#detail-close').focus({ preventScroll: true });
}

function hideDetail() {
  const dialog = $('#detail');
  if (!dialog.open) return;
  stopDetailMedia();
  closeLightbox();
  dialog.close();
  document.documentElement.classList.remove('modal-open');
  setPageMeta(null, catalog.studio);
  const target = (returnFocus && document.contains(returnFocus) && returnFocus) ||
    $(`#collection button[data-open="${CSS.escape(current?.id || '')}"]`);
  target?.focus({ preventScroll: true });
  returnFocus = null;
  current = null;
}

function startTrailer() {
  const video = $('#trailer');
  if (!video || !current?.media.trailer) return;
  $('.d-loop')?.pause();
  $('#d-media').classList.add('playing');
  video.hidden = false;
  playTrailer(video, current.media.trailer);
  video.focus({ preventScroll: true });
}

function stopDetailMedia() {
  const video = $('#trailer');
  if (video) stopTrailer(video);
  $('.d-loop')?.pause();
  loopObserver?.disconnect();
}

// The silent clip only plays while it is on screen inside the open sheet.
let loopObserver;
function watchLoop(dialog) {
  const loop = $('.d-loop');
  if (!loop) return;
  loopObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !$('#d-media').classList.contains('playing')) loop.play().catch(() => {});
    else loop.pause();
  }, { root: dialog, threshold: 0.2 });
  loopObserver.observe(loop);
}

// ---------------------------------------------------------------- screenshot lightbox

let shotIndex = 0;
let shotOpener = null;

function openLightbox(i) {
  if (!current) return;
  shotOpener = document.activeElement;
  $('#lightbox').hidden = false;
  $('#sheet').inert = true;
  showShot(i);
  $('#lightbox-close').focus();
}

function stepLightbox(step) {
  const n = current.media.screenshots.length;
  showShot((shotIndex + step + n) % n);
}

function showShot(i) {
  const shots = current.media.screenshots;
  shotIndex = i;
  const img = $('#lightbox-img');
  img.src = shots[i].src;
  img.alt = `${current.title} screenshot ${i + 1}`;
  $('#lightbox-count').textContent = `${i + 1} / ${shots.length}`;
  const single = shots.length < 2;
  $('#lightbox-prev').hidden = single;
  $('#lightbox-next').hidden = single;
}

function closeLightbox() {
  const box = $('#lightbox');
  if (box.hidden) return;
  box.hidden = true;
  $('#sheet').inert = false;
  $('#lightbox-img').removeAttribute('src');
  shotOpener?.focus({ preventScroll: true });
  shotOpener = null;
}
