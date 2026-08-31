# External assets

Record of every third-party asset bundled in this repository.

| Asset | Source | License | Usage |
| --- | --- | --- | --- |
| osu! mod icon glyphs (22 SVGs in `public/assets/osu/mods/`) | [ppy/osu-web](https://github.com/ppy/osu-web/tree/master/public/images/badges/mods) `mod-*.svg` | osu! game artwork; see [ppy/osu-resources LICENCE](https://github.com/ppy/osu-resources/blob/master/LICENCE.md) (CC-BY-NC 4.0). Glyphs are used unmodified. | Rendered as white glyphs on colored tiles inside `ModIcon`. Non-commercial use only. |
| Mod tile colors | [ppy/osu-web `resources/css/bem/mod.less`](https://github.com/ppy/osu-web/blob/master/resources/css/bem/mod.less) + live osu.ppy.sh CSS variables | n/a (color values) | `MOD_CATEGORY_COLORS` in `ModList.tsx` mirrors the official per-category colors: red hsl(360,100%,70%), lime hsl(90,100%,70%), blue hsl(200,100%,70%), purple hsl(255,100%,70%), pink hsl(333,100%,70%). |
| Twitch glitch glyph (`public/assets/twitch/twitch-glitch.svg`) | [simple-icons](https://github.com/simple-icons/simple-icons) `twitch.svg` | CC0-1.0 (icon path). Twitch branding is still governed by [Twitch brand guidelines](https://brand.twitch.com/). | White glyph inside the purple `TwitchLogo` tile. |
| Country flags | [flag-icons](https://www.npmjs.com/package/flag-icons) npm package | MIT | `CountryFlag` component via bundled CSS/SVGs. |
| Fonts: Baloo 2, Montserrat | [fontsource](https://fontsource.org/) (`@fontsource/baloo-2`, `@fontsource/montserrat`) | OFL (SIL Open Font License) | Display/body text. See the note below on the Canva original. |
| Beatmap artwork / avatars | `assets.ppy.sh` loaded at render time, restricted to that host | osu! game assets (CC-BY-NC via osu-resources) | `BackgroundLayer` and `Avatar`. Not bundled; fetched live with a fallback chain (`raw.jpg` → `cover@2x.jpg` → `cover.jpg`). |
| Fixture background/avatar (`public/assets/template/fixture-*.jpg`) | Generated locally with sharp | n/a (original) | Deterministic offline rendering for tests and `npm run template:compare`. |

## Font note

The Canva reference (`reference/Reference.png`) uses a rounded display font that
cannot be identified exactly from the 1024x576 export. **Baloo 2** is the chosen
replacement: it matches the rounded, heavy letterforms of "FC", "1207PP" and the
badge text closely. Typography is centralized in
`src/thumbnail/templates/reference/theme.ts` (`FONTS`), so swapping the font is a
one-line change.

## License restrictions to keep in mind

- osu! mod glyphs and beatmap artwork are CC-BY-NC 4.0: fine for personal /
  non-commercial thumbnail generation. Do not sell thumbnails produced with them
  without permission from ppy.
- "osu!" and "Twitch" are trademarks; the logos are used for identification.
- If the project ever goes commercial, mod glyphs must be replaced with
  original or licensed artwork. The `ModIcon` component isolates them, so only
  assets + config change.
