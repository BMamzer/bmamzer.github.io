#!/usr/bin/env node
// Downloads a Google Font into assets/fonts/<slug>/ so the site never calls Google (no visitor IPs sent).
// Keeps the latin and latin-ext subsets (latin-ext covers Polish). Writes font.css to link from a page.
//
//   node tools/fetch-font.mjs "Cinzel:wght@400;700"
//   node tools/fetch-font.mjs "Inter:ital,wght@0,400;0,700;1,400"

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spec = process.argv[2];
if (!spec) {
  console.error('Usage: node tools/fetch-font.mjs "Family Name:wght@400;700"');
  process.exit(1);
}
const family = spec.split(':')[0];
const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const dir = join(ROOT, 'assets/fonts', slug);
mkdirSync(dir, { recursive: true });

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';
const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec).replace(/%20/g, '+')}&display=swap`;
const css = await (await fetch(cssUrl, { headers: { 'User-Agent': UA } })).text();
if (!css.includes('@font-face')) {
  console.error(`Google Fonts returned no fonts for "${spec}":\n${css.slice(0, 300)}`);
  process.exit(1);
}

// Variable fonts come back as one file listed once per weight; save it once with a weight range.
const faces = new Map();
for (const [, subset, body] of css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face\s*{([^}]+)}/g)) {
  if (subset !== 'latin' && subset !== 'latin-ext') continue;
  const src = body.match(/url\((https:[^)]+\.woff2)\)/)[1];
  const style = body.match(/font-style:\s*(\w+)/)[1];
  const weights = body.match(/font-weight:\s*([\d ]+)/)[1].trim().split(/\s+/).map(Number);
  const face = faces.get(src) || { subset, style, body, min: Infinity, max: -Infinity };
  face.min = Math.min(face.min, ...weights);
  face.max = Math.max(face.max, ...weights);
  faces.set(src, face);
}

let out = `/* ${family}, self-hosted from Google Fonts (SIL Open Font License). Made by tools/fetch-font.mjs */\n`;
for (const [src, { subset, style, body, min, max }] of faces) {
  const weight = min === max ? `${min}` : `${min} ${max}`;
  const file = `${slug}-${weight.replace(' ', '-')}${style === 'italic' ? '-italic' : ''}-${subset}.woff2`;
  writeFileSync(join(dir, file), Buffer.from(await (await fetch(src)).arrayBuffer()));
  out += `@font-face {${body.replace(src, `/assets/fonts/${slug}/${file}`).replace(/font-weight:\s*[\d ]+;/, `font-weight: ${weight};`)}}\n`;
}
const count = faces.size;
writeFileSync(join(dir, 'font.css'), out);
console.log(`Saved ${count} files. Link it with: <link rel="stylesheet" href="/assets/fonts/${slug}/font.css">`);
