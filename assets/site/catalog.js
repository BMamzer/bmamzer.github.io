// Shared data layer for every design: loads /games.json and gives each design the same tidy game list.
// A design only decides how things look; what is on the site lives in games.json (see ADDING-GAMES.md).

export const STORE_LABELS = {
  steam: 'Steam',
  appstore: 'App Store',
  googleplay: 'Google Play',
  itch: 'itch.io',
  crazygames: 'CrazyGames',
  web: 'Play in browser',
};

export const PLATFORM_LABELS = { pc: 'PC', ios: 'iOS', android: 'Android', web: 'Web' };

// Brand marks from Simple Icons (CC0), 24x24 viewBox.
const ICON_PATHS = {
  steam: 'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z',
  appstore: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701',
  googleplay: 'M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z',
  itch: 'M3.13 1.338C2.08 1.96.02 4.328 0 4.95v1.03c0 1.303 1.22 2.45 2.325 2.45 1.33 0 2.436-1.102 2.436-2.41 0 1.308 1.07 2.41 2.4 2.41 1.328 0 2.362-1.102 2.362-2.41 0 1.308 1.137 2.41 2.466 2.41h.024c1.33 0 2.466-1.102 2.466-2.41 0 1.308 1.034 2.41 2.363 2.41 1.33 0 2.4-1.102 2.4-2.41 0 1.308 1.106 2.41 2.435 2.41C22.78 8.43 24 7.282 24 5.98V4.95c-.02-.62-2.082-2.99-3.13-3.612-3.253-.114-5.508-.134-8.87-.133-3.362 0-7.945.053-8.87.133zm6.376 6.477a2.74 2.74 0 0 1-.468.602c-.5.49-1.19.795-1.947.795a2.786 2.786 0 0 1-1.95-.795c-.182-.178-.32-.37-.446-.59-.127.222-.303.412-.486.59a2.788 2.788 0 0 1-1.95.795c-.092 0-.187-.025-.264-.052-.107 1.113-.152 2.176-.168 2.95v.005l-.006 1.167c.02 2.334-.23 7.564 1.03 8.85 1.952.454 5.545.662 9.15.663 3.605 0 7.198-.21 9.15-.664 1.26-1.284 1.01-6.514 1.03-8.848l-.006-1.167v-.004c-.016-.775-.06-1.838-.168-2.95-.077.026-.172.052-.263.052a2.788 2.788 0 0 1-1.95-.795c-.184-.178-.36-.368-.486-.59-.127.22-.265.412-.447.59a2.786 2.786 0 0 1-1.95.794c-.76 0-1.446-.303-1.948-.793a2.74 2.74 0 0 1-.468-.602 2.738 2.738 0 0 1-.463.602 2.787 2.787 0 0 1-1.95.794h-.16a2.787 2.787 0 0 1-1.95-.793 2.738 2.738 0 0 1-.464-.602zm-2.004 2.59v.002c.795.002 1.5 0 2.373.953.687-.072 1.406-.108 2.125-.107.72 0 1.438.035 2.125.107.873-.953 1.578-.95 2.372-.953.376 0 1.876 0 2.92 2.934l1.123 4.028c.832 2.995-.266 3.068-1.636 3.07-2.03-.075-3.156-1.55-3.156-3.025-1.124.184-2.436.276-3.748.277-1.312 0-2.624-.093-3.748-.277 0 1.475-1.125 2.95-3.156 3.026-1.37-.004-2.468-.077-1.636-3.072l1.122-4.027c1.045-2.934 2.545-2.934 2.92-2.934zM12 12.714c-.002.002-2.14 1.964-2.523 2.662l1.4-.056v1.22c0 .056.56.033 1.123.007.562.026 1.124.05 1.124-.008v-1.22l1.4.055C14.138 14.677 12 12.713 12 12.713z',
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  bluesky: 'M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z',
  facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  // Generic marks for links without a brand icon.
  web: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.9a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8ZM12 4a13.8 13.8 0 0 1 1.9 4h-3.8A13.8 13.8 0 0 1 12 4ZM4.3 14a8.2 8.2 0 0 1 0-4h3.3a16.5 16.5 0 0 0 0 4H4.3Zm.8 2h2.9a15.7 15.7 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16ZM8 8H5.1a8 8 0 0 1 4.3-3.6A15.7 15.7 0 0 0 8 8Zm4 12a13.8 13.8 0 0 1-1.9-4h3.8A13.8 13.8 0 0 1 12 20Zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4Zm.3 5.6a15.7 15.7 0 0 0 1.4-3.6h2.9a8 8 0 0 1-4.3 3.6Zm1.8-5.6a16.5 16.5 0 0 0 0-4h3.3a8.2 8.2 0 0 1 0 4h-3.3Z',
  crazygames: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 18a5.5 5.5 0 0 1-5-3.2h10A5.5 5.5 0 0 1 12 18Z',
  mail: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7.2L4.4 7H4v1.3l8 5.4 8-5.4V7h-.4L12 12.2Z',
  play: 'M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z',
};

/** Inline SVG for a store, social network or one of: web, mail, play. Uses currentColor. */
export function icon(name, { size = 20, title = '' } = {}) {
  const d = ICON_PATHS[name] || ICON_PATHS.web;
  const label = title ? `<title>${esc(title)}</title>` : '';
  return `<svg class="icon icon-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" ${title ? 'role="img"' : 'aria-hidden="true"'} focusable="false">${label}<path d="${d}"/></svg>`;
}

/** Escapes text for use inside HTML. Always use it for values from games.json. */
export function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function normalize(game) {
  const media = game.media || {};
  const year = Number(String(game.released).slice(0, 4));
  return {
    ...game,
    subtitle: game.subtitle || '',
    description: game.description || [],
    features: game.features || [],
    genres: game.genres || [],
    highlights: game.highlights || [],
    featured: game.featured !== false,
    year,
    sortKey: String(game.released).padEnd(10, '-'),
    stores: (game.stores || []).map(s => ({ ...s, label: s.label || STORE_LABELS[s.type] || s.type })),
    platformLabels: (game.platforms || []).map(p => PLATFORM_LABELS[p] || p),
    url: `#${game.id}`,
    media: {
      ...media,
      hero: media.hero || media.cover,
      poster: media.poster || media.cover,
      screenshots: media.screenshots || [],
    },
  };
}

/**
 * Loads games.json. Returns:
 *   studio      studio info (name, about, links, stats...)
 *   games       every game, newest first
 *   featured    games with featured !== false, newest first
 *   earlier     older games marked featured: false
 *   spotlight   the games named in studio.spotlight (or the newest featured ones)
 *   platforms   platform keys that appear in the catalog, for filters
 *   genres      genre names that appear in the catalog, for filters
 */
export async function loadCatalog(url = '/games.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  const data = await res.json();
  stressTest(data);
  const games = data.games.map(normalize).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  const byId = new Map(games.map(g => [g.id, g]));
  const featured = games.filter(g => g.featured);
  const spotlight = (data.studio.spotlight || []).map(id => byId.get(id)).filter(Boolean);
  return {
    studio: { links: [], about: [], stats: [], ...data.studio },
    games,
    featured,
    earlier: games.filter(g => !g.featured),
    spotlight: spotlight.length ? spotlight : featured.slice(0, 4),
    byId,
    platforms: Object.keys(PLATFORM_LABELS).filter(p => games.some(g => g.platforms.includes(p))),
    genres: [...new Set(games.flatMap(g => g.genres))],
  };
}

// Layout testing only: ?stress=40 repeats the catalog up to 40 games so designs can be checked with a big library.
function stressTest(data) {
  const n = Number(new URLSearchParams(location.search).get('stress'));
  if (!n) return;
  const base = data.games.slice();
  for (let i = base.length; i < n; i++) {
    const g = base[i % base.length];
    data.games.push({ ...g, id: `${g.id}-${i}`, title: `${g.title} ${i}`, released: `${2014 + (i % 12)}-0${1 + (i % 9)}-15` });
  }
}

/** Privacy policy links for the footer, one per policy page, e.g. "Powerlust privacy policy". */
export function privacyLinks({ games }) {
  const byUrl = new Map();
  for (const g of games) {
    if (!g.privacy) continue;
    byUrl.set(g.privacy, [...(byUrl.get(g.privacy) || []), g.title]);
  }
  return [...byUrl].map(([url, titles]) => ({ url, label: `${sharedName(titles)} privacy policy` }));
}

// "Legends of Amberland" for ["Legends of Amberland II", "Legends of Amberland"].
function sharedName(titles) {
  if (titles.length === 1) return titles[0];
  const words = titles.map(t => t.split(' '));
  const common = [];
  for (let i = 0; words.every(w => w[i] && w[i] === words[0][i]); i++) common.push(words[0][i]);
  return common.join(' ') || titles[0];
}

/** "2026" or "May 2026" (pass { month: true }). */
export function releaseLabel(game, { month = false } = {}) {
  const [y, m] = String(game.released).split('-');
  return month && m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
}

/** Calls fn(game or null) now and whenever the URL hash changes. #powerlust opens Powerlust. */
export function onRoute(catalog, fn) {
  const run = () => fn(catalog.byId.get(decodeURIComponent(location.hash.slice(1))) || null);
  addEventListener('hashchange', run);
  run();
}

/** Opens a game's detail view by changing the hash, which keeps the back button working. */
export function openGame(id) {
  history.pushState({ fromList: true }, '', `#${encodeURIComponent(id)}`);
  dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Closes the detail view without leaving a "#" history step behind. */
export function closeGame() {
  if (history.state?.fromList) history.back();
  else history.replaceState(null, '', location.pathname + location.search);
  dispatchEvent(new HashChangeEvent('hashchange'));
}

/** True when the visitor asked for less motion; designs should skip autoplay and big animations. */
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let hlsLoading;
/**
 * Plays a game's full trailer (an HLS stream from Steam) in a <video> element.
 * Safari plays HLS natively; other browsers load hls.js on first use.
 */
export async function playTrailer(video, src) {
  video.controls = true;
  video.playsInline = true;
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
  } else {
    hlsLoading ||= new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
      s.onload = () => resolve(window.Hls);
      s.onerror = reject;
      document.head.append(s);
    });
    const Hls = await hlsLoading;
    if (video._hls) video._hls.destroy();
    video._hls = new Hls({ capLevelToPlayerSize: true });
    video._hls.loadSource(src);
    video._hls.attachMedia(video);
  }
  try { await video.play(); } catch { /* the user can press play */ }
}

/** Stops a trailer started with playTrailer and frees the stream. */
export function stopTrailer(video) {
  video.pause();
  if (video._hls) { video._hls.destroy(); video._hls = null; }
  video.removeAttribute('src');
  video.load();
}

/** Sets document title and description for the open game, and restores them when closed. */
const baseTitle = document.title;
const baseDescription = document.querySelector('meta[name="description"]')?.content || '';
export function setPageMeta(game, studio) {
  document.title = game ? `${game.title} | ${studio.name}` : baseTitle;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = game ? game.summary : baseDescription;
}

/** Adds JSON-LD for the studio and its games so search engines understand the page. */
export function addStructuredData({ studio, games }) {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: studio.name, url: studio.url, email: studio.email,
        sameAs: studio.links.map(l => l.url) },
      ...games.map(g => ({
        '@type': 'VideoGame', name: g.title, description: g.summary, genre: g.genres,
        datePublished: g.released, image: new URL(g.media.cover, location.origin).href,
        gamePlatform: g.platformLabels, author: { '@type': 'Person', name: studio.name },
        url: g.stores[0]?.url,
      })),
    ],
  };
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(data);
  document.head.append(s);
}
