# Project artwork — Data Agile Dev

This is Data Agile's fork of herdr web ui, whose user-facing name is **DevDA**. Its app icon is
"<DA/>" (approved 08/10/2026): the Data Agile "DA" monogram (Montserrat ExtraBold outlines, D white
`#ffffff`, A green `#05db90`) between green code brackets, on a navy rounded square (`#1a212b`,
radius 14/64). The same icon is
used by the Portal Dev Data Agile, which signs people in and opens this app.

- `icon-source.svg` — the master (letters are paths; renders without the font).
- Exports in `public/`: `favicon.ico` (32), `favicon.png` (32), `apple-touch-icon.png` (180,
  square), `icons/icon-192.png`, `icons/icon-512.png` (any), `icons/icon-maskable-{192,512}.png`
  (mark inside the 80% safe zone), `icons/badge-96.png` (white single-ink notification badge),
  `social-preview.png` (1280 × 640 Open Graph image; DevDA card: the <DA/> icon, "DevDA", a pt-BR tagline and the Data Agile wordmark on the portal navy; source HTML kept outside the repo, rendered at 1280 × 640).
  `icon-maskable-192.png` is the 512 maskable downscaled (the design system ships only 512).
- The full design system (tokens, components, rules for both products) lives in
  [`design-system/`](../../design-system/INDEX.md).

The upstream ram artwork (`icon-source.png`) is kept for reference only and is not used.
`scripts/generate-brand.ts` exports that upstream artwork and would bring the ram back, so it
refuses to run in this fork. Changing an icon: edit the design system, re-export the PNGs from
`icon-source.svg`, and bump the `?v=` query (`da2`) in `index.html`, `manifest.webmanifest`,
`sw.js`, `src/App.tsx` and `src/pwa.test.ts` so installed apps refresh.
