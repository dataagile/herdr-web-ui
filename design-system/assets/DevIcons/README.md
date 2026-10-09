**DevDA** — the app icon of both developer products (the Portal Dev Data Agile and the Data Agile fork of herdr web ui, whose user-facing name is DevDA). It is option A "<DA/>" (approved 08/10/2026): the Data Agile "DA" monogram (Montserrat ExtraBold, D white `#ffffff`, A `--portal-accent` green `#05db90`) between green code brackets `<` and `/>`, on the `--portal-bg-elev` navy square (`#1a212b`, corner radius 14/64). Letters are outlined paths, so the SVG renders identically everywhere without the font. Source and alternatives: `docs/marca/`.

| File | Use |
|---|---|
| `data-agile-dev.svg` | Master; favicon (`<link rel="icon" type="image/svg+xml">`) |
| `data-agile-dev-favicon-32.png` | PNG favicon fallback |
| `data-agile-dev-apple-touch-icon-180.png` | iOS home screen (full-bleed square; iOS rounds it) |
| `data-agile-dev-icon-192.png`, `-icon-512.png` | PWA manifest icons, `purpose: any`; the app header mark at 22px |
| `data-agile-dev-icon-maskable-512.png` | PWA `purpose: maskable` (mark inside the 80% safe zone, full-bleed navy) |
| `data-agile-dev-badge-96.png` | Push-notification badge: white single-ink mark on transparent |
| `data-agile-dev-favicon.ico` | Legacy `/favicon.ico` (32px PNG inside) |

Rules: never recolour the A or the brackets; never drop the brackets (the `</>` is what makes it the *dev* mark — it replaces the old terminal cursor `_`); keep the navy square — on light grounds too. Below 24px the mark stays legible; don't add text to it. The company wordmark (`assets/Portal/data-agile-wordmark.png`) stays the brand lockup in page headers. To regenerate the PNGs, render the SVG with a headless browser (the maskable variant scales the mark to 80% on a full-bleed square; the badge recolours the green to white on transparent).

Replaces: the "DA_" monogram-with-cursor set, and before it the portal's plain "DA" favicon and the upstream ram mark (`assets/Logos`, `assets/Icons` keep the upstream originals for reference).
