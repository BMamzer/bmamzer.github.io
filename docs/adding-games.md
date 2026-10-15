# Adding a game to bartmamzer.com

The site lists released games only. Everything it shows comes from `games.json`, and each game's art lives in
`assets/games/<id>/`. Adding a game never needs a change to the page design.

This repo is public: never put an unreleased game in `games.json`, in `assets/` or in a commit message.

## Steps

1. Import the store data and art (use any combination of stores):

   ```sh
   node tools/import-game.mjs --id my-game --steam 1234560
   node tools/import-game.mjs --id my-game --ios 6700000000 --android com.example.mygame
   ```

   - Steam gives wide art (`hero`), the main capsule (`cover`), the library capsule (`poster`), the logo when Steam has
     one, screenshots, the full trailer and an 8 second silent loop for backgrounds (needs ffmpeg).
   - The App Store and Google Play give the icon and screenshots. Without Steam, the cover and hero are cut from the
     first wide screenshot, so pass better art when you have it: `--hero`, `--cover`, `--poster`, `--logo`, `--icon`
     take a local file or a URL.
   - The script stops if a game is still "coming soon" on Steam or in pre-registration on Google Play.
   - Running it again for an existing id refreshes the art and store links and keeps the text.

2. Write the text by hand in the new entry. The script copies store text as a draft and leaves `tagline` empty.
   Plain English, no em dashes, no invented facts.

3. Check it: `node tools/check-games.mjs`

4. Look at it: run `python3 -m http.server 8765` in the repo and open `http://localhost:8765/` and
   `http://localhost:8765/#my-game` on a phone-sized window too.

5. Commit `games.json` and `assets/games/my-game/` by explicit path and push to `gh-pages`. GitHub Pages publishes
   in about a minute.

## Fields

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | Lowercase slug, also the folder name and the link (`bartmamzer.com/#my-game`) |
| `title` | yes | Game name without the store subtitle |
| `subtitle` | no | Short descriptor, e.g. "Fantasy Kingdom Sim" |
| `tagline` | yes | One-line hook, under 70 characters |
| `summary` | yes | One or two sentences, under 240 characters. Also the page description when the game is open |
| `description` | no | List of paragraphs for the game's detail view |
| `features` | no | Short bullet points |
| `genres` | yes | Two to four short genre tags, used for filters |
| `released` | yes | First release on any store: `YYYY-MM-DD`, `YYYY-MM` or `YYYY`. Sets the order (newest first); the site shows the year |
| `platforms` | yes | Any of `pc`, `ios`, `android`, `web` |
| `stores` | yes | List of `{ "type": "steam" or "appstore" or "googleplay" or "itch" or "crazygames" or "web", "url": "https://..." }` |
| `badge` | no | Short highlight such as "Free demo on Steam" or "Pay once, no ads" |
| `highlights` | no | Verified facts such as "1M+ downloads on Google Play" |
| `originalDeveloper` | ports only | The studio that made the original game. Setting it marks the game as a port everywhere on the site |
| `credits` | no | Credit line, e.g. "Original game by Silver Lemur Games. Mobile port by Bart Mamzer." |
| `website` | no | The game's own page, e.g. `/powerlust/` |
| `privacy` | no | The game's privacy policy page. Footer links are built from these |
| `accent` | yes | Hex colour picked from the art (the import script suggests one; adjust by eye) |
| `featured` | no | `false` moves an older game to the quieter "Earlier games" area |
| `media` | yes | Paths written by the import script (see below) |

`studio` at the top of `games.json` holds the studio name, tagline, about text, email, stats, links and `spotlight`
(the game ids shown in the opening section, in order).

## Images

| File | Size | Used for |
| --- | --- | --- |
| `cover.webp` | 16:9, 1280 wide | Cards and tiles (often has the logo baked in) |
| `hero.webp` | wide, up to 2400 | Backgrounds, best without a logo |
| `poster.webp` | 2:3, 900 wide | Portrait cards |
| `logo.webp` | transparent | Title over art; designs fall back to text |
| `icon.webp` | square, 512 | App icon for mobile games |
| `loop.mp4`, `loop.webp` | 8 s, 720p, silent | Autoplay backgrounds (Steam games) |
| `shots/NN.webp` | 1600 wide | Screenshot gallery, landscape or portrait |

`media.trailer` is the full Steam trailer stream; the page plays it only when a visitor asks.

## Removing a game

Delete its entry from `games.json` and its `assets/games/<id>/` folder.

## Never touch

Existing privacy policy pages (`*/policy/`, `*PrivacyPolicy.html`), `app-ads.txt` and `CNAME`: the app stores and ad
networks link to them by these exact paths.
