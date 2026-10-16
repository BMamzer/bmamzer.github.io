# bartmamzer.com

- GitHub Pages site for bartmamzer.com, served from the `gh-pages` branch with no build step. The repo is public.
- Only released games go on the site; never name an unreleased game in any file or commit message.
- All game content is in `games.json` and `assets/games/<id>/`; add or update games with docs/adding-games.md.
- Run `node tools/check-games.mjs` before every push that touches `games.json`.
- Never move or delete privacy policy pages, `app-ads.txt` or `CNAME`: stores and ad networks link to those paths.
- Never link privacy policies from the site (footer or game pages); the store listings link them.
- Fonts are self-hosted with `tools/fetch-font.mjs`; no Google Fonts CDN, no analytics, no cookies.
- No em dashes anywhere.
- `tt/`, `ig/`, `yt/` are the social bio-link pages (code in `bio/`): only games on the social media guide's released list, hard-coded in `bio/bio.js`, never read from games.json.
