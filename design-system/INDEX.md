# Data Agile Dev — design system

Design system for the **Portal Dev Data Agile** (`dataagile/portal_desenvolvimento`) and **herdr web ui** (this repo, the Data Agile fork), exported from the Claude design system artifact *Data Agile Dev*.

- Live version (claude.ai): https://claude.ai/code/artifact/d3c49347-32a3-46dd-8af9-a5834072d7bf
- Sources: `dataagile/herdr-web-ui@1e0e71f`, `dataagile/portal_desenvolvimento@fd54f2a`
- Exported: 2026-10-05

## Files

| Path | What |
|---|---|
| `README.md` | Brand book — herdr web ui rules, and how the two products relate (read first) |
| `portal.md` | Portal section: colours, type, shape, marks, flow into herdr |
| `tokens.json` | All tokens (10 herdr themes + `portal-*`), with usage notes |
| `tokens.css` | The same tokens as CSS custom properties, ready to `<link>` |
| `components/bundle.css` | Component styles: herdr's real CSS + the portal CSS scoped under `.da-portal` |
| `components/<Name>/README.md`, `preview.html` | Guidelines and a static preview per component (open a preview with `tokens.css` and `bundle.css` loaded) |
| `fonts/` | Pretendard Variable (Latin subset), JetBrains Mono |
| `assets/` | DevIcons (the Data Agile Dev app icon of both products), Portal (Data Agile marks), Screens (herdr screenshots), Logos and Icons (upstream herdr ram, reference only) |
| `design-system.json` | Index of the artifact (asset ids); kept so the artifact can be re-synced |

The artifact on claude.ai is the source of truth for design work; re-export it here when it changes.
