# osu! thumbnailer

Web app that turns an osu! score URL into a YouTube-ready thumbnail.
Paste a URL, pick a template and resolution, preview live, download a PNG.

```
paste osu! score URL -> fetch score/map/player data -> normalize
-> apply to template -> live preview -> choose resolution -> download PNG
```

The frontend is static and works on GitHub Pages. A small Cloudflare Worker
keeps the osu! OAuth secret private and proxies images for browser-side export.

## Install

```
npm install
cp .env.example .env
npx playwright install chromium # only needed for render tests and the generate command
```

## Environment / osu! API credentials

1. Create an OAuth client at https://osu.ppy.sh/home/account/edit (new OAuth client).
2. Put the values in `.env`:

```
OSU_CLIENT_ID=<your client id>
OSU_CLIENT_SECRET=<your client secret>
```

- OAuth: `POST https://osu.ppy.sh/oauth/token` with `grant_type=client_credentials`,
  `scope=public`. The token is cached server-side until shortly before expiry.
- The secret stays in the local or deployed Cloudflare Worker.
- Requests carry `X-API-Version: 20220705`.
- Score fetches are limited to 30 requests per minute for each client IP.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite (UI, port 5173) + Cloudflare Worker (port 8788) |
| `npm run dev:api` | Cloudflare Worker only (port 8788) |
| `npm test` | Unit tests + render smoke tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run template:compare` | Render fixture at 1024x576, diff vs `reference/Reference.png`, write `generated/*.png`, print similarity |
| `npm run render:matrix` | Render reference + long-text stress fixtures at 1280x720 into `generated/` for eyeballing |
| `npm run generate -- "URL" --template reference --resolution 2560x1440` | Headless PNG via Playwright, no browser UI |
| `npm run build` | Production build |
| `npm run deploy:api` | Deploy the Cloudflare Worker |

## Deploy

1. Add `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `OSU_CLIENT_ID`,
   `OSU_CLIENT_SECRET`, and `ALLOWED_ORIGIN` as GitHub Actions secrets.
2. Set `ALLOWED_ORIGIN` to the full GitHub Pages origin.
3. Run the `Deploy API` workflow and copy its Worker URL.
4. Add that URL as the GitHub Actions variable `API_BASE_URL`.
5. Enable GitHub Pages with GitHub Actions as its source. The frontend deploys on each push to `main`.

Example:

```
npm run generate -- "https://osu.ppy.sh/scores/osu/123456789" --resolution 3840x2160 --out thumb.png
```

## Architecture

```
src/
  client/            app UI (URL input, template + resolution selects, preview, download)
  thumbnail/         the renderer - pure function of (data, template, scale)
    components/      Background, Panels, Text, Mods, Player, Branding layers
    templates/
      reference/     template.ts (assembly) + layout.ts (positions) + theme.ts (colors/fonts)
    registry.ts      template registry
  render/            /render.html route used by Playwright (also usable manually)
  server/            local Playwright render and fixture tooling
  shared/
    types/           ThumbnailData (normalized model), raw osu! API types
    score-url/       URL parser
    formatting/      PP / accuracy / combo / BPM / star / position formatting
    mods/            mod normalization, clock rate, asset mapping
    normalize/       raw API score -> ThumbnailData, FC detection, bg fallbacks
worker/              Cloudflare Worker API and image proxy
```

Data flow boundaries:

- Raw osu! API JSON is typed in `shared/types/osu.ts` and never reaches templates.
- `normalizeScore()` produces the `ThumbnailData` model in `shared/types/thumbnail.ts`.
- Templates consume only `ThumbnailData` + their own config.
- The browser exports the exact `Thumbnail` component shown in the preview.
- Playwright remains available for local render tests and command-line exports.

## Template configuration

A template is data, not JSX. Everything visible is one config object in
`src/thumbnail/templates/<name>/`:

- `template.ts` - canvas size, background layers/overlays, data options
  (map-name format, FC/miss text, bottom message)
- `layout.ts` - every component's position/size in 1280x720 logical coordinates
- `theme.ts` - colors and fonts

Programmatic edits are trivial:

```ts
referenceTemplate.components.twitchLogo.visible = false;
referenceTemplate.components.pp.color = "#ff0000";
referenceTemplate.components.pp.x = 900;
referenceTemplate.components.avatar.width = 200;
referenceTemplate.background.overlays[0].opacity = 0.4;
referenceTemplate.theme.accent = "#00ff88";
```

Export resolutions (1280x720, 1920x1080, 2560x1440, 3840x2160) scale the same
logical layout natively - text and effects render at the target resolution,
never upscaled. The reference template canvas is 1280x720; `scale = width/1280`.

## Components

| Layer | Children | Notes |
| --- | --- | --- |
| `BackgroundLayer` | BackgroundImage, dark overlay, gradient overlay | Independent blur/brightness/saturation/scale; image fallback chain on assets.ppy.sh |
| `TopPanel` | Panel, StarNotch, Status (FC / "N MISS"), StarRating, PP, BadgeRow (ComboBadge, DifficultyBadge, BpmBadge) | Badges flow in a flex row with space-between, so long text pushes badges apart instead of overlapping |
| `MapTitle` | - | Configurable `title` or `artist-title` format |
| `ScoreSection` | Grade, Accuracy, Leaderboard position | Grade rank ("S") and leaderboard position ("#2") are distinct values |
| `PlayerSection` | Avatar, CountryFlag (overlapping), UsernamePanel, ModList | Flag is a separate layer |
| `ModList` | ModIcon[] | Official osu! web SVG glyphs on colored tiles (slightly overlapping, like the reference); unknown acronyms fall back to a text badge |
| `TwitchLogo` | - | Static branding, toggleable in the UI, fully configurable (visible/asset/size/opacity/rotation) |
| `BottomMessage` | prefix + highlighted text | Prefix uses the text color, highlight uses the accent color with glow |

## Dynamic text fitting

Long data must never break the layout:

- Text layers support `maxWidth` and shrink their font via canvas measurement
  (`src/thumbnail/components/Text/fit.ts`). Status ("3 MISS"), map title, and PP use it.
- Badges support `autoWidth` (grow with text + padding) and shrink-to-fit inside
  fixed widths (username panel). The top-panel badge row uses flex
  `space-between`, so the difficulty badge can grow but never overlaps its
  neighbors.
- Verify with `npm run render:matrix`, which renders a long-text stress fixture
  (`generated/matrix-long.png`).

## Runtime design overrides

The UI has an accent color picker and a Twitch-logo toggle. Both apply to the
preview AND the downloaded PNG: the same `applyOverrides()` helper
(`src/thumbnail/overrides.ts`) runs in the client and in the render page that
Playwright screenshots. The accent recolors the bottom-message highlight plus
the panel/badge borders together.

## Data details

- **Leaderboard position**: prefers `score.rank_global`, falls back to looking up
  the score in `GET /beatmaps/{id}/scores`. Never uses PP/country rank.
- **Star rating**: `POST /beatmaps/{id}/attributes` with the score's mods
  (`getModdedBeatmapAttributes()`); displays 10.528 as `10.53`.
- **BPM**: `getClockRate(mods)` - lazer `speed_change` settings first, then
  traditional DT/NC 1.5x, HT/DC 0.75x. `effectiveBpm = baseBpm * clockRate`.
- **FC status**: derived from statistics + `is_perfect_combo` (`detectStatus`),
  isolated from template text (`fcText` / `missText` templates).
- **Score URLs**: `/scores/{id}` and `/scores/{ruleset}/{id}`, tolerant of
  whitespace/query/trailing slash; everything else rejected.

## Adding a template

1. Create `src/thumbnail/templates/my-template/` with `template.ts` (see the
   reference template; `layout.ts`/`theme.ts` are recommended but optional).
2. Register it in `src/thumbnail/templates/registry.ts`.
3. It appears in the UI dropdown and works with `npm run generate`.

No osu! API, normalization, or renderer changes are needed - that is the point
of the boundary.

## Changing visuals

- **Colors**: `templates/reference/theme.ts` (`theme.colors.*`)
- **Positions/sizes**: `templates/reference/layout.ts`
- **Fonts**: `theme.ts` (`FONTS`); fonts are bundled via @fontsource (OFL)
- **Icons/mod colors**: `components/Mods/ModList.tsx` (category colors) and
  `modColors` overrides in `layout.ts`
- **Background effects**: `template.ts` -> `background` (blur, brightness,
  saturation, overlays - each toggleable)
- **Visibility**: every component has `visible: boolean`

## Assets and licenses

See `docs/ASSETS.md`. Summary: mod glyphs from ppy/osu-web (osu! artwork,
CC-BY-NC 4.0 - non-commercial use), Twitch glyph via simple-icons (CC0), flags
via flag-icons (MIT), fonts via fontsource (OFL). Beatmap artwork/avatars load
from assets.ppy.sh at render time and are not redistributed.

## Known deviations from reference/Reference.png

- The Canva font could not be identified from the low-res export; Baloo 2
  replaces it (one-line swap in `theme.ts`).
- The default accent is grey (user preference), not the reference's red - the
  accent picker restores red or any other color.
- Background image, avatar, and exact glow strengths differ (the reference uses
  a photo this project does not bundle); layout and colors match.
- The blue star notch is an SVG approximation of the Canva shape.
- `npm run template:compare` reports ~82% pixel similarity at 1024x576, driven
  mostly by the different background photo and font rasterization.
