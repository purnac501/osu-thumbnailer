# osu! thumbnailer

Create and edit YouTube thumbnails from osu! score links.

The React frontend is static. A Cloudflare Worker keeps the osu! OAuth secret private,
fetches score data, and proxies images for PNG export.

## Local setup

```sh
npm install
cp .env.example .env
npm run dev
```

Add an osu! OAuth client ID and secret to `.env`. Create the client on the
[osu! account page](https://osu.ppy.sh/home/account/edit).

The app opens at `http://localhost:5173`. The Worker uses port `8788`.

Playwright is only required for render tests and command-line exports:

```sh
npx playwright install chromium
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite and the local Worker |
| `npm run build` | Build the static frontend |
| `npm test` | Run unit and render tests |
| `npm run typecheck` | Check TypeScript |
| `npm run generate -- "URL" --resolution 1920x1080` | Export a PNG with Playwright |
| `npm run deploy:api` | Deploy the Worker |

## Deployment

The included workflows deploy the frontend to GitHub Pages and the API to
Cloudflare Workers.

1. Add these GitHub Actions secrets: `CLOUDFLARE_API_TOKEN`,
   `CLOUDFLARE_ACCOUNT_ID`, `OSU_CLIENT_ID`, `OSU_CLIENT_SECRET`, and
   `ALLOWED_ORIGIN`.
2. Set `ALLOWED_ORIGIN` to the full GitHub Pages origin.
3. Run the `Deploy API` workflow.
4. Add the Worker URL as the GitHub Actions variable `API_BASE_URL`.
5. Enable GitHub Pages with GitHub Actions as the source.

The Worker permits 10 score requests per minute for each client IP. Image
requests do not use the osu! API and have a one-day browser cache.

## Structure

```text
src/client       editor UI
src/thumbnail    thumbnail components and templates
src/shared       API types, formatting, and score normalization
src/render       Playwright render page
src/server       local render and fixture tools
worker           public Cloudflare Worker API
```

## Data limits

The osu! API does not report exact slider breaks for Classic scores. Enter a
count if you know it, or leave it at 0. The app does not calculate PP if FC.

## Assets

See [`docs/ASSETS.md`](docs/ASSETS.md) for asset sources and licenses. Beatmap
art and avatars load from osu! at runtime and are not included in this project.
