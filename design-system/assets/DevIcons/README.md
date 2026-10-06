**Data Agile Dev** — the app icon of both developer products (the Portal Dev Data Agile and the Data Agile fork of herdr web ui). It is the Data Agile "DA" monogram (Montserrat ExtraBold, D white `#ffffff`, A `--portal-accent` green `#05db90`) followed by a green terminal cursor `_`, on the `--portal-bg-elev` navy square (`#1a212b`, corner radius 14/64). Letters are outlined paths, so the SVG renders identically everywhere without the font.

| File | Use |
|---|---|
| `data-agile-dev.svg` | Master; favicon (`<link rel="icon" type="image/svg+xml">`) |
| `data-agile-dev-favicon-32.png` | PNG favicon fallback |
| `data-agile-dev-apple-touch-icon-180.png` | iOS home screen (square; iOS rounds it) |
| `data-agile-dev-icon-192.png`, `-icon-512.png` | PWA manifest icons, `purpose: any`; the herdr header mark at 22px |
| `data-agile-dev-icon-maskable-512.png` | PWA `purpose: maskable` (mark inside the 80% safe zone, full-bleed navy) |
| `data-agile-dev-badge-96.png` | Push-notification badge: white single-ink mark on transparent |

Rules: never recolour the A or the cursor; never drop the cursor (it is what makes it the *dev* mark); keep the navy square — on light grounds too. Below 24px the monogram stays legible; don't add text to it. The company wordmark (`assets/Portal/data-agile-wordmark.png`) stays the brand lockup in page headers.

Replaces: the portal's plain "DA" favicon set and, in the Data Agile fork of herdr web ui, the ram mark (`assets/Logos`, `assets/Icons` keep the upstream originals for reference).
