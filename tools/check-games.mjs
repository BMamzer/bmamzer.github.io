#!/usr/bin/env node
// Checks games.json before you push: required fields, known values and that every image exists.
//   node tools/check-games.mjs

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STORES = ['steam', 'appstore', 'googleplay', 'itch', 'crazygames', 'web'];
const PLATFORMS = ['pc', 'ios', 'android', 'web'];
const errors = [];
const warnings = [];

let data;
try {
  data = JSON.parse(readFileSync(join(ROOT, 'games.json'), 'utf8'));
} catch (e) {
  console.error(`games.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

const s = data.studio || {};
for (const key of ['name', 'tagline', 'email']) if (!s[key]) errors.push(`studio.${key} is missing`);
if (s.support && !(s.support.label && /^https:\/\//.test(s.support.url || ''))) errors.push('studio.support needs a label and an https url');

const ids = new Set();
for (const [i, g] of (data.games || []).entries()) {
  const at = g.id || `games[${i}]`;
  const need = (cond, msg) => cond || errors.push(`${at}: ${msg}`);
  const want = (cond, msg) => cond || warnings.push(`${at}: ${msg}`);

  need(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id || ''), 'id must be a lowercase slug like "my-game"');
  need(!ids.has(g.id), 'id is used twice');
  ids.add(g.id);
  for (const key of ['title', 'tagline', 'summary']) need(typeof g[key] === 'string' && g[key].trim(), `${key} is missing`);
  need(/^\d{4}(-\d{2}(-\d{2})?)?$/.test(g.released || ''), 'released must be YYYY, YYYY-MM or YYYY-MM-DD');
  need(Array.isArray(g.platforms) && g.platforms.length && g.platforms.every(p => PLATFORMS.includes(p)),
    `platforms must be a list of ${PLATFORMS.join(', ')}`);
  need(Array.isArray(g.stores) && g.stores.length, 'needs at least one store link (only released games go on the site)');
  for (const st of g.stores || []) {
    need(STORES.includes(st.type), `unknown store type "${st.type}" (use ${STORES.join(', ')})`);
    need(/^https:\/\//.test(st.url || ''), `store link for ${st.type} must start with https://`);
  }
  need(Array.isArray(g.genres) && g.genres.length, 'genres is missing');
  need(/^#[0-9a-f]{6}$/i.test(g.accent || ''), 'accent must be a hex colour like #3cc6e6');
  if ('originalDeveloper' in g) need(typeof g.originalDeveloper === 'string' && g.originalDeveloper.trim(), 'originalDeveloper must name the studio that made the original game');
  want(Array.isArray(g.description) && g.description.length, 'no description paragraphs');
  want(g.tagline?.length <= 70, 'tagline is long (keep it under 70 characters)');
  want(g.summary?.length <= 240, 'summary is long (keep it under 240 characters)');
  for (const text of [g.title, g.tagline, g.summary, ...(g.description || []), ...(g.features || [])])
    want(!/\u2014/.test(text || ''), 'uses an em dash; use a comma, colon or new sentence');

  const m = g.media || {};
  need(m.cover, 'media.cover is missing');
  const files = [m.cover, m.hero, m.poster, m.logo, m.icon, m.loop, m.loopPoster, ...(m.screenshots || []).map(x => x.src)];
  for (const f of files.filter(Boolean)) need(existsSync(join(ROOT, f)), `file not found: ${f}`);
  for (const local of [g.website, g.privacy].filter(u => u && u.startsWith('/'))) {
    const path = join(ROOT, local);
    need(existsSync(path) || existsSync(join(path, 'index.html')) || existsSync(`${path}.html`), `page not found: ${local}`);
  }
  want(m.hero, 'no media.hero (wide background art); designs fall back to the cover');
  want((m.screenshots || []).length >= 3, 'fewer than 3 screenshots');
}

for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
console.log(errors.length ? `\n${errors.length} error(s). Fix them before pushing.` : `games.json OK: ${ids.size} games.`);
process.exit(errors.length ? 1 : 0);
