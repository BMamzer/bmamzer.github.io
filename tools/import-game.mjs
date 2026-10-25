#!/usr/bin/env node
// Adds a released game to games.json and fetches its art into assets/games/<id>/.
// Needs Node 18+, ImageMagick (magick) and, for Steam trailers, ffmpeg.
// See ADDING-GAMES.md for the full workflow.
//
//   node tools/import-game.mjs --id arcane-plunder --steam 4042600
//   node tools/import-game.mjs --id powerlust --steam 1829520 --ios 1439088319 --android bartmamzer.powerlust.actionrpg.roguelike
//   node tools/import-game.mjs --id my-game --ios 123 --hero ~/art/key.png --logo ~/art/logo.png
//
// Options:
//   --id <slug>            folder and JSON id (lowercase, dashes)
//   --steam <appid>        Steam app id
//   --ios <trackId>        App Store id (the number after "id" in the URL)
//   --android <package>    Google Play package name
//   --hero/--cover/--poster/--logo/--icon <file or URL>   override any image
//   --shots-from steam|ios|android   where screenshots come from (default: first available)
//   --max-shots <n>        default 6
//   --loop-start <sec>     where the muted trailer loop starts (default 12)
//   --no-loop              skip the trailer loop
//   --dry                  print the entry, don't write games.json

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';
const STEAM_CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/';

const args = parseArgs(process.argv.slice(2));
if (!args.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(args.id)) fail('Pass --id as a lowercase slug, e.g. --id arcane-plunder');
if (!args.steam && !args.ios && !args.android) fail('Pass at least one of --steam, --ios, --android');

const id = args.id;
const webDir = `/assets/games/${id}`;
const outDir = join(ROOT, webDir);
const tmp = join(tmpdir(), `import-game-${id}-${process.pid}`);
mkdirSync(outDir, { recursive: true });
mkdirSync(tmp, { recursive: true });

const found = { stores: [], genres: new Set(), shots: {}, dates: [] };

if (args.steam) await fromSteam(args.steam);
if (args.ios) await fromAppStore(args.ios);
if (args.android) await fromGooglePlay(args.android);

const media = {};

// Images: explicit overrides win, then store art, then fallbacks built from screenshots.
await image('hero', args.hero || found.hero, { width: 2400, quality: 80 });
await image('cover', args.cover || found.cover, { width: 1280, quality: 82 });
await image('poster', args.poster || found.poster, { width: 900, quality: 82 });
await image('logo', args.logo || found.logo, { width: 1200, quality: 90, trim: true });
await image('icon', args.icon || found.icon, { width: 512, quality: 88, square: true });

const shotSource = args['shots-from'] || ['steam', 'android', 'ios'].find(s => found.shots[s]?.length);
const shotUrls = (found.shots[shotSource] || []).slice(0, Number(args['max-shots'] || 6));
rmSync(join(outDir, 'shots'), { recursive: true, force: true });
media.screenshots = [];
for (const [i, url] of shotUrls.entries()) {
  const name = `shots/${String(i + 1).padStart(2, '0')}.webp`;
  const src = await download(url, `shot${i}`);
  convert(src, join(outDir, name), { width: 1600, quality: 78 });
  const [w, h] = size(join(outDir, name));
  media.screenshots.push({ src: `${webDir}/${name}`, w, h });
}

const firstWide = media.screenshots.find(s => s.w > s.h);
if (!media.cover && firstWide) {
  convert(join(ROOT, firstWide.src), join(outDir, 'cover.webp'), { width: 1280, quality: 82, crop: '16:9' });
  media.cover = `${webDir}/cover.webp`;
}
if (!media.hero && (firstWide || media.cover)) {
  convert(join(ROOT, (firstWide || { src: media.cover }).src), join(outDir, 'hero.webp'), { width: 2400, quality: 80 });
  media.hero = `${webDir}/hero.webp`;
}
if (!media.cover) fail('No cover art found. Pass --cover <file>.');

if (found.trailer) media.trailer = found.trailer;
if (found.loopSource && !args['no-loop']) await makeLoop(found.loopSource, Number(args['loop-start'] ?? 12));

const accent = accentColor(join(ROOT, media.cover));
const platforms = [...new Set(found.stores.map(s => ({ steam: 'pc', appstore: 'ios', googleplay: 'android' }[s.type])))];
const released = found.dates.sort()[0] || '';

const draft = {
  id,
  title: found.title || id,
  tagline: '',
  summary: found.summary || '',
  description: found.description || [],
  genres: [...found.genres].slice(0, 4),
  released,
  platforms,
  stores: found.stores,
  accent,
  featured: true,
  media,
};

rmSync(tmp, { recursive: true, force: true });

if (args.dry) {
  console.log(JSON.stringify(draft, null, 2));
  process.exit(0);
}

const file = join(ROOT, 'games.json');
const data = JSON.parse(readFileSync(file, 'utf8'));
const existing = data.games.find(g => g.id === id);
if (existing) {
  // Re-import refreshes art and store links but keeps hand-written text.
  existing.media = { ...existing.media, ...media };
  for (const s of found.stores) {
    const i = existing.stores.findIndex(x => x.type === s.type);
    if (i >= 0) existing.stores[i] = { ...existing.stores[i], url: s.url };
    else existing.stores.push(s);
  }
  existing.platforms = [...new Set([...existing.platforms, ...platforms])];
  console.log(`Updated ${id}: art and store links refreshed, text kept.`);
} else {
  data.games.push(draft);
  console.log(`Added ${id}. Now write its tagline, summary and description by hand, then run: node tools/check-games.mjs`);
}
writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

// ---------------------------------------------------------------- sources

async function fromSteam(appid) {
  const details = (await json(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=english`))[appid];
  if (!details?.success) fail(`Steam app ${appid} not found`);
  const d = details.data;
  if (d.release_date?.coming_soon) fail(`${d.name} is not released on Steam yet. Only released games go on the site.`);

  const input = { ids: [{ appid: Number(appid) }], context: { language: 'english', country_code: 'US' },
    data_request: { include_assets: true, include_trailers: true, include_release: true } };
  const items = await json(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`);
  const item = items.response.store_items[0];
  const a = item.assets || {};
  const asset = name => name && STEAM_CDN + a.asset_url_format.replace('${FILENAME}', name);

  found.title ??= d.name;
  found.summary ??= decode(d.short_description);
  found.description ??= paragraphs(d.about_the_game);
  d.genres?.forEach(g => found.genres.add(g.description));
  // Steam shows the date in Pacific time; the unix timestamp can land on the next day in UTC.
  const shown = Date.parse(`${d.release_date?.date} 12:00 UTC`);
  if (!Number.isNaN(shown)) found.dates.push(isoDate(shown));
  else if (item.release?.steam_release_date) found.dates.push(isoDate(item.release.steam_release_date * 1000));
  found.stores.push({ type: 'steam', url: `https://store.steampowered.com/app/${appid}/` });

  found.hero = asset(a.library_hero_2x || a.library_hero);
  found.cover = asset(a.main_capsule_2x || a.main_capsule || a.header_2x || a.header);
  found.poster = asset(a.library_capsule_2x || a.library_capsule);
  const logo = `${STEAM_CDN}steam/apps/${appid}/logo_2x.png`;
  const logo1x = `${STEAM_CDN}steam/apps/${appid}/logo.png`;
  found.logo = (await exists(logo)) ? logo : (await exists(logo1x)) ? logo1x : undefined;
  found.shots.steam = (d.screenshots || []).map(s => s.path_full);

  const movie = (d.movies || []).find(m => m.highlight) || d.movies?.[0];
  if (movie?.hls_h264) {
    found.trailer = movie.hls_h264;
    found.loopSource = movie.hls_h264;
  }
}

async function fromAppStore(trackId) {
  const r = (await json(`https://itunes.apple.com/lookup?id=${trackId}&country=us`)).results?.[0];
  if (!r) fail(`App Store app ${trackId} not found`);
  if (new Date(r.releaseDate) > new Date()) console.warn(`Note: ${r.trackName} is a pre-order on the App Store until ${r.releaseDate.slice(0, 10)}.`);
  else found.dates.push(r.releaseDate.slice(0, 10));
  found.title ??= r.trackName.replace(/\s+[-:–]\s+.*$/, '');
  found.summary ??= r.description.split('\n').find(l => l.trim().length > 40)?.trim();
  found.description ??= r.description.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 60).slice(0, 4);
  r.genres?.filter(g => g !== 'Games').forEach(g => found.genres.add(g));
  found.stores.push({ type: 'appstore', url: `https://apps.apple.com/app/id${trackId}` });
  found.icon ??= r.artworkUrl512?.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/1024x1024bb.png');
  found.shots.ios = [...(r.screenshotUrls || [])].map(u => u.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/2400x2400bb.jpg'));
}

async function fromGooglePlay(pkg) {
  const url = `https://play.google.com/store/apps/details?id=${pkg}&hl=en&gl=us`;
  const html = await text(url);
  if (/Pre-register/i.test(html)) fail(`${pkg} is in pre-registration. Only released games go on the site.`);
  const title = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
  found.title ??= title && decode(title).replace(/\s+-\s+Apps on Google Play$/, '').replace(/\s+[-:–]\s+.*$/, '');
  found.stores.push({ type: 'googleplay', url: `https://play.google.com/store/apps/details?id=${pkg}` });
  const icon = html.match(/<meta property="og:image" content="([^"=]+)/)?.[1];
  if (icon) found.icon ??= `${icon}=s1024`;
  // Play has put src both before and after alt, so match the whole tag.
  const shots = [...html.matchAll(/<img[^>]*alt="Screenshot image"[^>]*>/g)].map(m => m[0].match(/src="([^"=]+)/)?.[1]).filter(Boolean);
  found.shots.android = [...new Set(shots)].map(u => `${u}=w2400`);
}

// ---------------------------------------------------------------- media helpers

async function image(kind, from, opts) {
  if (!from) return;
  const src = /^https?:/.test(from) ? await download(from, kind) : resolve(from.replace(/^~/, process.env.HOME));
  if (!existsSync(src)) fail(`${kind}: ${from} not found`);
  convert(src, join(outDir, `${kind}.webp`), opts);
  media[kind] = `${webDir}/${kind}.webp`;
}

function convert(src, dest, { width, quality, trim, square, crop }) {
  mkdirSync(dirname(dest), { recursive: true });
  const ops = [`${src}[0]`, '-auto-orient'];
  if (trim) ops.push('-trim', '+repage');
  if (crop === '16:9') ops.push('-gravity', 'center', '-crop', '16:9', '+repage');
  if (square) ops.push('-gravity', 'center', '-crop', '1:1', '+repage');
  ops.push('-resize', `${width}x${width * 4}>`, '-strip', '-quality', String(quality));
  if (trim) ops.push('-define', 'webp:alpha-quality=100');
  ops.push(dest);
  execFileSync('magick', ops, { stdio: 'inherit' });
}

function size(file) {
  return execFileSync('magick', ['identify', '-format', '%w %h', `${file}[0]`]).toString().trim().split(' ').map(Number);
}

function accentColor(file) {
  // Most frequent colour among the vivid, mid-brightness ones: reads well as a button or glow.
  const hist = execFileSync('magick', [file, '-resize', '80x80', '-colors', '12', '-format', '%c', 'histogram:info:-']).toString();
  let best = { score: -1, hex: '#c8a24a' };
  for (const line of hist.split('\n')) {
    const m = line.match(/(\d+):.*#([0-9A-Fa-f]{6})/);
    if (!m) continue;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(m[2].slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    const score = Number(m[1]) * sat ** 2 * (l > 0.25 && l < 0.75 ? 1 : 0.2);
    if (score > best.score) best = { score, hex: `#${m[2].toLowerCase()}` };
  }
  return best.hex;
}

async function makeLoop(master, start) {
  // A short, silent, 720p clip for autoplaying backgrounds. The full trailer streams from Steam.
  const list = await text(master);
  const lines = list.split('\n');
  const i = lines.findIndex(l => /RESOLUTION=1280x720/.test(l));
  const variant = new URL(i >= 0 ? lines[i + 1].trim() : lines.find(l => l && !l.startsWith('#')).trim(), master).href;
  const out = join(outDir, 'loop.mp4');
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start), '-i', variant, '-t', '8', '-an',
      '-vf', 'scale=1280:-2,fps=30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', out], { stdio: 'inherit' });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-frames:v', '1', join(tmp, 'loop.png')]);
    convert(join(tmp, 'loop.png'), join(outDir, 'loop.webp'), { width: 1280, quality: 78 });
    media.loop = `${webDir}/loop.mp4`;
    media.loopPoster = `${webDir}/loop.webp`;
  } catch (e) {
    console.warn('Could not make the trailer loop (is ffmpeg installed?). Skipping it.');
  }
}

// ---------------------------------------------------------------- small utils

async function download(url, name) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) fail(`Download failed (${res.status}): ${url}`);
  const file = join(tmp, `${name}-${readdirSync(tmp).length}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}
async function exists(url) {
  const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
  return res.ok;
}
async function json(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) fail(`Request failed (${res.status}): ${url}`);
  return res.json();
}
async function text(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  if (!res.ok) fail(`Request failed (${res.status}): ${url}`);
  return res.text();
}
function decode(s = '') {
  return s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
function paragraphs(html = '') {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h\d|li)>/gi, '\n\n').replace(/<[^>]+>/g, ''))
    .split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(p => p.length > 60).slice(0, 4);
}
function isoDate(ms) { return new Date(ms).toISOString().slice(0, 10); }
function parseArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i++) {
    const key = list[i].replace(/^--/, '');
    out[key] = list[i + 1] && !list[i + 1].startsWith('--') ? list[++i] : true;
  }
  return out;
}
function fail(msg) { console.error(msg); process.exit(1); }
