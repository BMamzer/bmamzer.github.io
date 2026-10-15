// Grimoire design: renders the catalog from games.json into the stage, the game panels, the chronicle and the codex.
import {
  loadCatalog, icon, esc, releaseLabel, onRoute, openGame, closeGame, playTrailer, stopTrailer,
  reducedMotion, setPageMeta, addStructuredData, privacyLinks, portLabel, PLATFORM_LABELS,
} from '/assets/site/catalog.js';

const $ = (sel, root = document) => root.querySelector(sel);
const SLIDE_MS = 9000;
const PAGE_SIZE = 8;
const hoverDevice = matchMedia('(hover: hover) and (pointer: fine)');

let catalog;
try {
  catalog = await loadCatalog();
} catch (err) {
  $('[data-grid]').innerHTML = '<p class="empty">The games could not be loaded. Please refresh the page.</p>';
  throw err;
}
const { studio } = catalog;

// ---------------------------------------------------------------- shared bits

const dot = '<span class="dot" aria-hidden="true">&#9670;</span>';

// Paragraphs with an illuminated first letter. A span (not ::first-letter) keeps "I'm" from losing its apostrophe.
function illuminated(paragraphs) {
  return paragraphs.map((p, i) => {
    const text = esc(p);
    if (i > 0 || !/^[A-Za-z]/.test(p)) return `<p>${text}</p>`;
    return `<p><span class="dropcap">${text[0]}</span>${text.slice(1)}</p>`;
  }).join('');
}

function metaLine(game, { month = false } = {}) {
  const parts = [`<span>${esc(releaseLabel(game, { month }))}</span>`];
  if (game.platformLabels.length) parts.push(`<span>${esc(game.platformLabels.join(', '))}</span>`);
  return parts.join(dot);
}

// Ports wear a silver seal, set apart from the gold genre runes and badges.
const PORT_GLYPH = '<svg class="port-glyph" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 8h14m-4-4 4 4-4 4M20 16H6m4-4-4 4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function portMark(game) {
  return game.isPort ? `<span class="port-mark">${PORT_GLYPH}<span>${esc(portLabel(game))}</span></span>` : '';
}

function portLine(game, cls = 'port-line') {
  if (!game.isPort) return '';
  return `<p class="${cls}">${portMark(game)}<span class="port-by">Original game by ${esc(game.originalDeveloper)}</span></p>`;
}

// "5 games, 2 ports": Bart's own games are counted apart from the ports.
function countLabel(games) {
  const own = games.filter(g => !g.isPort).length;
  const ports = games.length - own;
  const parts = [];
  if (own || !ports) parts.push(`${own} ${own === 1 ? 'game' : 'games'}`);
  if (ports) parts.push(`${ports} ${ports === 1 ? 'port' : 'ports'}`);
  return parts.join(', ');
}

function storeIcons(game) {
  return game.stores.map(s => `
    <a class="icon-btn" href="${esc(s.url)}" target="_blank" rel="noopener"
       aria-label="${esc(game.title)} on ${esc(s.label)}" title="${esc(s.label)}">${icon(s.type)}</a>`).join('');
}

// Plain clicks open the codex in place; modified clicks keep normal link behaviour.
document.addEventListener('click', e => {
  const link = e.target.closest('a[data-open]');
  if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  openGame(link.dataset.open);
});

function toRoman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, r] of map) while (n >= v) { out += r; n -= v; }
  return out;
}

// ---------------------------------------------------------------- studio, chronicle, contact, footer

function renderStudio() {
  $('[data-since]').textContent = studio.since ? `Independent games since ${studio.since}` : 'Independent games';
  $('[data-studio-tagline]').textContent = studio.tagline;
  $('[data-about]').innerHTML = illuminated(studio.about);

  const ports = catalog.ports.length;
  const stats = [...studio.stats, {
    value: String(catalog.originals.length),
    label: ports ? `Own games released, plus ${ports} ${ports === 1 ? 'port' : 'ports'}` : 'Games released',
  }];
  $('[data-stats]').innerHTML = stats.map(s => `
    <div class="stat"><dt>${esc(s.value)}</dt><dd>${esc(s.label)}</dd></div>`).join('');

  const years = new Map();
  for (const g of [...catalog.games].reverse()) years.set(g.year, [...(years.get(g.year) || []), g]);
  $('[data-timeline]').innerHTML = [...years].map(([year, games]) => `
    <li class="tl-item">
      <span class="tl-year">${year}</span>
      <span class="tl-games">${games.map(g => `<a href="${g.url}" data-open="${esc(g.id)}">${esc(g.title)}${g.isPort ? `<span class="port-mini">${PORT_GLYPH}${esc(portLabel(g))}</span>` : ''}</a>`).join('')}</span>
    </li>`).join('');

  $('[data-mail]').innerHTML = `<a href="mailto:${esc(studio.email)}">${icon('mail', { size: 22 })}<span>${esc(studio.email)}</span></a>`;
  $('[data-links]').innerHTML = studio.links.map(l => `
    <li><a href="${esc(l.url)}" target="_blank" rel="noopener me">${icon(l.type)}<span>${esc(l.label)}</span></a></li>`).join('');

  $('[data-legal]').innerHTML = privacyLinks(catalog).map(l => `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`).join('');
  $('[data-copy]').textContent = `© ${new Date().getFullYear()} ${studio.name}${studio.location ? `. Made in ${studio.location}.` : ''}`;
}

// ---------------------------------------------------------------- stage

function initStage() {
  const stage = $('.stage');
  const art = $('.stage-art', stage);
  const box = $('.stage-game', stage);
  const tabs = $('.stage-tabs', stage);
  const pauseBtn = $('.stage-pause', stage);
  const games = catalog.spotlight;
  let index = 0;
  let timer = 0;
  let userPaused = reducedMotion();
  let visible = true;

  stage.style.setProperty('--slide-time', `${SLIDE_MS}ms`);
  art.innerHTML = games.map((g, i) => `<div class="slide" data-i="${i}"><img alt="" decoding="async" ${i === 0 ? `src="${esc(g.media.hero)}" fetchpriority="high"` : `data-src="${esc(g.media.hero)}"`}></div>`).join('');
  tabs.innerHTML = games.map((g, i) => `
    <button class="stage-tab" type="button" data-i="${i}" aria-label="Show ${esc(g.title)}${g.isPort ? `, ${esc(portLabel(g).toLowerCase())}` : ''}">
      <span class="num" aria-hidden="true">${toRoman(i + 1)}</span><span class="name" aria-hidden="true">${esc(g.title)}${g.isPort ? PORT_GLYPH : ''}</span>
    </button>`).join('');
  if (games.length < 2) $('.stage-controls', stage).hidden = true;

  const slides = [...art.children];
  const load = i => { const img = slides[i]?.querySelector('img[data-src]'); if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); } };

  function render(game) {
    box.style.setProperty('--accent', game.accent);
    box.innerHTML = `
      <p class="sg-label"><span class="featured">Featured</span>${dot}${metaLine(game)}</p>
      <h2 class="sg-title">${game.media.logo ? `<img src="${esc(game.media.logo)}" alt="${esc(game.title)}">` : esc(game.title)}</h2>
      ${portLine(game)}
      <p class="sg-tagline">${esc(game.tagline)}</p>
      <div class="sg-actions">
        <a class="btn btn-primary" href="${game.url}" data-open="${esc(game.id)}">Explore<span class="visually-hidden"> ${esc(game.title)}</span></a>
        ${storeIcons(game)}
      </div>`;
  }

  function show(i, { animate = true } = {}) {
    index = (i + games.length) % games.length;
    load(index);
    load((index + 1) % games.length);
    slides.forEach((s, n) => s.classList.toggle('on', n === index));
    [...tabs.children].forEach((t, n) => t.setAttribute('aria-current', n === index ? 'true' : 'false'));
    if (animate && !reducedMotion()) {
      box.classList.add('swap');
      setTimeout(() => { render(games[index]); box.classList.remove('swap'); }, 350);
    } else {
      render(games[index]);
    }
    restartProgress();
    schedule();
  }

  // Restart the CSS progress bar on the active tab.
  function restartProgress() {
    const active = tabs.children[index];
    if (!active) return;
    active.style.animation = 'none';
    void active.offsetWidth;
    active.style.animation = '';
  }

  function schedule() {
    clearTimeout(timer);
    const running = !userPaused && visible && !document.hidden && games.length > 1;
    stage.classList.toggle('paused', !running);
    if (running) timer = setTimeout(() => show(index + 1), SLIDE_MS);
  }

  tabs.addEventListener('click', e => {
    const tab = e.target.closest('.stage-tab');
    if (tab) show(Number(tab.dataset.i));
  });
  pauseBtn.addEventListener('click', () => {
    userPaused = !userPaused;
    pauseBtn.setAttribute('aria-pressed', String(userPaused));
    pauseBtn.querySelector('.visually-hidden').textContent = userPaused ? 'Play the slideshow' : 'Pause the slideshow';
    schedule();
  });
  pauseBtn.setAttribute('aria-pressed', String(userPaused));
  if (userPaused) pauseBtn.querySelector('.visually-hidden').textContent = 'Play the slideshow';

  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }, { threshold: 0.25 }).observe(stage);
  document.addEventListener('visibilitychange', schedule);

  show(0, { animate: false });
  initEmbers($('.embers', stage), stage);
}

// Drifting embers over the stage. Off for reduced motion, paused when off screen or in a background tab.
function initEmbers(canvas, host) {
  if (reducedMotion()) return;
  const ctx = canvas.getContext('2d');
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const sc = sprite.getContext('2d');
  const grad = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 240, 200, 1)');
  grad.addColorStop(0.18, 'rgba(255, 170, 80, 0.9)');
  grad.addColorStop(0.45, 'rgba(255, 110, 40, 0.25)');
  grad.addColorStop(1, 'rgba(255, 90, 20, 0)');
  sc.fillStyle = grad;
  sc.fillRect(0, 0, 64, 64);

  let w = 0, h = 0, parts = [], raf = 0, last = 0, onScreen = true;

  const spawn = (anywhere) => ({
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 20,
    size: 3 + Math.random() * 9,
    speed: 14 + Math.random() * 34,
    phase: Math.random() * Math.PI * 2,
    drift: 0.3 + Math.random() * 1.1,
    sway: 6 + Math.random() * 22,
    age: 0,
    life: 5 + Math.random() * 9,
  });

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    parts = Array.from({ length: Math.round(Math.min(80, (w * h) / 17000)) }, () => spawn(true));
  }

  function frame(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      p.age += dt;
      p.y -= p.speed * dt;
      p.phase += p.drift * dt;
      const x = p.x + Math.sin(p.phase) * p.sway;
      const fadeIn = Math.min(1, p.age / 1.2);
      const fadeOut = Math.max(0, 1 - p.age / p.life);
      const height = Math.min(1, Math.max(0, p.y / h) * 1.6);
      ctx.globalAlpha = fadeIn * fadeOut * height * (0.55 + 0.45 * Math.sin(t / 240 + p.phase * 3) ** 2);
      ctx.drawImage(sprite, x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      if (p.age > p.life || p.y < -20) Object.assign(p, spawn(false));
    }
    raf = requestAnimationFrame(frame);
  }

  const run = () => {
    cancelAnimationFrame(raf);
    if (onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; run(); }).observe(host);
  document.addEventListener('visibilitychange', run);
  resize();
  run();
}

// ---------------------------------------------------------------- games grid and filters

function initFilters() {
  const state = { platform: 'all', genre: 'all', limit: PAGE_SIZE, portLimit: PAGE_SIZE };
  const tabBox = $('[data-platforms]');
  const select = $('[data-genre]');
  const moreBtn = $('[data-more]');
  const portsMore = $('[data-ports-more]');

  if (catalog.platforms.length > 1) {
    tabBox.innerHTML = [['all', 'All'], ...catalog.platforms.map(p => [p, PLATFORM_LABELS[p] || p])]
      .map(([key, label]) => `<button class="tab" type="button" data-platform="${key}" aria-pressed="${key === 'all'}">${esc(label)}</button>`)
      .join('');
  } else {
    tabBox.hidden = true;
  }

  const genres = [...catalog.genres].sort((a, b) => a.localeCompare(b));
  if (genres.length > 3) {
    select.innerHTML = `<option value="all">All genres</option>${genres.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}`;
  } else {
    $('[data-genre-wrap]').hidden = true;
  }

  tabBox.addEventListener('click', e => {
    const btn = e.target.closest('[data-platform]');
    if (!btn) return;
    state.platform = btn.dataset.platform;
    state.limit = state.portLimit = PAGE_SIZE;
    tabBox.querySelectorAll('[data-platform]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    update();
  });
  select.addEventListener('change', () => { state.genre = select.value; state.limit = state.portLimit = PAGE_SIZE; update(); });
  moreBtn.addEventListener('click', () => {
    const firstNew = state.limit;
    state.limit = Infinity;
    update();
    $('[data-grid]').children[firstNew]?.querySelector('.card-title a')?.focus();
  });
  portsMore.addEventListener('click', () => {
    const firstNew = state.portLimit;
    state.portLimit = Infinity;
    update();
    $('[data-ports-grid]').children[firstNew]?.querySelector('.card-title a')?.focus();
  });
  $('[data-reset]').addEventListener('click', () => {
    state.platform = 'all';
    state.genre = 'all';
    select.value = 'all';
    tabBox.querySelectorAll('[data-platform]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.platform === 'all')));
    update();
  });

  const matches = g => (state.platform === 'all' || g.platforms.includes(state.platform))
    && (state.genre === 'all' || g.genres.includes(state.genre));

  // Bart's own games lead; ports follow in their own group; older titles go to the archive.
  function update() {
    const own = catalog.featured.filter(g => !g.isPort && matches(g));
    const ports = catalog.featured.filter(g => g.isPort && matches(g));
    const earlier = catalog.earlier.filter(matches);
    const all = [...own, ...ports, ...earlier];

    renderGrid($('[data-grid]'), own.slice(0, state.limit));
    moreBtn.hidden = own.length <= state.limit;
    moreBtn.textContent = `Show all ${own.length} games`;

    $('[data-ports]').hidden = !ports.length;
    renderGrid($('[data-ports-grid]'), ports.slice(0, state.portLimit));
    portsMore.hidden = ports.length <= state.portLimit;
    portsMore.textContent = `Show all ${ports.length} ports`;

    renderArchive(earlier);
    $('[data-empty]').hidden = all.length > 0;
    const filtered = state.platform !== 'all' || state.genre !== 'all';
    $('[data-count]').textContent = filtered ? `${countLabel(all)} match` : countLabel(all);
  }

  update();
  for (const mq of ['(min-width: 720px)', '(min-width: 1100px)']) matchMedia(mq).addEventListener('change', layoutGrids);
}

function renderGrid(grid, games) {
  grid.innerHTML = games.map((g, i) => `
    <article class="card" style="--accent:${esc(g.accent)}" data-id="${esc(g.id)}">
      <div class="card-media">
        <img src="${esc(g.media.cover)}" alt="" width="1280" height="720" ${i < 2 ? '' : 'loading="lazy"'} decoding="async">
        ${g.badge ? `<span class="card-badge">${esc(g.badge)}</span>` : ''}
      </div>
      <div class="card-body">
        <p class="meta">${metaLine(g)}</p>
        ${portLine(g)}
        <h3 class="card-title"><a href="${g.url}" data-open="${esc(g.id)}">${esc(g.title)}</a></h3>
        ${g.subtitle ? `<p class="card-sub">${esc(g.subtitle)}</p>` : ''}
        <p class="card-tagline">${esc(g.tagline)}</p>
        <p class="card-summary">${esc(g.summary)}</p>
        <ul class="runes" aria-label="Genres">${g.genres.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>
    </article>`).join('');
  [...grid.children].forEach((card, i) => hoverLoop(card, games[i]));
  layoutGrid(grid);
}

function layoutGrids() {
  document.querySelectorAll('.grid').forEach(layoutGrid);
}

// Makes every row full: on desktop (3 per row) the first card spans the row or the first two share it.
function layoutGrid(grid) {
  const cards = [...grid.children];
  const n = cards.length;
  cards.forEach(c => c.classList.remove('wide', 'big'));
  if (!n) return;
  if (matchMedia('(min-width: 1100px)').matches) {
    if (n % 3 === 1) cards[0].classList.add('wide');
    if (n % 3 === 2) cards.slice(0, 2).forEach(c => c.classList.add('big'));
  } else if (matchMedia('(min-width: 720px)').matches && n % 2 === 1) {
    cards[0].classList.add('wide');
  }
}

// On desktop, hovering a panel plays its silent trailer loop.
function hoverLoop(card, game) {
  if (!game.media.loop || reducedMotion() || !hoverDevice.matches) return;
  let video;
  card.addEventListener('pointerenter', () => {
    if (!video) {
      video = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, preload: 'auto' });
      video.className = 'card-loop';
      video.setAttribute('aria-hidden', 'true');
      video.src = game.media.loop;
      video.addEventListener('playing', () => video.classList.add('on'), { once: true });
      card.querySelector('.card-media').append(video);
    }
    card.classList.add('looping');
    video.play().catch(() => {});
  });
  card.addEventListener('pointerleave', () => {
    card.classList.remove('looping');
    video?.pause();
  });
}

function renderArchive(games) {
  $('[data-archive]').hidden = !games.length;
  $('[data-archive-list]').innerHTML = games.map(g => `
    <li class="relic">
      <img src="${esc(g.media.icon || g.media.cover)}" alt="" width="64" height="64" loading="lazy" decoding="async">
      <div class="relic-text">
        <h4><a href="${g.url}" data-open="${esc(g.id)}">${esc(g.title)}</a></h4>
        <p class="meta">${metaLine(g)}</p>
        ${portLine(g)}
        <p>${esc(g.tagline)}</p>
      </div>
    </li>`).join('');
}

// ---------------------------------------------------------------- top bar

function initTopbar() {
  const bar = $('.topbar');
  const update = () => bar.classList.toggle('scrolled', scrollY > 40);
  addEventListener('scroll', update, { passive: true });
  update();
}

// ---------------------------------------------------------------- codex (game detail)

let codex, page, current = null, opener = null, shots = [], shotIndex = 0, shotOpener = null;

function initCodex() {
  codex = $('[data-codex]');
  page = $('[data-codex-page]');
  $('[data-close]').addEventListener('click', () => closeGame());
  codex.addEventListener('cancel', e => { e.preventDefault(); closeGame(); });

  page.addEventListener('click', e => {
    const play = e.target.closest('[data-play]');
    if (play) startTrailer(play.closest('.plate-inner'));
    const shot = e.target.closest('[data-shot]');
    if (shot) openLightbox(Number(shot.dataset.shot), shot);
    const step = e.target.closest('a[data-step]');
    if (step && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      // Browsing between games replaces the entry, so closing still returns to the list.
      e.preventDefault();
      history.replaceState(history.state, '', `#${encodeURIComponent(step.dataset.step)}`);
      dispatchEvent(new HashChangeEvent('hashchange'));
    }
  });

  initLightbox();
}

function showCodex(game) {
  if (current?.id === game.id && codex.open) return;
  if (!codex.open) opener = document.activeElement;
  current = game;
  stopCurrentTrailer();
  renderCodex(game);
  setPageMeta(game, studio);
  if (!codex.open) {
    document.documentElement.classList.add('locked');
    codex.showModal();
  }
  $('.codex-scroll', codex).scrollTop = 0;
  $('[data-close]').focus();
}

function hideCodex() {
  if (!codex.open) return;
  stopCurrentTrailer();
  codex.close();
  page.innerHTML = '';
  document.documentElement.classList.remove('locked');
  setPageMeta(null, studio);
  const card = current && document.querySelector(`[data-open="${CSS.escape(current.id)}"]`);
  current = null;
  const back = opener && opener !== document.body && opener.isConnected ? opener : card;
  back?.focus({ preventScroll: true });
  opener = null;
}

function renderCodex(game) {
  const m = game.media;
  const glow = `color-mix(in srgb, ${game.accent} 45%, transparent)`;
  codex.style.setProperty('--accent', game.accent);
  codex.style.setProperty('--glow', glow);
  codex.style.setProperty('--hero', `url("${m.hero}")`);
  const loop = m.loop && !reducedMotion();
  const all = catalog.games;
  const i = all.indexOf(game);
  const prev = all[(i - 1 + all.length) % all.length];
  const next = all[(i + 1) % all.length];
  shots = m.screenshots;

  const seals = [
    game.badge && `<li class="badge">${esc(game.badge)}</li>`,
    ...game.highlights.map(h => `<li>${esc(h)}</li>`),
  ].filter(Boolean).join('');

  const sideLinks = [
    game.website && `<a href="${esc(game.website)}">Official ${esc(game.title)} page</a>`,
    game.privacy && `<a href="${esc(game.privacy)}">Privacy policy</a>`,
  ].filter(Boolean).join('');

  const plate = m.trailer
    ? `<div class="plate-inner">
        <img src="${esc(m.loopPoster || m.hero)}" alt="" decoding="async">
        ${loop ? `<video src="${esc(m.loop)}" poster="${esc(m.loopPoster || m.hero)}" muted loop playsinline autoplay aria-hidden="true"></video>` : ''}
        <button class="trailer-play" type="button" data-play>
          <span class="play-ring">${icon('play', { size: 30 })}</span>
          <span>Watch the trailer</span>
        </button>
      </div>`
    : `<div class="plate-inner"><img src="${esc(m.hero)}" alt="${esc(game.title)} key art" decoding="async"></div>`;

  page.innerHTML = `
    <header class="codex-head">
      <p class="meta">${metaLine(game, { month: true })}${game.genres.length ? `${dot}<span>${esc(game.genres.join(', '))}</span>` : ''}</p>
      <h2 class="codex-title" id="codex-title">${m.logo ? `<img src="${esc(m.logo)}" alt="${esc(game.title)}">` : esc(game.title)}</h2>
      ${game.subtitle ? `<p class="codex-sub">${esc(game.subtitle)}</p>` : ''}
      ${game.isPort ? `<p class="port-banner">${PORT_GLYPH}<span><strong>${esc(portLabel(game))}.</strong> Original game by ${esc(game.originalDeveloper)}.</span></p>` : ''}
      <p class="codex-tagline">${esc(game.tagline)}</p>
      ${seals ? `<ul class="seals">${seals}</ul>` : ''}
      <ul class="stores">${game.stores.map(s => `
        <li><a class="store-btn" href="${esc(s.url)}" target="_blank" rel="noopener">
          ${icon(s.type, { size: 26 })}<span><small>Get it on</small><strong>${esc(s.label)}</strong></span>
        </a></li>`).join('')}
      </ul>
      ${sideLinks ? `<p class="side-links">${sideLinks}</p>` : ''}
    </header>

    <div class="plate">${plate}</div>

    <div class="codex-body">
      <div class="codex-desc">
        ${illuminated(game.description.length ? game.description : [game.summary])}
        ${game.credits ? `<p class="credits">${esc(game.credits)}</p>` : ''}
      </div>
      <aside class="codex-aside" aria-label="About ${esc(game.title)}">
        ${game.features.length ? `<section><h3>Features</h3><ul class="features">${game.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
        <section>
          <h3>Details</h3>
          <dl class="facts">
            ${game.isPort ? `<dt>Original game</dt><dd>${esc(game.originalDeveloper)}</dd>` : ''}
            <dt>Released</dt><dd>${esc(releaseLabel(game, { month: true }))}</dd>
            <dt>Platforms</dt><dd>${esc(game.platformLabels.join(', '))}</dd>
            ${game.genres.length ? `<dt>Genres</dt><dd>${esc(game.genres.join(', '))}</dd>` : ''}
          </dl>
        </section>
      </aside>
    </div>

    ${shots.length ? `
    <section class="gallery" aria-label="Screenshots">
      <h3>Screenshots</h3>
      <div class="shots">${shots.map((s, n) => `
        <button class="shot" type="button" data-shot="${n}" style="aspect-ratio:${s.w} / ${s.h}" aria-label="View screenshot ${n + 1} of ${shots.length}">
          <img src="${esc(s.src)}" alt="${esc(game.title)} screenshot ${n + 1}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async">
        </button>`).join('')}
      </div>
    </section>` : ''}

    ${all.length > 1 ? `
    <nav class="codex-nav" aria-label="More games">
      <a href="${prev.url}" data-step="${esc(prev.id)}"><small>Previous</small><span>${esc(prev.title)}</span>${portMark(prev)}</a>
      <a href="${next.url}" data-step="${esc(next.id)}"><small>Next</small><span>${esc(next.title)}</span>${portMark(next)}</a>
    </nav>` : ''}`;
}

function startTrailer(box) {
  const video = document.createElement('video');
  video.className = 'trailer-video';
  video.setAttribute('aria-label', `${current.title} trailer`);
  box.querySelectorAll('video, .trailer-play').forEach(el => el.remove());
  box.append(video);
  playTrailer(video, current.media.trailer);
  video.focus();
}

function stopCurrentTrailer() {
  page?.querySelectorAll('video').forEach(v => (v.classList.contains('trailer-video') ? stopTrailer(v) : v.pause()));
}

// ---------------------------------------------------------------- lightbox

function initLightbox() {
  const box = $('[data-lightbox]');
  $('[data-lb-close]').addEventListener('click', () => box.close());
  $('[data-lb-prev]').addEventListener('click', () => showShot(shotIndex - 1));
  $('[data-lb-next]').addEventListener('click', () => showShot(shotIndex + 1));
  box.addEventListener('close', () => shotOpener?.focus({ preventScroll: true }));
  box.addEventListener('click', e => { if (e.target === box) box.close(); });
  box.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') showShot(shotIndex - 1);
    if (e.key === 'ArrowRight') showShot(shotIndex + 1);
  });
  let startX = null;
  box.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) showShot(shotIndex + (dx < 0 ? 1 : -1));
    startX = null;
  });
}

function openLightbox(i, from) {
  shotOpener = from;
  showShot(i);
  const box = $('[data-lightbox]');
  const many = shots.length > 1;
  $('[data-lb-prev]').hidden = !many;
  $('[data-lb-next]').hidden = !many;
  box.showModal();
}

function showShot(i) {
  shotIndex = (i + shots.length) % shots.length;
  const s = shots[shotIndex];
  const img = $('[data-lightbox-img]');
  img.src = s.src;
  img.width = s.w;
  img.height = s.h;
  img.alt = `${current.title} screenshot ${shotIndex + 1}`;
  $('[data-lightbox-caption]').textContent = `${current.title}, screenshot ${shotIndex + 1} of ${shots.length}`;
}

// ---------------------------------------------------------------- start

renderStudio();
initStage();
initFilters();
initCodex();
initTopbar();
addStructuredData(catalog);
onRoute(catalog, game => (game ? showCodex(game) : hideCodex()));
