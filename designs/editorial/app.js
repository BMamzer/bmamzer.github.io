// Editorial design: renders the studio index from games.json. Layout lives in style.css.
import {
  loadCatalog, icon, esc, releaseLabel, onRoute, openGame, closeGame, playTrailer, stopTrailer,
  reducedMotion, setPageMeta, addStructuredData, privacyLinks, portLabel, PLATFORM_LABELS,
} from '/assets/site/catalog.js';

document.documentElement.classList.add('js');

const slot = name => document.querySelector(`[data-slot="${name}"]`);
const fineHover = matchMedia('(hover: hover) and (pointer: fine)');
const view = { platform: 'all', sort: 'newest', query: '' };
let current = null; // the game open in the article
let opener = null; // where focus returns when the article closes
let shotIndex = 0; // the screenshot shown in the viewer
const SORTS = { newest: 'Newest', oldest: 'Oldest', title: 'A to Z' };

let catalog;
try {
  catalog = await loadCatalog();
} catch (error) {
  slot('toc-body').innerHTML = '<p class="toc__empty">The games could not load. Please refresh the page.</p>';
  throw error;
}
const { studio, games } = catalog;
const pad = n => String(n).padStart(Math.max(2, String(games.length).length), '0');
const external = 'target="_blank" rel="noopener"';

renderOpening();
renderSpreads();
renderControls();
renderIndex();
renderStudio();
renderContact();
setUpReveal();
setUpSectionLinks();
setUpPeek();
setUpArticle();
addStructuredData(catalog);
onRoute(catalog, game => (game ? showArticle(game) : hideArticle()));

// ---------------------------------------------------------------- opening

function renderOpening() {
  const year = new Date().getFullYear();
  const name = slot('studio-name');
  name.innerHTML = studio.name.split(' ').map(w => `<span class="word">${esc(w)}</span>`).join(' ');
  const tagline = studio.tagline.trim();
  slot('studio-tagline').textContent = /[.!?]$/.test(tagline) ? tagline : `${tagline}.`;
  slot('volume').textContent = studio.since ? `Vol. ${year - studio.since + 1}, since ${studio.since}` : 'Independent game studio';
  slot('today').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  slot('place').textContent = studio.location || '';

  // The founding year is in the dateline and the Studio stats, so the tally sticks to counts.
  const latest = catalog.featured[0] || games[0];
  slot('tally').innerHTML = [
    ['Released games', pad(catalog.originals.length)],
    catalog.ports.length && ['Ports', pad(catalog.ports.length)],
    ['Platforms', pad(catalog.platforms.length)],
    ['Latest release', `<a href="${latest.url}" data-game="${esc(latest.id)}">${esc(latest.title)}</a>${portTag(latest)}`, true],
  ].filter(Boolean).filter(([, value]) => value).map(([label, value, text]) =>
    `<div><dt>${label}</dt><dd${text ? ' class="tally__text"' : ''}>${value}</dd></div>`).join('');

  const refit = () => { fitName(); fitWords(); };
  refit();
  // Measure again once the display font is in: fallback fonts have different widths.
  document.fonts?.load('800 100px Archivo').then(refit);
  document.fonts?.addEventListener('loadingdone', refit);
  let frame;
  addEventListener('resize', () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(refit); });
}

// Sets the studio name so it spans the full measure: one line on wide screens, one word per line on phones.
function fitName() {
  const el = slot('studio-name');
  const box = el.closest('.statement').clientWidth;
  const stacked = innerWidth < 700 && el.querySelectorAll('.word').length > 1;
  el.classList.toggle('is-stacked', stacked);
  el.style.fontSize = '100px';
  const words = [...el.querySelectorAll('.word')];
  const width = stacked ? Math.max(...words.map(w => w.getBoundingClientRect().width)) : el.getBoundingClientRect().width;
  if (!width) return;
  el.style.fontSize = `${Math.min((100 * box) / width, stacked ? 220 : 280) * 0.99}px`;
}

// Big titles are set word by word so they can shrink until the longest word fits: no breaks inside a word.
function words(text) {
  return text.split(' ').map(w => `<span class="fit-word">${esc(w)}</span>`).join(' ');
}

// A boxed tag that marks games Bart ported from another studio. Reads as "Mobile port." to screen readers.
function portTag(g, extra = '') {
  return g.isPort ? ` <span class="port${extra}">${esc(portLabel(g))}<span class="sr">.</span></span>` : '';
}

function portLine(g) {
  return g.isPort ? `${portTag(g)} Original game by ${esc(g.originalDeveloper)}.` : '';
}

// "A", "A and B", "A, B and C".
function joinList(items) {
  return items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

// Bart's own current games lead, then the ports, then the archive. Article numbers and next/prev follow this order.
function groupsOf(list) {
  return {
    own: list.filter(g => g.featured && !g.isPort),
    ports: list.filter(g => g.isPort),
    archive: list.filter(g => !g.featured && !g.isPort),
  };
}

function indexOrder() {
  const { own, ports, archive } = groupsOf(games);
  return [...own, ...ports, ...archive];
}

function fitWords(root = document) {
  root.querySelectorAll('[data-fit]').forEach(el => {
    el.style.fontSize = '';
    const widest = Math.max(0, ...[...el.querySelectorAll('.fit-word')].map(w => w.getBoundingClientRect().width));
    const room = el.clientWidth;
    if (widest > room && room) el.style.fontSize = `${(parseFloat(getComputedStyle(el).fontSize) * room) / widest * 0.98}px`;
  });
}

// ---------------------------------------------------------------- selected work

function renderSpreads() {
  const list = catalog.spotlight;
  slot('work-note').textContent = 'Highlights from the index below.';
  slot('spreads').innerHTML = list.map((g, i) => {
    const kind = i === 0 ? 'spread--wide' : `spread--side${i % 2 === 0 ? ' spread--flip' : ''}`;
    return `
      <article class="spread ${kind} reveal" style="--accent:${esc(g.accent)}">
        <figure class="spread__media" data-game="${esc(g.id)}">
          <img src="${esc(g.media.hero)}" alt="${esc(g.title)} key art" decoding="async" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>
          ${g.media.loop ? `<video muted loop playsinline preload="none" aria-hidden="true" tabindex="-1" data-src="${esc(g.media.loop)}"></video>` : ''}
        </figure>
        <p class="spread__index"><b>${pad(i + 1)}</b> / ${pad(list.length)}</p>
        <h3 class="spread__title" data-fit><a href="${g.url}" data-game="${esc(g.id)}">${words(g.title)}</a></h3>
        <div class="spread__copy">
          ${g.isPort ? `<p class="port-line">${portLine(g)}</p>` : ''}
          <p class="spread__tagline">${esc(g.tagline)}</p>
          <p class="spread__meta">${esc([g.genres.slice(0, 2).join(', '), g.platformLabels.join(' / '), g.year].join(' · '))}</p>
          <a class="btn-text" href="${g.url}" data-game="${esc(g.id)}" aria-label="View game: ${esc(g.title)}">View game <span aria-hidden="true">→</span></a>
        </div>
      </article>`;
  }).join('');
  setUpLoops();
  fitWords(slot('spreads'));
}

// Spreads play their silent trailer clip while the mouse rests on them. Never on touch or with reduced motion.
function setUpLoops() {
  if (!fineHover.matches || reducedMotion()) return;
  const stop = fig => { fig.querySelector('video')?.pause(); fig.classList.remove('is-playing'); };
  const seen = new IntersectionObserver(entries => entries.forEach(e => e.isIntersecting || stop(e.target)));
  document.querySelectorAll('.spread__media').forEach(fig => {
    const video = fig.querySelector('video');
    if (!video) return;
    seen.observe(fig);
    fig.addEventListener('pointerenter', () => {
      if (!video.src) video.src = video.dataset.src;
      video.play().then(() => fig.classList.add('is-playing')).catch(() => {});
    });
    fig.addEventListener('pointerleave', () => stop(fig));
  });
}

// ---------------------------------------------------------------- index

function renderControls() {
  const platforms = catalog.platforms;
  const platformGroup = slot('platforms').closest('.controls__group');
  platformGroup.hidden = platforms.length < 2;
  const count = p => games.filter(g => p === 'all' || g.platforms.includes(p)).length;
  slot('platforms').innerHTML = ['all', ...platforms].map(p => `
    <button class="btn-text" type="button" data-platform="${p}" aria-pressed="${view.platform === p}">
      ${p === 'all' ? 'All' : esc(PLATFORM_LABELS[p] || p)}<sup>${count(p)}</sup>
    </button>`).join('');
  slot('sorts').innerHTML = Object.entries(SORTS).map(([key, label]) => `
    <button class="btn-text" type="button" data-sort="${key}" aria-pressed="${view.sort === key}">${label}</button>`).join('');

  // A search box only earns its place once the library is big.
  const search = document.getElementById('search');
  search.closest('.controls__group').hidden = games.length <= 12;

  slot('controls').addEventListener('click', e => {
    const button = e.target.closest('button');
    if (!button) return;
    if (button.dataset.platform) view.platform = button.dataset.platform;
    if (button.dataset.sort) view.sort = button.dataset.sort;
    slot('controls').querySelectorAll('[data-platform]').forEach(b => b.setAttribute('aria-pressed', b.dataset.platform === view.platform));
    slot('controls').querySelectorAll('[data-sort]').forEach(b => b.setAttribute('aria-pressed', b.dataset.sort === view.sort));
    renderIndex();
  });
  search.addEventListener('input', () => { view.query = search.value.trim().toLowerCase(); renderIndex(); });
}

function filtered() {
  const q = view.query;
  const list = games.filter(g =>
    (view.platform === 'all' || g.platforms.includes(view.platform)) &&
    (!q || [g.title, g.subtitle, ...g.genres].join(' ').toLowerCase().includes(q)));
  if (view.sort === 'oldest') list.reverse();
  if (view.sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title));
  return list;
}

function renderIndex() {
  const list = filtered();
  const { own, ports, archive } = groupsOf(list);
  const developers = [...new Set(ports.map(g => g.originalDeveloper))];
  let n = 0;
  const rows = (items, archived) => `<ol>${items.map(g => row(g, ++n, archived)).join('')}</ol>`;
  const group = (title, note) => `<h3 class="toc__group">${title} <span>${esc(note)}</span></h3>`;

  slot('toc-body').innerHTML = list.length
    ? (own.length ? rows(own, false) : '') +
      (ports.length ? group('Ports', `Original games by ${joinList(developers)}`) + rows(ports, false) : '') +
      (archive.length ? group('Archive', 'Earlier games, still available') + rows(archive, true) : '')
    : '<p class="toc__empty">No games match that. Try another platform or word.</p>';

  const filtering = view.platform !== 'all' || view.query;
  slot('status').innerHTML = filtering
    ? `Showing ${list.length} of ${games.length} games. <button class="btn-text" type="button" data-clear>Clear filters</button>`
    : '';
  slot('status').querySelector('[data-clear]')?.addEventListener('click', clearFilters);
}

function row(g, n, archived) {
  return `
    <li>
      <a class="row${archived ? ' row--archive' : ''}" href="${g.url}" data-game="${esc(g.id)}" style="--accent:${esc(g.accent)}">
        <span class="row__no">${pad(n)}</span>
        <img class="row__thumb" src="${esc(g.media.cover)}" alt="" width="112" height="63" loading="lazy" decoding="async">
        <span class="row__title">
          <span class="row__name">${esc(g.title)}</span>
          ${g.subtitle ? `<span class="row__sub">${esc(g.subtitle)}</span>` : ''}
          ${g.isPort ? `<span class="row__port">${portTag(g)}</span>` : ''}
        </span>
        <span class="row__genre">${esc(g.genres.slice(0, 2).join(', '))}</span>
        <span class="row__platforms">${esc(g.platformLabels.join(' / '))}</span>
        <span class="row__year">${g.year}</span>
        <span class="row__meta">${esc([g.genres[0], g.platformLabels.join(' / '), g.year].join(' · '))}</span>
        <span class="row__arrow" aria-hidden="true">→</span>
      </a>
    </li>`;
}

function clearFilters() {
  Object.assign(view, { platform: 'all', query: '' });
  document.getElementById('search').value = '';
  slot('controls').querySelectorAll('[data-platform]').forEach(b => b.setAttribute('aria-pressed', b.dataset.platform === 'all'));
  renderIndex();
  slot('toc-body').querySelector('.row')?.focus();
}

// The cover floats next to the cursor while you read down the index (mouse and keyboard on big screens).
function setUpPeek() {
  const peek = slot('peek');
  const img = peek.querySelector('img');
  const toc = slot('toc');
  const enabled = () => fineHover.matches && innerWidth >= 900;
  let frame;

  const place = (x, y) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const { width, height } = peek.getBoundingClientRect();
      let left = x + 28;
      if (left + width > innerWidth - 16) left = x - width - 28;
      const top = Math.min(Math.max(16, y - height / 2), innerHeight - height - 16);
      peek.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    });
  };
  const show = (rowEl, x, y) => {
    const g = catalog.byId.get(rowEl.dataset.game);
    if (!g) return;
    if (img.getAttribute('src') !== g.media.cover) img.src = g.media.cover;
    place(x, y);
    peek.classList.add('is-on');
  };
  const hide = () => peek.classList.remove('is-on');

  toc.addEventListener('pointermove', e => {
    if (!enabled() || e.pointerType !== 'mouse') return;
    const rowEl = e.target.closest('.row');
    rowEl ? show(rowEl, e.clientX, e.clientY) : hide();
  });
  toc.addEventListener('pointerleave', hide);
  toc.addEventListener('focusin', e => {
    const rowEl = e.target.closest('.row');
    if (!enabled() || !rowEl || !rowEl.matches(':focus-visible')) return;
    const r = rowEl.getBoundingClientRect();
    show(rowEl, r.right - 380, r.top + r.height / 2);
  });
  toc.addEventListener('focusout', hide);
  addEventListener('scroll', hide, { passive: true });
}

// ---------------------------------------------------------------- studio and contact

function renderStudio() {
  const [lead, ...rest] = studio.about;
  slot('studio-note').textContent = studio.location || '';
  slot('about-lead').textContent = lead || studio.tagline;
  slot('about-rest').innerHTML = rest.map(p => `<p>${esc(p)}</p>`).join('');
  slot('stats').innerHTML = studio.stats.map(s => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('');
}

function renderContact() {
  const mail = slot('mail');
  mail.href = `mailto:${studio.email}`;
  mail.textContent = studio.email;
  slot('links').innerHTML = studio.links.map(l => `
    <li><a href="${esc(l.url)}" ${external}>${icon(l.type)}<span>${esc(l.label)}</span></a></li>`).join('');
  slot('copyright').textContent = `© ${new Date().getFullYear()} ${studio.name}`;
  slot('legal').innerHTML = privacyLinks(catalog).map(l => `<li><a href="${esc(l.url)}">${esc(l.label)}</a></li>`).join('');
}

// ---------------------------------------------------------------- reveal on scroll

// Section links glide instead of jumping (CSS smooth scrolling would also slow down find-in-page and anchors).
function setUpSectionLinks() {
  document.addEventListener('click', e => {
    const link = e.target.closest('a[data-scroll]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    target.focus?.({ preventScroll: true });
  });
}

function setUpReveal() {
  const items = document.querySelectorAll('.reveal, .rule-top');
  if (reducedMotion() || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -8% 0px' });
  items.forEach(el => io.observe(el));
}

// ---------------------------------------------------------------- article (game detail)

function setUpArticle() {
  const dialog = slot('article');

  document.addEventListener('click', e => {
    const link = e.target.closest('[data-game]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    openGame(link.dataset.game);
  });

  dialog.addEventListener('cancel', e => { e.preventDefault(); closeGame(); });
  dialog.addEventListener('click', e => {
    const target = e.target.closest('button, a');
    if (!target) return;
    if (target.matches('[data-close]')) closeGame();
    else if (target.dataset.swap) { e.preventDefault(); swapGame(target.dataset.swap); }
    else if (target.matches('[data-trailer]')) startTrailer(target);
    else if (target.dataset.shot) openViewer(Number(target.dataset.shot));
    else if (target.dataset.plates) scrollPlates(Number(target.dataset.plates));
  });

  setUpViewer();
}

// Moves to another game inside the open article without stacking history entries.
function swapGame(id) {
  history.replaceState(history.state, '', `#${encodeURIComponent(id)}`);
  dispatchEvent(new HashChangeEvent('hashchange'));
}

function showArticle(game) {
  const dialog = slot('article');
  if (current === game && dialog.open) return;
  stopLead();
  current = game;
  slot('article-scroll').innerHTML = articleHtml(game);
  slot('article-scroll').scrollTop = 0;
  if (!dialog.open) {
    opener = document.activeElement;
    dialog.showModal();
    document.documentElement.classList.add('is-locked');
  }
  fitWords(slot('article-scroll'));
  document.getElementById('article-title').focus({ preventScroll: true });
  setPageMeta(game, studio);
}

function hideArticle() {
  const dialog = slot('article');
  if (!dialog.open) return;
  stopLead();
  if (slot('viewer').open) slot('viewer').close();
  dialog.close();
  document.documentElement.classList.remove('is-locked');
  setPageMeta(null, studio);
  const back = opener?.isConnected ? opener : document.querySelector(`.row[data-game="${CSS.escape(current.id)}"]`);
  back?.focus({ preventScroll: !opener?.isConnected });
  current = null;
  opener = null;
}

function articleHtml(g) {
  const order = indexOrder();
  const i = order.indexOf(g);
  const prev = order[(i - 1 + order.length) % order.length];
  const next = order[(i + 1) % order.length];
  const portNote = item => (item.isPort ? `, ${portLabel(item).toLowerCase()}` : '');
  const shots = g.media.screenshots;

  return `
    <div class="article__bar wrap">
      <button class="btn-text" type="button" data-close><span aria-hidden="true">←</span> Index</button>
      <span class="article__count">No. ${pad(i + 1)} of ${pad(order.length)}</span>
      <span class="article__steps">
        <button class="btn-text" type="button" data-swap="${esc(prev.id)}" aria-label="Previous game: ${esc(prev.title)}${portNote(prev)}">←</button>
        <button class="btn-text" type="button" data-swap="${esc(next.id)}" aria-label="Next game: ${esc(next.title)}${portNote(next)}">→</button>
      </span>
    </div>

    <header class="article__head wrap">
      <p class="kicker">${esc([...g.genres, g.year].join(' · '))}</p>
      <h2 class="article__title" id="article-title" tabindex="-1" data-fit>${words(g.title)}</h2>
      ${g.isPort ? `<p class="article__port port-line">${portLine(g)}</p>` : ''}
      ${g.subtitle ? `<p class="article__subtitle">${esc(g.subtitle)}</p>` : ''}
      <p class="article__standfirst">${esc(g.summary)}</p>
    </header>

    <figure class="article__lead wrap">
      <div class="lead">
        <img src="${esc(g.media.hero)}" alt="${esc(g.title)} key art" decoding="async">
        ${g.media.trailer ? `<button class="lead__play" type="button" data-trailer>${icon('play', { size: 14 })} Watch the trailer</button>` : ''}
      </div>
    </figure>
    <div class="stores stores--lead wrap">${g.stores.map(store).join('')}</div>

    <div class="article__body wrap" style="--accent:${esc(g.accent)}">
      <aside class="facts" aria-label="Facts and stores">
        <div class="stores stores--facts">${g.stores.map(store).join('')}</div>
        <dl>${facts(g)}</dl>
        ${links(g)}
      </aside>
      <div class="article__text">
        <blockquote class="pull"><p>${esc(g.tagline)}</p></blockquote>
        ${g.description.length ? `<div class="article__columns">${g.description.map(p => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
        ${g.features.length ? `
          <section class="features" aria-label="Features">
            <h3>Features</h3>
            <ol>${g.features.map(f => `<li>${esc(f)}</li>`).join('')}</ol>
          </section>` : ''}
      </div>
    </div>

    ${shots.length ? `
      <section class="plates" aria-label="Screenshots">
        <div class="wrap">
          <div class="plates__bar">
            <h3>Screenshots, ${shots.length}</h3>
            <div class="plates__steps">
              <button class="btn-text" type="button" data-plates="-1" aria-label="Scroll screenshots back">←</button>
              <button class="btn-text" type="button" data-plates="1" aria-label="Scroll screenshots forward">→</button>
            </div>
          </div>
        </div>
        <div class="plates__track" tabindex="0" aria-label="Screenshots of ${esc(g.title)}, scroll sideways">
          ${shots.map((s, k) => `
            <figure class="plate${s.h > s.w ? ' plate--tall' : ''}">
              <button type="button" data-shot="${k}" aria-label="Enlarge screenshot ${k + 1}">
                <img src="${esc(s.src)}" width="${s.w}" height="${s.h}" alt="${esc(g.title)} screenshot ${k + 1}" loading="lazy" decoding="async">
              </button>
              <figcaption><b>Fig. ${k + 1}</b>${esc(g.title)}</figcaption>
            </figure>`).join('')}
        </div>
      </section>` : ''}

    ${next !== g ? `
      <div class="wrap">
        <div class="article__next-rule"></div>
        <a class="article__next" href="${next.url}" data-swap="${esc(next.id)}">
          <span class="kicker">Next in the index${portTag(next, ' port--quiet')}</span>
          <b data-fit>${words(next.title)}</b>
        </a>
      </div>` : ''}`;
}

function store(s) {
  return `
    <a class="store" href="${esc(s.url)}" ${external}>
      ${icon(s.type)}
      <span><small>${s.type === 'web' ? 'Play now' : 'Get it on'}</small><b>${esc(s.label)}</b></span>
    </a>`;
}

function facts(g) {
  const rows = [
    ['Released', g.year],
    ['Platforms', esc(g.platformLabels.join(', '))],
    ['Genre', esc(g.genres.join(', '))],
    g.badge && ['In short', esc(g.badge)],
    g.highlights.length && ['Highlights', `<ul>${g.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>`],
    g.credits && ['Credits', esc(g.credits)],
  ].filter(Boolean);
  return rows.map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`).join('');
}

function links(g) {
  const items = [
    g.website && `<li><a href="${esc(g.website)}">Official page</a></li>`,
    g.privacy && `<li><a href="${esc(g.privacy)}">Privacy policy</a></li>`,
  ].filter(Boolean);
  return items.length ? `<ul class="facts__links">${items.join('')}</ul>` : '';
}

function startTrailer(button) {
  const lead = button.closest('.lead');
  const video = document.createElement('video');
  video.setAttribute('aria-label', `${current.title} trailer`);
  lead.append(video);
  button.remove();
  playTrailer(video, current.media.trailer);
  video.focus();
}

function stopLead() {
  const video = slot('article-scroll').querySelector('.lead video');
  if (video) stopTrailer(video);
}

function scrollPlates(direction) {
  const track = slot('article-scroll').querySelector('.plates__track');
  track?.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

// ---------------------------------------------------------------- screenshot viewer

function setUpViewer() {
  const viewer = slot('viewer');
  viewer.addEventListener('click', e => {
    const action = e.target.closest('[data-viewer]')?.dataset.viewer;
    if (action === 'close') viewer.close();
    if (action === 'prev') stepViewer(-1);
    if (action === 'next') stepViewer(1);
  });
  viewer.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') stepViewer(-1);
    if (e.key === 'ArrowRight') stepViewer(1);
  });
  let startX = null;
  const img = slot('viewer-img');
  img.addEventListener('pointerdown', e => { startX = e.clientX; });
  img.addEventListener('pointerup', e => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 40) stepViewer(dx < 0 ? 1 : -1);
    startX = null;
  });
}

function openViewer(index) {
  shotIndex = index;
  showShot();
  slot('viewer').showModal();
}

function stepViewer(step) {
  const total = current.media.screenshots.length;
  shotIndex = (shotIndex + step + total) % total;
  showShot();
}

function showShot() {
  const shots = current.media.screenshots;
  const shot = shots[shotIndex];
  const img = slot('viewer-img');
  img.src = shot.src;
  img.alt = `${current.title} screenshot ${shotIndex + 1}`;
  slot('viewer-caption').textContent = `Fig. ${shotIndex + 1}. ${current.title}`;
  slot('viewer-count').textContent = `${shotIndex + 1} / ${shots.length}`;
  slot('viewer').querySelectorAll('[data-viewer="prev"], [data-viewer="next"]').forEach(b => { b.hidden = shots.length < 2; });
}
