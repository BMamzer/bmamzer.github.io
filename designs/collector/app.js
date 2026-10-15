// Holo: the studio's games as a collectible card collection. All content comes from /games.json.
import {
  loadCatalog, icon, esc, releaseLabel, onRoute, openGame, closeGame, playTrailer, stopTrailer,
  reducedMotion, setPageMeta, addStructuredData, portLabel, PLATFORM_LABELS,
} from '/assets/site/catalog.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const canHover = matchMedia('(hover: hover) and (pointer: fine)');

const state = { platform: 'all', genre: 'all', sort: 'newest', query: '' };
let catalog;
let current = null;
let returnFocus = null;

// Platform marks for the card stat line. iOS and web reuse the shared brand icons.
const PLATFORM_PATHS = {
  pc: 'M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v9h16V6H4Z',
  android: 'M17.6 9.5l1.8-3.2a.5.5 0 0 0-.9-.5l-1.8 3.2a11.4 11.4 0 0 0-9.4 0L5.5 5.8a.5.5 0 0 0-.9.5l1.8 3.2A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.5ZM7 15.3a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm10 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z',
};

function platformIcon(platform, size = 16) {
  if (platform === 'ios') return icon('appstore', { size });
  if (!PLATFORM_PATHS[platform]) return icon('web', { size });
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${PLATFORM_PATHS[platform]}"/></svg>`;
}

const PORT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7V7Zm10 10H6l3 3-1.4 1.4L2.2 16l5.4-5.4L9 12l-3 3h11v2Z" fill="currentColor"/></svg>';

// The studio mark: a card with a star, drawn inline so it follows the palette tokens.
let markCount = 0;
function mark(size) {
  const id = `mark-foil-${++markCount}`;
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" style="stop-color: var(--mark-a)"/><stop offset=".5" style="stop-color: var(--mark-b)"/><stop offset="1" style="stop-color: var(--mark-c)"/>
    </linearGradient></defs>
    <g transform="rotate(-10 32 32)">
      <rect x="13" y="5" width="38" height="54" rx="7" fill="url(#${id})"/>
      <rect x="18" y="10" width="28" height="44" rx="4" style="fill: var(--bg-deep)"/>
    </g>
    <path d="M32 18.5l3.3 9.2 9.2 3.3-9.2 3.3L32 43.5l-3.3-9.2-9.2-3.3 9.2-3.3Z" style="fill: var(--hi)"/>
  </svg>`;
}

const SPARKLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6Z" fill="currentColor"/></svg>';

init();

async function init() {
  $('[data-mark]').innerHTML = mark(34);
  try {
    catalog = await loadCatalog();
  } catch {
    $('#grid-rare').innerHTML = '<li class="load-error">The games could not be loaded. Please refresh the page.</li>';
    return;
  }
  renderHero();
  renderControls();
  renderCollection();
  renderProfile();
  renderFooter();
  addStructuredData(catalog);
  setupGyro();
  setupDetail();
  document.addEventListener('click', onCardClick);
  onRoute(catalog, game => (game ? showDetail(game) : hideDetail()));
}

// ---------------------------------------------------------------- cards

function cardHTML(game, { tag = 'li', interactive = true, lazy = true } = {}) {
  const rare = game.featured;
  const art = game.media.hero || game.media.cover;
  const type = game.genres.slice(0, 2).join(' · ');
  const port = game.isPort;
  const stamp = port ? `<span class="port-stamp">${PORT_ICON}<span>${esc(portLabel(game))}</span></span>` : '';
  const lower = port
    ? `<span class="card-origin"><span>Original by</span> <b>${esc(game.originalDeveloper)}</b></span>`
    : `<span class="card-flavor">${esc(game.tagline)}</span>`;
  const face = `
    <span class="card-inner">
      <span class="card-face card-front">
        <span class="card-body">
          <span class="card-name">
            <span class="card-title${game.title.length > 16 ? ' card-title-long' : ''}">${esc(game.title)}</span>
            <span class="gem ${rare ? 'gem-rare' : 'gem-common'}" aria-hidden="true"></span>
          </span>
          <span class="card-art">
            <img src="${esc(art)}" alt="" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">
            ${stamp}
          </span>
          <span class="card-type">${esc(type)}</span>
          ${lower}
          <span class="card-stats">
            <span class="card-year">${esc(releaseLabel(game))}</span>
            <span class="card-plats">${game.platforms.map(p => platformIcon(p)).join('')}</span>
          </span>
        </span>
        <span class="foil" aria-hidden="true"></span>
        <span class="glare" aria-hidden="true"></span>
      </span>
      <span class="card-face card-back" aria-hidden="true"><span class="back-emblem">${SPARKLE}</span></span>
    </span>`;
  const kind = port ? `${portLabel(game).toLowerCase()}, original by ${game.originalDeveloper}` : `${rare ? 'rare' : 'common'} card`;
  const label = `${game.title}, ${kind}, ${releaseLabel(game)}. Open details`;
  const inner = interactive
    ? `<button class="card-btn" type="button" data-open="${esc(game.id)}" aria-label="${esc(label)}">${face}</button>`
    : `<span class="card-btn card-static">${face}</span>`;
  return `<${tag} class="card ${rare ? 'rare' : 'common'}${port ? ' port' : ''}" style="--accent:${esc(game.accent)}" data-id="${esc(game.id)}">${inner}</${tag}>`;
}

function bindCards(root) {
  $$('.card-btn', root).forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    bindTilt(btn);
    bindHoverLoop(btn);
  });
}

// Pointer tilt and foil highlight. Touch screens get the idle shimmer (CSS) or the gyroscope instead.
function bindTilt(btn) {
  if (reducedMotion() || !canHover.matches) return;
  const inner = $('.card-inner', btn);
  let frame = 0;
  btn.addEventListener('pointermove', e => {
    const r = btn.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      inner.style.setProperty('--rx', `${((x - 0.5) * 18).toFixed(2)}deg`);
      inner.style.setProperty('--ry', `${((0.5 - y) * 18).toFixed(2)}deg`);
      inner.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      inner.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    });
  });
  btn.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame);
    ['--rx', '--ry', '--mx', '--my'].forEach(p => inner.style.removeProperty(p));
  });
}

// On hover the card art comes alive with the game's silent trailer clip, one card at a time.
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
    art.append(video);
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
  const id = btn.dataset.open;
  const card = btn.closest('.card');
  returnFocus = btn;
  if (reducedMotion()) return openGame(id);
  card.classList.add('flipping');
  setTimeout(() => {
    openGame(id);
    setTimeout(() => card.classList.remove('flipping'), 500);
  }, 380);
}

// ---------------------------------------------------------------- hero

function renderHero() {
  const { studio, platforms, spotlight } = catalog;
  $('#hero-eyebrow').textContent = [ 'Independent game studio', studio.location, studio.since && `since ${studio.since}` ]
    .filter(Boolean).join(' · ');
  // One span per word, so each line of the title gets the full metallic gradient.
  $('#hero-title').innerHTML = studio.name.split(' ').map(w => `<span>${esc(w)}</span>`).join(' ');
  $('#hero-lead').textContent = studio.tagline;
  $('#hero-sub').textContent = `${catalogSummary()} for ${listOf(platforms.map(p => PLATFORM_LABELS[p]))}. Pick a card.`;

  const hand = $('#hand');
  const n = spotlight.length;
  hand.style.setProperty('--n', n);
  hand.innerHTML = spotlight.map(g => cardHTML(g, { lazy: false })).join('');
  $$('.card', hand).forEach((card, i) => {
    const offset = i - (n - 1) / 2;
    card.style.setProperty('--i', i);
    card.style.setProperty('--offset', offset);
    card.style.setProperty('--abs', Math.abs(offset));
  });
  bindCards(hand);
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
  const platformChips = [['all', 'All'], ...platforms.map(p => [p, PLATFORM_LABELS[p]])];
  $('#platform-chips').innerHTML = platformChips.map(([value, label]) => `
    <button class="chip" type="button" data-platform="${value}" aria-pressed="${value === state.platform}">
      ${value === 'all' ? '' : platformIcon(value, 16)}<span>${esc(label)}</span>
    </button>`).join('');
  $('#platform-row').hidden = platforms.length < 2;

  $('#genre-chips').innerHTML = [['all', 'Any type'], ...genres.map(g => [g, g])].map(([value, label]) => `
    <button class="chip chip-small" type="button" data-genre="${esc(value)}" aria-pressed="${value === state.genre}">${esc(label)}</button>`).join('');
  $('#genre-row').hidden = genres.length < 2;
  $('#search-wrap').hidden = games.length <= 12;
  $('#ports-note').textContent = `Games by other studios, ported by ${catalog.studio.name}.`;

  $('#controls').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    if (chip.dataset.platform) state.platform = chip.dataset.platform;
    if (chip.dataset.genre) state.genre = chip.dataset.genre;
    syncChips();
    renderCollection();
  });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; renderCollection(); });
  $('#search').addEventListener('input', e => { state.query = e.target.value.trim().toLowerCase(); renderCollection(); });
  $('#reset').addEventListener('click', () => {
    Object.assign(state, { platform: 'all', genre: 'all', query: '' });
    $('#search').value = '';
    syncChips();
    renderCollection();
  });
}

function syncChips() {
  $$('[data-platform]').forEach(c => c.setAttribute('aria-pressed', c.dataset.platform === state.platform));
  $$('[data-genre]').forEach(c => c.setAttribute('aria-pressed', c.dataset.genre === state.genre));
}

function visibleGames() {
  const list = catalog.games.filter(g =>
    (state.platform === 'all' || g.platforms.includes(state.platform)) &&
    (state.genre === 'all' || g.genres.includes(state.genre)) &&
    (!state.query || `${g.title} ${g.subtitle} ${g.genres.join(' ')}`.toLowerCase().includes(state.query)));
  if (state.sort === 'oldest') list.reverse();
  if (state.sort === 'az') list.sort((a, b) => a.title.localeCompare(b.title));
  return list;
}

function renderCollection() {
  const list = visibleGames();
  const own = list.filter(g => !g.isPort && g.featured);
  const ports = list.filter(g => g.isPort);
  const common = list.filter(g => !g.isPort && !g.featured);
  $('#grid-rare').innerHTML = own.map((g, i) => cardHTML(g, { lazy: i > 3 })).join('');
  $('#grid-ports').innerHTML = ports.map(g => cardHTML(g)).join('');
  $('#grid-common').innerHTML = common.map(g => cardHTML(g)).join('');
  $('#grid-rare').hidden = !own.length;
  $('#ports').hidden = !ports.length;
  $('#common').hidden = !common.length;
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
  ].filter(Boolean).join('<span class="count-sep">, </span>');
}

// ---------------------------------------------------------------- profile and footer

function renderProfile() {
  const { studio, originals, ports } = catalog;
  // The hero line already says "since <year>", so the profile skips a stat that only repeats that year.
  const stats = [
    ...studio.stats.filter(s => s.value !== String(studio.since)),
    { value: String(originals.length), label: 'Games released' },
    ...(ports.length ? [{ value: String(ports.length), label: ports.length === 1 ? 'Port released' : 'Ports released' }] : []),
  ];
  $('#profile-card').innerHTML = `
    <div class="profile-main">
      <div class="profile-id">
        <div class="avatar" aria-hidden="true">${mark(72)}</div>
        <div>
          <p class="profile-name">${esc(studio.name)}</p>
          <p class="profile-class">Solo developer${studio.location ? ` from ${esc(studio.location)}` : ''}</p>
        </div>
      </div>
      <div class="profile-about">${studio.about.map(p => `<p>${esc(p)}</p>`).join('')}</div>
    </div>
    <div class="profile-side">
      <dl class="profile-stats">
        ${stats.map(s => `<div class="stat"><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}
      </dl>
      <div class="profile-contact" id="contact" tabindex="-1">
        <h3 class="sub-title">Say hello</h3>
        <p>Questions, press, feedback or support: email me and I'll get back to you.</p>
        <a class="btn btn-primary btn-mail" href="mailto:${esc(studio.email)}">${icon('mail', { size: 22 })}<span>${esc(studio.email).replace('@', '<wbr>@')}</span></a>
        <ul class="links" aria-label="Find me online">
          ${studio.links.map(l => `<li><a class="link-btn" href="${esc(l.url)}" rel="noopener" target="_blank">${icon(l.type, { size: 20 })}<span>${esc(l.label)}</span></a></li>`).join('')}
        </ul>
      </div>
    </div>`;
}

function renderFooter() {
  const { studio } = catalog;
  $('#footer').innerHTML = `
    <p class="footer-brand">${mark(28)}<span>© ${new Date().getFullYear()} ${esc(studio.name)}</span></p>
    <a class="footer-top" href="#top">Back to top</a>`;
}

// ---------------------------------------------------------------- detail view

const STORE_PREFIX = { web: 'Play now', crazygames: 'Play on' };

function storeButton(store) {
  return `<a class="store-btn store-${esc(store.type)}" href="${esc(store.url)}" rel="noopener" target="_blank">
    ${icon(store.type, { size: 28 })}
    <span><small>${STORE_PREFIX[store.type] || 'Get it on'}</small><strong>${esc(store.label)}</strong></span>
  </a>`;
}

function detailHTML(game) {
  const m = game.media;
  const studio = catalog.studio.name;
  const facts = [
    ['Released', releaseLabel(game)],
    ['Platforms', game.platformLabels.join(', ')],
    ['Type', game.genres.join(', ')],
    ['Rarity', game.featured ? 'Rare' : 'Common'],
    ['Made by', game.isPort ? `${game.originalDeveloper} (original), ${studio} (port)` : studio],
  ];
  const links = [
    game.website && `<a href="${esc(game.website)}">${icon('web', { size: 18 })}<span>Game website</span></a>`,
    game.privacy && `<a href="${esc(game.privacy)}">Privacy policy</a>`,
  ].filter(Boolean);
  return `
    <button class="round-btn sheet-close" type="button" id="detail-close" aria-label="Close ${esc(game.title)}">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M18.3 7.1 16.9 5.7 12 10.6 7.1 5.7 5.7 7.1l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9z" fill="currentColor"/></svg>
    </button>
    <div class="d-hero">
      <img class="d-hero-art" src="${esc(m.hero)}" alt="" decoding="async">
      ${m.loop && !reducedMotion() ? `<video class="d-loop" src="${esc(m.loop)}" ${m.loopPoster ? `poster="${esc(m.loopPoster)}"` : ''} muted loop playsinline autoplay aria-hidden="true"></video>` : ''}
      <div class="d-hero-fade"></div>
      <div class="d-hero-content">
        ${m.logo ? `<img class="d-logo" src="${esc(m.logo)}" alt="${esc(game.title)}">` : ''}
      </div>
      ${m.trailer ? `<button class="btn btn-primary d-trailer-btn" type="button" id="trailer-btn">${icon('play', { size: 20 })}<span>Watch trailer</span></button>` : ''}
      ${m.trailer ? '<video class="d-trailer" id="trailer" playsinline hidden></video>' : ''}
    </div>
    <div class="d-body">
      <aside class="d-side">
        <div class="d-card">${cardHTML(game, { tag: 'div', interactive: false, lazy: false })}</div>
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      </aside>
      <div class="d-main">
        <p class="eyebrow">${esc(game.genres.join(' · '))}</p>
        <h2 class="d-title${m.logo ? ' visually-hidden' : ''}" id="detail-title">${esc(game.title)}</h2>
        ${game.subtitle ? `<p class="d-subtitle">${esc(game.subtitle)}</p>` : ''}
        ${game.isPort ? `<p class="d-port">${PORT_ICON}<span><strong>${esc(portLabel(game))}.</strong> Original game by ${esc(game.originalDeveloper)}.</span></p>` : ''}
        <p class="d-flavor">${esc(game.tagline)}</p>
        ${game.badge ? `<p class="d-badge">${SPARKLE}<span>${esc(game.badge)}</span></p>` : ''}
        <div class="stores">${game.stores.map(storeButton).join('')}</div>
        ${game.highlights.length ? `<ul class="highlights" aria-label="Highlights">${game.highlights.map(h => `<li>${trophy()}<span>${esc(h)}</span></li>`).join('')}</ul>` : ''}
        <div class="d-text">${(game.description.length ? game.description : [game.summary]).map(p => `<p>${esc(p)}</p>`).join('')}</div>
        ${game.features.length ? `<h3 class="sub-title">Abilities</h3>
          <ul class="features">${game.features.map(f => `<li>${SPARKLE}<span>${esc(f)}</span></li>`).join('')}</ul>` : ''}
        ${m.screenshots.length ? `<h3 class="sub-title">Screenshots</h3>
          <ul class="shots" aria-label="Screenshots">${m.screenshots.map((s, i) => `
            <li><button class="shot" type="button" data-shot="${i}" aria-label="Open screenshot ${i + 1} of ${m.screenshots.length}">
              <img src="${esc(s.src)}" alt="${esc(game.title)} screenshot ${i + 1}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async">
            </button></li>`).join('')}</ul>` : ''}
        ${game.credits ? `<p class="credits">${esc(game.credits)}</p>` : ''}
        ${links.length ? `<p class="d-links">${links.join('')}</p>` : ''}
      </div>
    </div>`;
}

function trophy() {
  return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M17 4V2H7v2H2v4a5 5 0 0 0 4.6 5A6 6 0 0 0 11 16.9V19H7v3h10v-3h-4v-2.1a6 6 0 0 0 4.4-3.9A5 5 0 0 0 22 8V4h-5ZM4 8V6h3v4.8A3 3 0 0 1 4 8Zm16 0a3 3 0 0 1-3 2.8V6h3v2Z"/></svg>';
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
  sheet.classList.remove('playing');
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
  $('.d-hero').classList.add('playing');
  $('#sheet').classList.add('playing');
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

// The silent hero clip only plays while it is on screen inside the open sheet.
let loopObserver;
function watchLoop(dialog) {
  const loop = $('.d-loop');
  if (!loop) return;
  loopObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !$('.d-hero').classList.contains('playing')) loop.play().catch(() => {});
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
