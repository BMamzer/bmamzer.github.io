// Cinema design: billboard, rows, title page and lightbox, all built from /games.json.
import {
  loadCatalog, icon, esc, releaseLabel, onRoute, openGame, closeGame, reducedMotion,
  playTrailer, stopTrailer, setPageMeta, addStructuredData, privacyLinks, portLabel,
} from '/assets/site/catalog.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const canHover = matchMedia('(hover: hover) and (pointer: fine)');

const STORE_CTA = {
  steam: ['Get it on', 'Steam'],
  appstore: ['Download on the', 'App Store'],
  googleplay: ['Get it on', 'Google Play'],
  itch: ['Get it on', 'itch.io'],
  crazygames: ['Play on', 'CrazyGames'],
  web: ['Play', 'in your browser'],
};
const PLATFORM_FILTERS = { pc: 'PC', ios: 'iOS', android: 'Android', web: 'Web' };
const PLATFORM_ROWS = { pc: 'On PC', ios: 'On iPhone and iPad', android: 'On Android', web: 'In your browser' };

// Rows by broad genre. A row only appears when 3 or more games fit it.
const GENRE_ROWS = [
  { title: 'RPGs', test: /rpg|role|crawler/i },
  { title: 'Strategy and sims', test: /strateg|sim|idle|clicker|tycoon|management|builder/i },
  { title: 'Action', test: /action|shooter|arcade|roguelike|hack|platformer/i },
  { title: 'Puzzle and word', test: /puzzle|word|logic|match/i },
];

const ARROW_LEFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5 8.4 12l7 7-1.4 1.4L5.6 12 14 3.6Z"/></svg>';
const ARROW_RIGHT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.6 19 7-7-7-7L10 3.6 18.4 12 10 20.4Z"/></svg>';
const EXTERNAL = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8Z"/></svg>';
const PORT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7V7Zm10 10H6l3 3-1.4 1.4L2.2 16l5.4-5.4L9 12l-3 3h11v2Z"/></svg>';
const INFO = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 6v7h-2v-7h2Zm-1-4a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 12 6Z"/></svg>';

const ua = navigator.userAgent;
const device = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  ? 'appstore' : /Android/.test(ua) ? 'googleplay' : '';

const filters = { platform: 'all', query: '' };
let catalog;

init();

async function init() {
  try {
    catalog = await loadCatalog();
  } catch (error) {
    console.error(error);
    $('#billboard').hidden = true;
    $('#rows').innerHTML = `<div class="empty"><p>The games could not be loaded. Please refresh the page.</p></div>`;
    return;
  }
  renderStudio();
  renderBillboard();
  renderFilters();
  renderRows();
  addStructuredData(catalog);
  setupTopbar();
  setupLinks();
  setupDetail();
  setupLightbox();
  onRoute(catalog, route);
}

// ---------------------------------------------------------------- shared bits

/** The store to lead with: the visitor's own phone store when the game has it, else the first one. */
function stores(game) {
  return [...game.stores].sort((a, b) => (b.type === device) - (a.type === device));
}

function storeCta(store) {
  return STORE_CTA[store.type] || ['Get it on', store.label];
}

/** The port marker: a solid tag, unlike the genre and badge chips. Empty for Bart's own games. */
function portTag(game) {
  return game.isPort ? `<span class="port-tag">${PORT}${esc(portLabel(game))}<span class="visually-hidden">.</span></span>` : '';
}

/** "Mobile port. Original game by Silver Lemur Games." as a tag plus text. */
function portLine(game, className) {
  return game.isPort
    ? `<p class="${className}">${portTag(game)}<span>Original game by ${esc(game.originalDeveloper)}.</span></p>`
    : '';
}

function tile(game) {
  const icons = [...new Set(game.stores.map(s => s.type))].map(type => icon(type, { size: 14 })).join('');
  return `
    <a class="tile" href="#${esc(game.id)}" data-open="${esc(game.id)}" style="--game-accent:${esc(game.accent)}"
      ${game.media.loop ? `data-loop="${esc(game.media.loop)}"` : ''}>
      <span class="tile-media">
        <img src="${esc(game.media.cover)}" alt="" loading="lazy" decoding="async" width="640" height="360">
        ${portTag(game)}
      </span>
      <span class="tile-info">
        <span class="tile-title">${esc(game.title)}</span>
        <span class="tile-meta"><span class="icons">${icons}</span><span>${esc(releaseLabel(game))}</span>
          ${game.badge ? `<span class="tile-badge">${esc(game.badge)}</span>` : ''}
          <span class="visually-hidden">${esc(game.platformLabels.join(', '))}</span></span>
      </span>
    </a>`;
}

// Links with data-open open the title page in place; modified clicks still open a new tab.
function setupLinks() {
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-open]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (link.dataset.trailer) detail.autoplay = true;
    if (!detail.open) {
      detail.returnFocus = link;
      openGame(link.dataset.open);
      return;
    }
    // Switching games inside the title page replaces the entry, so Esc and Back still return to the list.
    history.replaceState(history.state, '', `#${encodeURIComponent(link.dataset.open)}`);
    dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

// ---------------------------------------------------------------- top bar + studio

function setupTopbar() {
  const bar = $('#topbar');
  const update = () => bar.classList.toggle('is-scrolled', scrollY > 24);
  addEventListener('scroll', update, { passive: true });
  update();
}

function renderStudio() {
  const { studio, games } = catalog;
  $$('[data-studio-name]').forEach(el => { el.textContent = studio.name; });
  $('[data-studio-tagline]').textContent = studio.tagline;
  $('#studio-about').innerHTML = studio.about.map(p => `<p>${esc(p)}</p>`).join('');

  // Counts cover Bart's own games; ports are counted on their own line.
  const own = catalog.originals.length;
  const ports = catalog.ports.length;
  const stats = [...studio.stats, {
    value: String(own),
    label: own === 1 ? 'Own game released' : 'Own games released',
    extra: ports ? `plus ${ports} ${ports === 1 ? 'port' : 'ports'}` : '',
  }];
  $('#stats').innerHTML = stats.map(s => `<div class="stat"><dt>${esc(s.label)}${s.extra
    ? `<span class="stat-extra">${esc(s.extra)}</span>` : ''}</dt><dd>${esc(s.value)}</dd></div>`).join('');

  const email = $('#email-link');
  email.href = `mailto:${studio.email}`;
  $('#email-text').textContent = studio.email;

  $('#studio-links').innerHTML = studio.links.map(link => `
    <li><a href="${esc(link.url)}" target="_blank" rel="noopener">${icon(link.type)}<span>${esc(link.label)}</span></a></li>`).join('');
  $('#copyright').textContent = `© ${new Date().getFullYear()} ${studio.name}`;
  $('#legal').innerHTML = privacyLinks(catalog).map(l => `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`).join('');
}

// ---------------------------------------------------------------- billboard

const billboard = { index: 0, timerOff: false, userPaused: false, hovered: false, offscreen: false, modal: false };

function renderBillboard() {
  const games = catalog.spotlight;
  const root = $('#billboard');
  if (!games.length) { root.hidden = true; return; }

  $('#slides').innerHTML = games.map((game, i) => slideHtml(game, i, games.length)).join('');
  billboard.slides = $$('.slide', root);
  billboard.timerOff = reducedMotion() || games.length < 2;
  root.classList.toggle('is-static', billboard.timerOff);

  if (games.length > 1) {
    $('#billboard-controls').hidden = false;
    $('#progress').innerHTML = games.map((g, i) => `
      <button class="progress-item" type="button" data-slide="${i}" aria-label="Show ${esc(g.title)}">
        <span class="progress-fill"></span>
      </button>`).join('');
    $('#progress').addEventListener('click', e => {
      const btn = e.target.closest('[data-slide]');
      if (btn) showSlide(Number(btn.dataset.slide));
    });
    $('#progress').addEventListener('animationend', () => showSlide(billboard.index + 1));
    $('#pause').addEventListener('click', togglePause);
    setupSwipe($('#slides'), dir => showSlide(billboard.index + dir));
    root.addEventListener('keydown', e => {
      if (e.target.closest('input')) return;
      if (e.key === 'ArrowRight') showSlide(billboard.index + 1);
      if (e.key === 'ArrowLeft') showSlide(billboard.index - 1);
    });
  }

  root.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { billboard.hovered = true; syncBillboard(); } });
  root.addEventListener('pointerleave', () => { billboard.hovered = false; syncBillboard(); });
  // Keyboard focus pauses the rotation; focus put back after a mouse click does not.
  root.addEventListener('focusin', e => { if (e.target.matches(':focus-visible')) { billboard.hovered = true; syncBillboard(); } });
  root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) { billboard.hovered = false; syncBillboard(); } });
  new IntersectionObserver(([entry]) => {
    billboard.offscreen = !entry.isIntersecting;
    syncBillboard();
  }, { threshold: 0.2 }).observe(root);
  document.addEventListener('visibilitychange', syncBillboard);

  $$('.slide-video', root).forEach(video => {
    video.addEventListener('playing', () => video.classList.add('is-playing'));
  });
  showSlide(0);
}

function slideHtml(game, i, count) {
  const m = game.media;
  const lead = stores(game)[0];
  const [verb, name] = lead ? storeCta(lead) : [];
  const useVideo = m.loop && !reducedMotion();
  const facts = [releaseLabel(game), game.genres.join(', ')].filter(Boolean).join(' \u00b7 ');
  const meta = `${game.badge ? `<span class="chip chip-accent">${esc(game.badge)}</span>` : ''}<span>${esc(facts)}</span>`;
  return `
    <article class="slide" data-index="${i}" style="--game-accent:${esc(game.accent)}"
      aria-roledescription="slide" aria-label="${i + 1} of ${count}: ${esc(game.title)}">
      <div class="slide-media">
        <img class="slide-art${useVideo ? '' : ' kenburns'}" src="${esc(m.hero)}" alt="" decoding="async"
          ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>
        ${useVideo ? `<video class="slide-video" muted loop playsinline preload="none" disablepictureinpicture
          poster="${esc(m.loopPoster || m.hero)}" data-src="${esc(m.loop)}"></video>` : ''}
      </div>
      <div class="slide-shade"></div>
      <div class="slide-content">
        <h2 class="slide-heading">${m.logo
          ? `<img class="slide-logo" src="${esc(m.logo)}" alt="${esc(game.title)}" decoding="async">`
          : `<span class="slide-title">${esc(game.title)}</span>`}</h2>
        ${portLine(game, 'slide-port')}
        <p class="slide-meta">${meta}</p>
        <p class="slide-tagline">${esc(game.tagline)}</p>
        <p class="slide-summary">${esc(game.summary)}</p>
        <div class="slide-actions">
          ${lead ? `<a class="btn btn-primary" href="${esc(lead.url)}" target="_blank" rel="noopener">
            ${icon(lead.type)}<span>${esc(verb)} ${esc(name)}</span></a>` : ''}
          ${m.trailer ? `<a class="btn btn-glass" href="#${esc(game.id)}" data-open="${esc(game.id)}" data-trailer="1">
            ${icon('play')}<span>Watch trailer</span></a>` : ''}
          <a class="btn btn-glass" href="#${esc(game.id)}" data-open="${esc(game.id)}">${INFO}<span>More info</span></a>
        </div>
      </div>
    </article>`;
}

function showSlide(next) {
  const { slides } = billboard;
  const count = slides.length;
  billboard.index = (next + count) % count;
  slides.forEach((slide, i) => {
    const active = i === billboard.index;
    slide.classList.toggle('is-active', active);
    slide.inert = !active;
    slide.setAttribute('aria-hidden', String(!active));
    // Restart the Ken Burns pan each time a slide comes back.
    const art = $('.kenburns', slide);
    if (art && active) { art.style.animation = 'none'; void art.offsetWidth; art.style.animation = ''; }
  });
  $$('.progress-item').forEach((item, i) => {
    item.classList.remove('is-active');
    item.classList.toggle('is-done', i < billboard.index);
    item.setAttribute('aria-current', String(i === billboard.index));
  });
  const current = $$('.progress-item')[billboard.index];
  if (current) { void current.offsetWidth; current.classList.add('is-active'); }
  syncBillboard();
}

function togglePause() {
  billboard.userPaused = !billboard.userPaused;
  const btn = $('#pause');
  btn.setAttribute('aria-pressed', String(billboard.userPaused));
  $('.visually-hidden', btn).textContent = billboard.userPaused ? 'Play rotation' : 'Pause rotation';
  syncBillboard();
}

/** Rotation pauses on hover, focus, user pause, off-screen, hidden tab or open title page. Video only stops for the last three. */
function syncBillboard() {
  if (!billboard.slides) return;
  const visible = !billboard.offscreen && !document.hidden && !billboard.modal;
  const rotating = visible && !billboard.timerOff && !billboard.userPaused && !billboard.hovered;
  $('#billboard').classList.toggle('is-paused', !rotating);
  billboard.slides.forEach((slide, i) => {
    const video = $('.slide-video', slide);
    if (!video) return;
    if (i === billboard.index && visible) {
      if (!video.src) video.src = video.dataset.src;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
}

function setupSwipe(el, onSwipe) {
  let start = null;
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') start = { x: e.clientX, y: e.clientY }; });
  el.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) onSwipe(dx < 0 ? 1 : -1);
  });
  el.addEventListener('pointercancel', () => { start = null; });
}

// ---------------------------------------------------------------- filters + rows

function renderFilters() {
  const box = $('#platform-filter');
  if (catalog.platforms.length < 2) return;
  const options = [['all', 'All'], ...catalog.platforms.map(p => [p, PLATFORM_FILTERS[p] || p])];
  box.innerHTML = options.map(([value, label]) =>
    `<button type="button" data-platform="${value}" aria-pressed="${value === filters.platform}">${esc(label)}</button>`).join('');
  box.addEventListener('click', e => {
    const btn = e.target.closest('[data-platform]');
    if (!btn) return;
    filters.platform = btn.dataset.platform;
    $$('button', box).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    renderRows();
  });

  const search = $('#search');
  if (catalog.games.length < 6) { search.closest('.search').hidden = true; return; }
  search.addEventListener('input', () => { filters.query = search.value; renderRows(); });
}

function buildRows(list) {
  const featured = list.filter(g => g.featured);
  const rows = [];
  const add = (title, games, min = 1, compact = false) => {
    if (games.length < min) return;
    const key = games.map(g => g.id).join();
    if (rows.some(r => r.key === key)) return;
    rows.push({ title, games, key, compact });
  };

  // Bart's own games lead; ports get a row of their own.
  const own = featured.filter(g => !g.isPort);
  const ports = list.filter(g => g.isPort);
  add(filters.platform === 'all' ? 'Latest releases' : PLATFORM_ROWS[filters.platform] || 'Games', own);
  add(portsTitle(ports), ports);
  if (filters.platform === 'all') {
    add('On PC', featured.filter(g => g.platforms.includes('pc')), 2);
    add('On iPhone and Android', featured.filter(g => g.platforms.some(p => p === 'ios' || p === 'android')), 2);
  }
  // A genre row has to be a real slice of the library: 3 or more games, but not nearly all of them.
  let genreRows = 0;
  for (const group of GENRE_ROWS) {
    if (genreRows >= 4) break;
    const games = featured.filter(g => g.genres.some(x => group.test.test(x)));
    if (games.length > featured.length * 0.7) continue;
    const before = rows.length;
    add(group.title, games, 3);
    genreRows += rows.length - before;
  }
  add('Earlier games', list.filter(g => !g.featured && !g.isPort), 1, true);
  return rows;
}

function portsTitle(ports) {
  const platforms = new Set(ports.flatMap(g => g.platforms));
  const ios = platforms.has('ios');
  const android = platforms.has('android');
  if (platforms.size === 2 && ios && android) return 'Ported to iPhone and Android';
  if (platforms.size === 1 && ios) return 'Ported to iPhone and iPad';
  if (platforms.size === 1 && android) return 'Ported to Android';
  return 'Ports';
}

function renderRows() {
  const box = $('#rows');
  const list = catalog.games.filter(g => filters.platform === 'all' || g.platforms.includes(filters.platform));
  const query = filters.query.trim().toLowerCase();
  const status = $('#library-status');

  if (query) {
    const hits = list.filter(g => [g.title, g.subtitle, ...g.genres].join(' ').toLowerCase().includes(query));
    status.textContent = `${hits.length} ${hits.length === 1 ? 'game' : 'games'} found`;
    box.innerHTML = hits.length
      ? `<div class="row"><div class="row-head"><h3 class="row-title">Results</h3><span class="row-count">${hits.length}</span></div>
          <div class="results">${hits.map(tile).join('')}</div></div>`
      : `<div class="empty"><p>No games match “${esc(filters.query.trim())}”.</p>
          <button class="btn btn-glass" type="button" data-clear>Clear search</button></div>`;
    $('[data-clear]', box)?.addEventListener('click', () => {
      $('#search').value = '';
      filters.query = '';
      renderRows();
      $('#search').focus();
    });
  } else {
    const rows = buildRows(list);
    status.textContent = `${list.length} ${list.length === 1 ? 'game' : 'games'}`;
    box.innerHTML = rows.length ? rows.map(rowHtml).join('') : `<div class="empty"><p>No games here yet.</p></div>`;
    $$('.row-viewport', box).forEach(setupRowArrows);
  }
  $$('.tile', box).forEach(setupPreview);
}

function rowHtml(row, i) {
  const id = `row-${i}`;
  return `
    <section class="row${row.compact ? ' row--compact' : ''}" aria-labelledby="${id}">
      <div class="row-head"><h3 class="row-title" id="${id}">${esc(row.title)}</h3>
        <span class="row-count">${row.games.length}</span></div>
      <div class="row-viewport">
        <button class="row-arrow prev" type="button" tabindex="-1" aria-hidden="true" hidden>${ARROW_LEFT}</button>
        <div class="row-track">${row.games.map(tile).join('')}</div>
        <button class="row-arrow next" type="button" tabindex="-1" aria-hidden="true" hidden>${ARROW_RIGHT}</button>
      </div>
    </section>`;
}

// Mouse users get arrows; keyboard users tab through tiles and the row scrolls to follow focus.
function setupRowArrows(viewport) {
  const track = $('.row-track', viewport);
  const prev = $('.prev', viewport);
  const next = $('.next', viewport);
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    prev.hidden = track.scrollLeft < 8;
    next.hidden = track.scrollLeft > max - 8;
  };
  const page = dir => track.scrollBy({ left: dir * track.clientWidth * 0.85, behavior: reducedMotion() ? 'auto' : 'smooth' });
  prev.addEventListener('click', () => page(-1));
  next.addEventListener('click', () => page(1));
  track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  new ResizeObserver(update).observe(track);
}

// Hovering a tile for a moment plays its silent loop, desktop only.
function setupPreview(tileEl) {
  const src = tileEl.dataset.loop;
  if (!src) return;
  let timer;
  tileEl.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'mouse' || !canHover.matches || reducedMotion()) return;
    timer = setTimeout(() => {
      const video = document.createElement('video');
      Object.assign(video, { src, muted: true, loop: true, playsInline: true, autoplay: true });
      video.setAttribute('aria-hidden', 'true');
      video.addEventListener('playing', () => video.classList.add('is-playing'));
      $('.tile-media', tileEl).append(video);
    }, 450);
  });
  tileEl.addEventListener('pointerleave', () => {
    clearTimeout(timer);
    $('video', tileEl)?.remove();
  });
}

// ---------------------------------------------------------------- title page

const detail = $('#detail');

function setupDetail() {
  $('#detail-close').addEventListener('click', () => closeGame());
  detail.addEventListener('cancel', e => { e.preventDefault(); closeGame(); });
  detail.addEventListener('click', e => { if (e.target === detail) closeGame(); });
  detail.addEventListener('close', () => {
    teardownDetail();
    // The browser can force a dialog closed (Esc pressed twice); bring the URL back in step without reopening it.
    if (!catalog.byId.has(decodeURIComponent(location.hash.slice(1)))) return;
    if (history.state?.fromList) history.back();
    else history.replaceState(null, '', location.pathname + location.search);
  });
}

function route(game) {
  if (game) {
    if (detail.gameId !== game.id) renderDetail(game);
    if (!detail.open) {
      detail.returnFocus ||= document.activeElement;
      detail.showModal();
      document.documentElement.classList.add('modal-open');
    }
    setPageMeta(game, catalog.studio);
    billboard.modal = true;
    syncBillboard();
    if (detail.autoplay) { detail.autoplay = false; startTrailer(game); }
  } else {
    if (detail.open) detail.close();
    setPageMeta(null, catalog.studio);
  }
}

function teardownDetail() {
  const trailer = $('.tp-trailer', detail);
  if (trailer) stopTrailer(trailer);
  $$('video', detail).forEach(v => v.pause());
  $('#detail-body').innerHTML = '';
  detail.gameId = null;
  detail.autoplay = false;
  document.documentElement.classList.remove('modal-open');
  billboard.modal = false;
  syncBillboard();
  const back = detail.returnFocus;
  detail.returnFocus = null;
  if (back?.isConnected) back.focus({ preventScroll: true });
  else $('#games').focus({ preventScroll: true });
}

function renderDetail(game) {
  const old = $('.tp-trailer', detail);
  if (old) stopTrailer(old);
  detail.gameId = game.id;
  detail.style.setProperty('--game-accent', game.accent);
  const m = game.media;
  const loop = m.loop && !reducedMotion();
  const chips = [
    game.badge && `<li class="chip chip-accent">${esc(game.badge)}</li>`,
    `<li class="chip">${esc(releaseLabel(game))}</li>`,
    ...game.platformLabels.map(p => `<li class="chip">${esc(p)}</li>`),
  ].filter(Boolean).join('');
  const links = [
    game.website && `<li><a href="${esc(game.website)}">${icon('web', { size: 16 })}Official game page</a></li>`,
    game.privacy && `<li><a href="${esc(game.privacy)}">Privacy policy</a></li>`,
  ].filter(Boolean).join('');

  $('#detail-body').innerHTML = `
    <div class="tp-media">
      <img class="tp-art" src="${esc(m.hero)}" alt="" decoding="async">
      ${loop ? `<video class="tp-loop" src="${esc(m.loop)}" poster="${esc(m.loopPoster || m.hero)}" muted loop playsinline autoplay
        disablepictureinpicture aria-hidden="true"></video>` : ''}
      <div class="tp-shade"></div>
      <div class="tp-heading">
        ${m.logo ? `<img class="tp-logo" src="${esc(m.logo)}" alt="" decoding="async">` : ''}
        <h2 class="${m.logo ? 'visually-hidden' : 'tp-title'}" id="detail-title">${esc(game.title)}</h2>
        ${game.subtitle ? `<p class="tp-subtitle">${esc(game.subtitle)}</p>` : ''}
        ${portLine(game, 'tp-port')}
      </div>
      ${m.trailer ? `<button class="tp-play" type="button"><span class="tp-play-icon">${icon('play')}</span>Watch trailer</button>` : ''}
    </div>

    <div class="tp-body">
      <div class="tp-summary">
        <p class="tp-tagline">${esc(game.tagline)}</p>
        <ul class="chips" aria-label="Facts">${chips}</ul>
      </div>
      <div class="tp-actions">
        <div class="store-list">${stores(game).map(storeButton).join('')}</div>
        ${links ? `<ul class="tp-links">${links}</ul>` : ''}
      </div>
      <div class="tp-about">
        ${(game.description.length ? game.description : [game.summary]).map(p => `<p>${esc(p)}</p>`).join('')}
        ${game.features.length ? `<h3 class="tp-h3">Features</h3>
          <ul class="features">${game.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      </div>
      <aside class="tp-aside" aria-label="Details">
        ${game.highlights.length ? `<div class="aside-block"><p class="aside-label">Highlights</p>
          <ul class="highlights">${game.highlights.map(h => `<li>${STAR}<span>${esc(h)}</span></li>`).join('')}</ul></div>` : ''}
        ${game.genres.length ? `<div class="aside-block"><p class="aside-label">Genres</p>
          <ul class="genre-list">${game.genres.map(g => `<li class="chip">${esc(g)}</li>`).join('')}</ul></div>` : ''}
        ${game.credits ? `<div class="aside-block"><p class="aside-label">Credits</p><p class="credits">${esc(game.credits)}</p></div>` : ''}
      </aside>
    </div>

    ${m.screenshots.length ? `
      <section class="tp-section" aria-labelledby="shots-title">
        <h3 class="tp-h3" id="shots-title">Screenshots</h3>
        <div class="shots">${m.screenshots.map((s, i) => `
          <button class="shot" type="button" data-shot="${i}" aria-label="Open screenshot ${i + 1} of ${m.screenshots.length}">
            <img src="${esc(s.src)}" alt="" width="${s.w}" height="${s.h}" loading="lazy" decoding="async" style="aspect-ratio:${s.w} / ${s.h}">
          </button>`).join('')}</div>
      </section>` : ''}

    ${moreGames(game)}`;

  const loopVideo = $('.tp-loop', detail);
  loopVideo?.addEventListener('playing', () => loopVideo.classList.add('is-playing'));
  $('.tp-play', detail)?.addEventListener('click', () => startTrailer(game));
  $$('.shot', detail).forEach(btn => btn.addEventListener('click', () => openLightbox(game, Number(btn.dataset.shot), btn)));
  $$('.tile', detail).forEach(setupPreview);
  $('.title-page-inner', detail).scrollTop = 0;
  $('#detail-close').focus({ preventScroll: true });
}

function storeButton(store) {
  const [verb, name] = storeCta(store);
  return `<a class="store-btn" href="${esc(store.url)}" target="_blank" rel="noopener">
    ${icon(store.type)}<span><small>${esc(verb)}</small><strong>${esc(name)}</strong></span>${EXTERNAL}</a>`;
}

function moreGames(game) {
  const score = other =>
    other.genres.filter(g => game.genres.includes(g)).length * 2 +
    other.platforms.filter(p => game.platforms.includes(p)).length +
    (other.featured ? 2 : 0);
  const picks = catalog.games
    .filter(g => g.id !== game.id)
    .map(g => ({ g, s: score(g) }))
    .sort((a, b) => b.s - a.s || b.g.sortKey.localeCompare(a.g.sortKey))
    .slice(0, 8)
    .map(x => x.g);
  if (!picks.length) return '';
  return `
    <section class="tp-section" aria-labelledby="more-title">
      <h3 class="tp-h3" id="more-title">More games</h3>
      <div class="row-track" style="padding-inline:var(--tp-pad);scroll-padding-inline:var(--tp-pad)">${picks.map(tile).join('')}</div>
    </section>`;
}

async function startTrailer(game) {
  const media = $('.tp-media', detail);
  if (!media || !game.media.trailer) return;
  let video = $('.tp-trailer', media);
  if (!video) {
    $('.tp-loop', media)?.remove();
    video = document.createElement('video');
    video.className = 'tp-trailer';
    video.setAttribute('aria-label', `${game.title} trailer`);
    video.poster = game.media.loopPoster || game.media.hero;
    media.append(video);
  }
  media.classList.add('is-playing');
  video.focus({ preventScroll: true });
  await playTrailer(video, game.media.trailer);
}

// ---------------------------------------------------------------- lightbox

const lightbox = $('#lightbox');
const shotState = { game: null, index: 0, from: null };

function setupLightbox() {
  $('#lightbox-close').addEventListener('click', () => lightbox.close());
  $('#lightbox-prev').addEventListener('click', () => showShot(shotState.index - 1));
  $('#lightbox-next').addEventListener('click', () => showShot(shotState.index + 1));
  lightbox.addEventListener('click', e => { if (e.target === lightbox || e.target.classList.contains('lightbox-figure')) lightbox.close(); });
  lightbox.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') showShot(shotState.index + 1);
    if (e.key === 'ArrowLeft') showShot(shotState.index - 1);
  });
  lightbox.addEventListener('close', () => shotState.from?.focus({ preventScroll: true }));
  setupSwipe($('.lightbox-figure', lightbox), dir => showShot(shotState.index + dir));
}

function openLightbox(game, index, from) {
  Object.assign(shotState, { game, from });
  const many = game.media.screenshots.length > 1;
  $('#lightbox-prev').hidden = !many;
  $('#lightbox-next').hidden = !many;
  showShot(index);
  lightbox.showModal();
}

function showShot(index) {
  const shots = shotState.game.media.screenshots;
  shotState.index = (index + shots.length) % shots.length;
  const shot = shots[shotState.index];
  const img = $('#lightbox-img');
  img.src = shot.src;
  img.width = shot.w;
  img.height = shot.h;
  img.alt = `${shotState.game.title}, screenshot ${shotState.index + 1}`;
  $('#lightbox-caption').textContent = `${shotState.index + 1} / ${shots.length}`;
}
