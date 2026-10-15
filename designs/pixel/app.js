// "Pixel" design: the studio site as a 90s party RPG screen. All game content comes from /games.json.
import {
  loadCatalog, icon, esc, releaseLabel, onRoute, openGame, closeGame, playTrailer, stopTrailer,
  reducedMotion, setPageMeta, addStructuredData, portLabel, PLATFORM_LABELS,
} from '/assets/site/catalog.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const wide = matchMedia('(min-width: 1000px)');
const saveData = () => navigator.connection?.saveData === true;

// ---------------------------------------------------------------- pixel sprites

const OUTLINE = '#15100c';
const SPRITES = {
  sword: {
    palette: { W: '#eef3f6', S: '#93a4b0', G: '#e8b64c', H: '#7a4a24', P: '#f2c45a' },
    rows: [
      '................', '..............W.', '.............WS.', '............WS..', '...........WS...',
      '..........WS....', '.........WS.....', '........WS......', '.......WS.......', '...G..WS........',
      '....GWS.........', '.....GG.........', '....H..G........', '...H....G.......', '..P.............',
      '................',
    ],
  },
  chest: {
    palette: { w: '#a8662f', d: '#6e3f1d', b: '#3f434b', g: '#f0c34a', k: '#15100c' },
    rows: [
      '..dddddddddd..', '.dwwwwwwwwwwd.', 'dwwbwwwwwwbwwd', 'dbbbbbggbbbbbd',
      'dwwbwgkkgwbwwd', 'dwwbwwggwwbwwd', 'dwwbwwwwwwbwwd', 'dddbddddddbddd',
    ],
  },
  helm: {
    palette: { r: '#c0392b', R: '#8e2a20', l: '#d5dde4', m: '#8f9aa6', k: '#15100c' },
    rows: [
      '.....rr.....', '....rRrr....', '...mllllm...', '..mllllllm..', '.mllllllllm.', '.mlkkkkkklm.',
      '.mllllllllm.', '.mlkkkkkklm.', '.mllllllllm.', '.mmllllllmm.', '..mmmmmmmm..',
    ],
  },
  letter: {
    palette: { p: '#ecd9a8', q: '#a8874c', r: '#b8322a' },
    rows: [
      'pppppppppppp', 'qppppppppppq', 'pqppppppppqp', 'ppqppppppqpp',
      'pppqprrpqppp', 'ppppqrrqpppp', 'pppppppppppp', 'pppppppppppp',
    ],
  },
  phone: {
    palette: { p: '#d9cdf5', s: '#6fd3ff', k: '#4b2d7d' },
    rows: ['pppppp', 'pssssp', 'pssssp', 'pssssp', 'pssssp', 'pssssp', 'pppppp', 'ppkkpp', 'pppppp'],
  },
  swap: {
    palette: { a: '#d9cdf5', b: '#6fd3ff' },
    rows: ['..a......', '.aaaaaaa.', '..a......', '.........', '......b..', '.bbbbbbb.', '......b..'],
  },
  mug: {
    palette: { w: '#f4ecd8', s: '#b9ab8c', r: '#d8413a' },
    rows: [
      'wwwwwwwwww..', 'wwrrwwrrwwww', 'wrrrrrrrrw.w', 'wrrrrrrrrw.w', 'wwrrrrrrww.w',
      'wwwrrrrwwwww', 'wwwwrrwwww..', 'wwwwwwwwww..', 'swwwwwwwws..', '.ssssssss...',
    ],
  },
  hero: {
    palette: { C: '#3d2a66', c: '#6b46a8', s: '#f2c9a0', e: '#15100c', b: '#e8b64c', B: '#5a3720', t: '#8a5a2c', g: '#56d6f0' },
    rows: [
      '............g...', '.....CCCC..ggg..', '....CccccC..g...', '...CccccccC.t...', '...CcsssscC.t...',
      '...CcessecC.t...', '...CcsssscC.t...', '....CcsscC..t...', '...CccccccCst...', '..CccccccccCt...',
      '..CbbbbbbbbCt...', '..CccccccccCt...', '..CccccccccCt...', '..CCccccccCCt...', '...CccCCccC.t...',
      '...BBB..BBB.t...',
    ],
  },
};

/** Draws a sprite from its character map as crisp SVG, with a one-pixel outline added around it. */
function spriteSvg(name) {
  const { palette, rows } = SPRITES[name];
  const w = rows[0].length + 2;
  const h = rows.length + 2;
  const cell = (x, y) => rows[y - 1]?.[x - 1];
  const filled = (x, y) => { const c = cell(x, y); return c && c !== '.'; };
  const paths = {};
  const add = (color, x, y) => (paths[color] ||= []).push(`M${x} ${y}h1v1h-1z`);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (filled(x, y)) add(palette[cell(x, y)], x, y);
      else if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) add(OUTLINE, x, y);
    }
  }
  const body = Object.entries(paths).map(([fill, d]) => `<path fill="${fill}" d="${d.join('')}"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${body}</svg>`;
}

function paintSprites(root = document) {
  for (const el of $$('[data-sprite]', root)) el.innerHTML = spriteSvg(el.dataset.sprite);
}

// ---------------------------------------------------------------- small helpers

function rarity(game) {
  if (!game.featured) return { key: 'worn', label: 'Old relic' };
  if (game.highlights.length) return { key: 'legendary', label: 'Legendary' };
  return { key: 'rare', label: 'Rare' };
}

const isMobileOnly = g => g.platforms.every(p => p === 'ios' || p === 'android');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "5 games and 2 mobile ports": Bart's own games first, ports counted separately. */
function countText({ originals, ports }) {
  const parts = [plural(originals.length, 'game')];
  if (ports.length) parts.push(plural(ports.length, ports.every(isMobileOnly) ? 'mobile port' : 'port'));
  return listText(parts);
}

function portsHeading(ports) {
  return ports.every(isMobileOnly) ? 'Mobile ports' : 'Ports';
}

/** The violet port plaque, e.g. "Mobile port", with a pixel phone (or swap arrows for other ports). */
function portTag(g, extra = '') {
  if (!g.isPort) return '';
  return `<span class="port-tag ${extra}">${spriteSvg(isMobileOnly(g) ? 'phone' : 'swap')}${esc(portLabel(g))}</span>`;
}

/** The prominent line under a port's title: "Mobile port. Original game by Silver Lemur Games." */
function portNote(g) {
  if (!g.isPort) return '';
  const line = `${portLabel(g)}. Original game by ${g.originalDeveloper}.`;
  return `<p class="port-note">${spriteSvg(isMobileOnly(g) ? 'phone' : 'swap')}<span>${esc(line)}</span></p>`;
}

function listText(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function storeLinks(game, extra = '') {
  return game.stores.map(s => {
    const label = s.type === 'web' ? `Play ${game.title} in your browser` : `${game.title} on ${s.label}`;
    return `<a class="btn btn-store ${extra}" href="${esc(s.url)}" aria-label="${esc(label)}">${icon(s.type)}<span>${esc(s.label)}</span></a>`;
  }).join('');
}

function img(src, alt, attrs = '') {
  return `<img src="${esc(src)}" alt="${esc(alt)}" decoding="async" ${attrs}>`;
}

// ---------------------------------------------------------------- title screen

const STORE_TYPES = ['steam', 'appstore', 'googleplay', 'itch', 'crazygames'];

function renderIntro(catalog) {
  const { studio, platforms } = catalog;
  $('[data-slot="tagline"]').textContent = studio.tagline;
  const stores = studio.links.filter(l => STORE_TYPES.includes(l.type));
  $('.intro-stores').hidden = !stores.length;
  $('.intro-store-links').innerHTML = stores.map(l =>
    `<a class="btn btn-small" href="${esc(l.url)}">${icon(l.type)}<span>${esc(l.label)}</span></a>`).join('');
  $('.intro-stats').hidden = !studio.stats.length;
  $('.intro-stats').innerHTML = studio.stats.map(s =>
    `<li><span class="intro-stat-value">${esc(s.value)}</span><span class="intro-stat-label">${esc(s.label)}</span></li>`).join('');
  const kinds = listText(platforms.map(p => PLATFORM_LABELS[p]));
  $('[data-slot="lead"]').textContent =
    `${countText(catalog)} for ${kinds}. Pick a quest.`;
}

function setupViewport(catalog) {
  const spots = catalog.spotlight;
  const view = $('.viewport');
  if (!spots.length) { view.hidden = true; $('.party').hidden = true; return; }

  const art = $('.view-art');
  const logo = $('.view-logo');
  const video = $('.view-loop');
  const list = $('.portraits');
  let index = 0;
  let timer = 0;
  let onScreen = true;
  let userPicked = false;

  list.innerHTML = spots.map((g, i) => `
    <li><button class="portrait" type="button" data-index="${i}" aria-pressed="false">
      <span class="portrait-frame">${img(g.media.poster, '', 'loading="lazy" width="96" height="96"')}</span>
      <span class="portrait-text">
        <span class="portrait-name">${esc(g.title)}</span>
        <span class="portrait-sub">${esc(g.genres[0] || '')} | ${esc(releaseLabel(g))}</span>
        ${portTag(g)}
      </span>
    </button></li>`).join('');

  const motionOk = () => !reducedMotion() && !saveData();

  function playLoop() {
    if (!video.dataset.src || !onScreen || !motionOk()) return video.pause();
    if (video.getAttribute('src') !== video.dataset.src) video.src = video.dataset.src;
    video.play().catch(() => {});
  }

  function show(i) {
    index = (i + spots.length) % spots.length;
    const g = spots[index];
    view.style.setProperty('--accent', g.accent);
    view.classList.add('is-changing');
    const swap = () => {
      art.src = g.media.hero;
      art.alt = `${g.title} artwork`;
      logo.hidden = !g.media.logo;
      if (g.media.logo) { logo.src = g.media.logo; logo.alt = ''; }
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.dataset.src = g.media.loop || '';
      video.poster = g.media.loopPoster || '';
      video.hidden = !g.media.loop || !motionOk();
      $('.view-title').textContent = g.title;
      $('.view-tagline').textContent = g.tagline;
      const port = $('.view-port');
      port.hidden = !g.isPort;
      port.innerHTML = g.isPort ? `${portTag(g)}<span>Original game by ${esc(g.originalDeveloper)}</span>` : '';
      $('.view-actions').innerHTML =
        `<button class="btn btn-gold" type="button" data-open="${esc(g.id)}">View game</button>${storeLinks(g, 'btn-compact')}`;
      for (const b of $$('.portrait', list)) b.setAttribute('aria-pressed', String(Number(b.dataset.index) === index));
      const done = () => view.classList.remove('is-changing');
      if (art.complete) done(); else art.addEventListener('load', done, { once: true });
      playLoop();
    };
    if (motionOk() && art.src) setTimeout(swap, 180); else swap();
  }

  function schedule() {
    clearInterval(timer);
    if (userPicked || !motionOk() || spots.length < 2) return;
    timer = setInterval(() => { if (onScreen && !document.hidden) show(index + 1); }, 9000);
  }

  list.addEventListener('click', e => {
    const b = e.target.closest('.portrait');
    if (!b) return;
    userPicked = true;
    clearInterval(timer);
    show(Number(b.dataset.index));
  });
  view.addEventListener('pointerenter', () => clearInterval(timer));
  view.addEventListener('pointerleave', schedule);
  view.addEventListener('focusin', () => clearInterval(timer));

  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) playLoop(); else video.pause();
  }, { threshold: 0.25 }).observe(view);
  document.addEventListener('visibilitychange', () => (document.hidden ? video.pause() : playLoop()));

  show(0);
  schedule();
}

function setupLog(catalog) {
  const { studio, originals, ports, platforms } = catalog;
  const latest = originals.find(g => g.featured) || originals[0];
  const port = ports[0];
  const facts = [
    `${studio.name} has released ${countText(catalog)}.`,
    latest && `Latest game: ${latest.title} (${releaseLabel(latest)}).`,
    port && `Latest ${portLabel(port).toLowerCase()}: ${port.title} (${releaseLabel(port)}), original game by ${port.originalDeveloper}.`,
    ...studio.stats.map(s => `${s.label}: ${s.value}.`),
    `Quests available on ${listText(platforms.map(p => PLATFORM_LABELS[p]))}.`,
    studio.location && `Forged in ${studio.location}.`,
  ].filter(Boolean);
  const lines = $('.log-lines');
  const visible = 3;

  if (reducedMotion()) {
    lines.innerHTML = facts.slice(0, visible).map(f => `<li>${esc(f)}</li>`).join('');
    return;
  }

  let next = 0;
  let onScreen = false;
  let typing = false;
  function push() {
    if (!onScreen || document.hidden || typing) return;
    const li = document.createElement('li');
    li.className = 'is-typing';
    lines.append(li);
    while (lines.children.length > visible) lines.firstElementChild.remove();
    const text = facts[next++ % facts.length];
    let i = 0;
    typing = true;
    const step = () => {
      li.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, 22);
      else { li.classList.remove('is-typing'); typing = false; }
    };
    step();
  }
  // Start with the first lines already written, so the box never looks empty.
  lines.innerHTML = facts.slice(0, visible - 1).map(f => `<li>${esc(f)}</li>`).join('');
  next = visible - 1;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }, { threshold: 0.5 }).observe(lines);
  setInterval(push, 3800);
}

// ---------------------------------------------------------------- quest log

const state = { platform: 'all', genre: '', query: '', selectedId: null };

function setupQuests(catalog) {
  const { games, platforms, genres } = catalog;
  const tabs = $('.tabs');
  const all = [{ key: 'all', label: 'All' }, ...platforms.map(p => ({ key: p, label: PLATFORM_LABELS[p] }))];
  const count = key => (key === 'all' ? games.length : games.filter(g => g.platforms.includes(key)).length);
  tabs.hidden = platforms.length < 2;
  tabs.innerHTML = all.map(t => `
    <button class="tab" type="button" role="tab" data-platform="${t.key}" aria-selected="${t.key === 'all'}" tabindex="${t.key === 'all' ? 0 : -1}">
      ${esc(t.label)} <span class="tab-count">${count(t.key)}</span>
    </button>`).join('');

  tabs.addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (t) selectTab(t);
  });
  tabs.addEventListener('keydown', e => {
    const list = $$('.tab', tabs);
    const i = list.indexOf(document.activeElement);
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (i < 0 || !step) return;
    e.preventDefault();
    const t = list[(i + step + list.length) % list.length];
    t.focus();
    selectTab(t);
  });
  function selectTab(t) {
    for (const b of $$('.tab', tabs)) {
      const on = b === t;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    state.platform = t.dataset.platform;
    renderSlots(catalog);
  }

  // Extra filters only appear once the library is big enough to need them.
  const genreField = $('.field-genre');
  genreField.hidden = games.length < 10 || genres.length < 3;
  $('.genre-select').innerHTML = `<option value="">Any type</option>` + [...genres].sort((a, b) => a.localeCompare(b))
    .map(g => `<option value="${esc(g)}">${esc(g)} (${games.filter(x => x.genres.includes(g)).length})</option>`).join('');
  $('.genre-select').addEventListener('change', e => { state.genre = e.target.value; renderSlots(catalog); });

  $('.field-search').hidden = games.length < 16;
  $('.search-input').addEventListener('input', e => { state.query = e.target.value.trim().toLowerCase(); renderSlots(catalog); });

  const slots = $('.slots');
  slots.addEventListener('click', e => {
    const b = e.target.closest('.slot');
    if (!b) return;
    if (wide.matches) select(catalog, b.dataset.id, false);
    else openGame(b.dataset.id);
  });
  slots.addEventListener('dblclick', e => {
    const b = e.target.closest('.slot');
    if (b) openGame(b.dataset.id);
  });
  slots.addEventListener('keydown', e => moveSelection(catalog, e));

  wide.addEventListener('change', () => renderPanel(catalog));

  renderSlots(catalog);
}

function filtered({ games }) {
  return games.filter(g =>
    (state.platform === 'all' || g.platforms.includes(state.platform)) &&
    (!state.genre || g.genres.includes(state.genre)) &&
    (!state.query || `${g.title} ${g.subtitle} ${g.genres.join(' ')}`.toLowerCase().includes(state.query)));
}

function slotHtml(g, eager) {
  const r = rarity(g);
  return `
    <li class="slot-item">
      <button class="slot rarity-${r.key}" type="button" data-id="${esc(g.id)}" tabindex="-1" style="--accent:${esc(g.accent)}">
        <span class="slot-art">
          ${img(g.media.cover, '', `width="320" height="180" ${eager ? '' : 'loading="lazy"'}`)}
          <span class="gem" aria-hidden="true"></span>
          ${portTag(g, 'slot-port')}
        </span>
        <span class="slot-plate">
          <span class="slot-title">${esc(g.title)}</span>
          <span class="slot-meta">${esc(releaseLabel(g))} <span aria-hidden="true">|</span> ${esc(g.platformLabels.join(' '))}</span>
          <span class="visually-hidden">${esc(r.label)}</span>
        </span>
      </button>
    </li>`;
}

function renderSlots(catalog) {
  const list = filtered(catalog);
  // Bart's own games lead; ports and older games follow under their own dividers.
  const groups = [
    { games: list.filter(g => g.featured && !g.isPort) },
    { games: list.filter(g => g.isPort), label: portsHeading(catalog.ports) },
    { games: list.filter(g => !g.featured && !g.isPort), label: 'Older relics' },
  ].filter(grp => grp.games.length);
  let shown = 0;
  $('.slots').innerHTML = groups.map((grp, i) =>
    (grp.label && (i > 0 || grp.games.some(g => g.isPort)) ? `<li class="slot-divider"><span>${esc(grp.label)}</span></li>` : '') +
    grp.games.map(g => slotHtml(g, shown++ < 4)).join('')).join('');
  $('.empty').hidden = list.length > 0;
  $('.inventory-hint').hidden = !list.length;

  const ordered = groups.flatMap(grp => grp.games);
  if (!ordered.some(g => g.id === state.selectedId)) state.selectedId = ordered[0]?.id || null;
  markSelected();
  renderPanel(catalog);
}

function markSelected() {
  for (const b of $$('.slot')) {
    const on = b.dataset.id === state.selectedId;
    b.classList.toggle('is-selected', on);
    b.tabIndex = on ? 0 : -1;
  }
}

function select(catalog, id, focus) {
  state.selectedId = id;
  markSelected();
  renderPanel(catalog);
  if (focus) $(`.slot[data-id="${CSS.escape(id)}"]`)?.focus();
}

// Arrow keys walk the grid like an inventory: left/right by item, up/down by row.
function moveSelection(catalog, e) {
  const buttons = $$('.slot');
  const i = buttons.indexOf(document.activeElement);
  if (i < 0) return;
  if (e.key === 'Enter') { e.preventDefault(); openGame(buttons[i].dataset.id); return; }
  let target;
  if (e.key === 'ArrowRight') target = buttons[i + 1];
  else if (e.key === 'ArrowLeft') target = buttons[i - 1];
  else if (e.key === 'Home') target = buttons[0];
  else if (e.key === 'End') target = buttons.at(-1);
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const here = buttons[i].getBoundingClientRect();
    const down = e.key === 'ArrowDown';
    const rows = buttons.map(b => ({ b, r: b.getBoundingClientRect() }))
      .filter(({ r }) => (down ? r.top > here.top + 4 : r.top < here.top - 4));
    if (rows.length) {
      const rowTop = down ? Math.min(...rows.map(x => x.r.top)) : Math.max(...rows.map(x => x.r.top));
      target = rows.filter(x => Math.abs(x.r.top - rowTop) < 4)
        .sort((a, b) => Math.abs(a.r.left - here.left) - Math.abs(b.r.left - here.left))[0].b;
    }
  } else return;
  e.preventDefault();
  if (target) select(catalog, target.dataset.id, true);
}

function statRows(g) {
  const rows = [
    ['Released', releaseLabel(g)],
    ['Platforms', g.platformLabels.join(', ')],
    ['Type', g.genres.join(', ')],
    g.badge && ['Bonus', g.badge],
  ].filter(Boolean);
  return rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
}

function renderPanel(catalog) {
  const panel = $('.item-panel');
  panel.hidden = !wide.matches;
  if (!wide.matches) return;
  const g = catalog.byId.get(state.selectedId);
  if (!g) { panel.innerHTML = `<p class="panel-empty">Select a quest to see its stats.</p>`; return; }
  const r = rarity(g);
  panel.style.setProperty('--accent', g.accent);
  panel.innerHTML = `
    <div class="item-art rarity-${r.key}">${img(g.media.cover, `${g.title} cover art`, 'width="640" height="360"')}</div>
    <div class="item-tags"><p class="rarity-label rarity-${r.key}">${esc(r.label)}</p>${portTag(g)}</div>
    <h3 class="item-title rarity-${r.key}">${esc(g.title)}</h3>
    ${portNote(g)}
    ${g.subtitle ? `<p class="item-sub">${esc(g.subtitle)}</p>` : ''}
    <p class="item-tagline">${esc(g.tagline)}</p>
    <dl class="stats">${statRows(g)}</dl>
    ${g.highlights.length ? `<ul class="affixes" role="list">${g.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
    <div class="item-actions">
      <button class="btn btn-gold" type="button" data-open="${esc(g.id)}">View game</button>
      ${storeLinks(g, 'btn-compact')}
    </div>
`;
}

// ---------------------------------------------------------------- game info window

const infoWin = $('dialog.info');
const lightbox = $('dialog.lightbox');
let openId = null;
let returnFocus = null;

function infoHtml(g) {
  const r = rarity(g);
  const m = g.media;
  const links = [
    g.website && `<a href="${esc(g.website)}">Official ${esc(g.title)} page</a>`,
    g.privacy && `<a href="${esc(g.privacy)}">Privacy policy</a>`,
  ].filter(Boolean);
  const trailer = m.trailer ? `
    <section class="info-section trailer-section" aria-label="Trailer">
      <div class="trailer">
        <video class="trailer-video" preload="none" playsinline ${m.loopPoster || m.hero ? `poster="${esc(m.loopPoster || m.hero)}"` : ''}></video>
        <button class="btn btn-gold trailer-play" type="button" data-trailer="${esc(m.trailer)}">${icon('play')}<span>Watch trailer</span></button>
      </div>
    </section>` : '';
  const shots = m.screenshots.length ? `
    <section class="info-section">
      <h3 class="info-h">Screenshots</h3>
      <ul class="shots" role="list">
        ${m.screenshots.map((s, i) => `
          <li><button class="shot" type="button" data-shot="${i}" aria-label="Open screenshot ${i + 1} of ${m.screenshots.length}" style="aspect-ratio:${s.w} / ${s.h}">
            ${img(s.src, '', `width="${s.w}" height="${s.h}" loading="lazy"`)}
          </button></li>`).join('')}
      </ul>
    </section>` : '';

  return `
    <header class="info-head" style="--accent:${esc(g.accent)}">
      <div class="info-portrait rarity-${r.key}">${img(m.poster, `${g.title} artwork`, 'width="600" height="900"')}</div>
      <div class="info-titles">
        <div class="info-tags"><p class="rarity-label rarity-${r.key}">${esc(r.label)}</p>${portTag(g)}</div>
        <h2 id="info-title" class="info-title" tabindex="-1">${esc(g.title)}</h2>
        ${portNote(g)}
        ${g.subtitle ? `<p class="info-sub">${esc(g.subtitle)}</p>` : ''}
        <p class="info-tagline">${esc(g.tagline)}</p>
      </div>
      <div class="info-facts">
        <dl class="stats">${statRows(g)}</dl>
        <div class="info-stores">${storeLinks(g)}</div>
        ${links.length ? `<p class="info-links">${links.join('<span aria-hidden="true"> | </span>')}</p>` : ''}
      </div>
    </header>
    ${trailer}
    <div class="info-columns">
      <section class="info-section">
        <h3 class="info-h">The tale</h3>
        ${(g.description.length ? g.description : [g.summary]).map(p => `<p>${esc(p)}</p>`).join('')}
      </section>
      ${g.features.length || g.highlights.length ? `
        <section class="info-section">
          ${g.features.length ? `<h3 class="info-h">Features</h3><ul class="pixel-list" role="list">${g.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
          ${g.highlights.length ? `<h3 class="info-h">Achievements</h3><ul class="affixes" role="list">${g.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
        </section>` : ''}
    </div>
    ${shots}
    ${g.credits ? `<p class="info-credits">${esc(g.credits)}</p>` : ''}
    <div class="info-end">
      <button class="btn" type="button" data-close>Close</button>
    </div>`;
}

function openInfo(g) {
  if (infoWin.open && openId === g.id) return;
  stopInfoTrailer();
  if (!infoWin.open) returnFocus = document.activeElement;
  openId = g.id;
  $('.info-body', infoWin).innerHTML = infoHtml(g);
  $('.info-body', infoWin).scrollTop = 0;
  if (!infoWin.open) infoWin.showModal();
  $('#info-title').focus({ preventScroll: true });
}

function closeInfo() {
  if (!infoWin.open) return;
  if (lightbox.open) lightbox.close();
  stopInfoTrailer();
  infoWin.close();
  const back = returnFocus?.isConnected && returnFocus !== document.body
    ? returnFocus : $(`.slot[data-id="${CSS.escape(openId || '')}"]`);
  openId = null;
  back?.focus({ preventScroll: true });
}

function stopInfoTrailer() {
  const v = $('.trailer-video', infoWin);
  if (v && (v.src || v._hls)) stopTrailer(v);
}

function setupInfo(catalog) {
  infoWin.addEventListener('cancel', e => { e.preventDefault(); closeGame(); });
  infoWin.addEventListener('click', async e => {
    if (e.target === infoWin || e.target.closest('[data-close]')) return closeGame();
    const play = e.target.closest('[data-trailer]');
    if (play) {
      const video = $('.trailer-video', infoWin);
      play.hidden = true;
      try { await playTrailer(video, play.dataset.trailer); video.focus(); }
      catch {
        const steam = catalog.byId.get(openId)?.stores.find(s => s.type === 'steam');
        play.insertAdjacentHTML('afterend', `<p class="trailer-error">The trailer could not load here.${steam ? ` <a href="${esc(steam.url)}">Watch it on Steam</a>.` : ''}</p>`);
      }
      return;
    }
    const shot = e.target.closest('[data-shot]');
    if (shot) openLightbox(catalog.byId.get(openId), Number(shot.dataset.shot));
  });
}

// ---------------------------------------------------------------- lightbox

let box = { game: null, index: 0 };
function showShot(step = 0) {
  const shots = box.game.media.screenshots;
  box.index = (box.index + step + shots.length) % shots.length;
  const s = shots[box.index];
  const image = $('.lightbox-img', lightbox);
  image.src = s.src;
  image.width = s.w;
  image.height = s.h;
  image.alt = `${box.game.title} screenshot ${box.index + 1}`;
  $('.lightbox-count', lightbox).textContent = `${box.index + 1} / ${shots.length}`;
  for (const b of $$('[data-step]', lightbox)) b.hidden = shots.length < 2;
}
function openLightbox(game, index) {
  box = { game, index };
  showShot();
  lightbox.showModal();
}
function setupLightbox() {
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox || e.target.closest('[data-close]')) return lightbox.close();
    const step = e.target.closest('[data-step]');
    if (step) showShot(Number(step.dataset.step));
  });
  lightbox.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); showShot(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); showShot(-1); }
  });
  // Swipe left or right on phones.
  let startX = null;
  lightbox.addEventListener('pointerdown', e => { startX = e.clientX; });
  lightbox.addEventListener('pointerup', e => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) showShot(dx < 0 ? 1 : -1);
  });
}

// ---------------------------------------------------------------- character sheet, contact, footer

function renderSheet({ studio, originals, ports, platforms }) {
  // The year itself is shown once, in the achievements; the level is the years since then.
  const years = new Date().getFullYear() - Number(studio.since || new Date().getFullYear());
  $('[data-slot="name"]').textContent = studio.name;
  $('[data-slot="level"]').innerHTML = years > 0
    ? `Level ${years} <span class="level-note">(years of releasing games)</span>` : '';
  const attrs = [
    ['Class', 'Solo developer'],
    studio.location && ['Home', studio.location],
    ['Games released', originals.length],
    ports.length && [portsHeading(ports), ports.length],
    ['Platforms', platforms.map(p => PLATFORM_LABELS[p]).join(', ')],
  ].filter(Boolean);
  $('.attrs').innerHTML = attrs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('[data-slot="about"]').innerHTML = studio.about.map(p => `<p>${esc(p)}</p>`).join('');
  $('.sheet-feats').hidden = !studio.stats.length;
  $('.feats').innerHTML = studio.stats.map(s => `
    <li><span class="feat-value">${esc(s.value)}</span><span class="feat-label">${esc(s.label)}</span></li>`).join('');
}

function renderContact(catalog) {
  const { studio } = catalog;
  const mail = $('[data-slot="mail"]');
  mail.href = `mailto:${studio.email}`;
  const [user, domain] = studio.email.split('@');
  mail.innerHTML = `${icon('mail')}<span>${esc(user)}<wbr>@${esc(domain)}</span>`;
  $('.guilds').hidden = !studio.links.length;
  $('.links').innerHTML = studio.links.map(l => `
    <li><a class="btn btn-link" href="${esc(l.url)}" rel="me noopener">${icon(l.type)}<span>${esc(l.label)}</span></a></li>`).join('');

  const { support } = studio;
  if (support) {
    const box = $('.support');
    $('h2', box).textContent = support.title;
    $('p', box).textContent = support.text;
    const link = $('.btn', box);
    link.href = support.url;
    link.innerHTML = `${icon('kofi')}<span>${esc(support.label)}</span>`;
    box.hidden = false;
  }

  $('[data-slot="copyright"]').textContent = `© ${new Date().getFullYear()} ${studio.name}`;
}

// ---------------------------------------------------------------- CRT toggle

function setupCrt() {
  const button = $('.crt-toggle');
  const read = () => { try { return localStorage.getItem('pixel-crt') === 'on'; } catch { return false; } };
  const apply = on => {
    document.documentElement.classList.toggle('crt', on);
    button.setAttribute('aria-pressed', String(on));
  };
  apply(read());
  button.addEventListener('click', () => {
    const on = button.getAttribute('aria-pressed') !== 'true';
    apply(on);
    try { localStorage.setItem('pixel-crt', on ? 'on' : 'off'); } catch { /* private mode: keep it for this visit */ }
  });
}

// ---------------------------------------------------------------- start

async function start() {
  paintSprites();
  setupCrt();
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch {
    $('.slots').innerHTML = '';
    $('.empty').hidden = false;
    $('.empty').textContent = 'The quest log could not be loaded. Please refresh the page.';
    return;
  }
  renderIntro(catalog);
  setupViewport(catalog);
  setupLog(catalog);
  setupQuests(catalog);
  renderSheet(catalog);
  renderContact(catalog);
  setupInfo(catalog);
  setupLightbox();
  addStructuredData(catalog);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-open]');
    if (b) openGame(b.dataset.open);
  });
  onRoute(catalog, game => {
    setPageMeta(game, catalog.studio);
    if (game) openInfo(game); else closeInfo();
  });
  document.documentElement.classList.add('is-ready');
}

start();
