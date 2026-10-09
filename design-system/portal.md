# Portal

The Portal Dev Data Agile is the front door: a small login-and-routing site that authenticates each person, resolves which machine and OS user they may open, and proxies them into that machine's herdr web ui. Its look is Data Agile's: dark navy, one green, Montserrat.

## How it relates to herdr web ui

- Flow: `/ajuda` (help, public) → `/login` or `/register?invite=…` → `/portal` "Minhas máquinas" (only when the account has several machines) → **Abrir** → herdr web ui for that machine. Admins also reach `/admin`.
- The portal never shows agents, panes or terminals; it shows machines and accounts. Once herdr opens, the herdr palette and components take over entirely.
- Keep the vocabulary consistent across the seam: a portal *máquina* / *alvo* is a herdr *PC*; herdr's **Needs you** and state words (READY, RUN, INPUT, DONE) stay in English inside herdr.

## Colour

Dark only, in every theme of this system (the portal has no light mode).

- Ground `--portal-bg` with a `--portal-glow` radial glow at the top of the page; cards and panels `--portal-bg-elev`; inputs, target rows and code chips `--portal-bg-elev-2`; hairlines `--portal-border`.
- Text `--portal-text`; labels, meta lines and section headings `--portal-text-muted` (6.3:1 on cards).
- **One green, `--portal-accent`** (`#05db90`): primary buttons, links, the admin badge, the AGILE half of the wordmark. Text on green is always `--portal-accent-ink` (9.1:1) — never white (1.8:1; the help page's tabs and step numbers still do this, fix them when touched).
- Health and status are outline pills: `.badge.ok` green, `.badge.off` `--portal-danger`, neutral grey; always a word ("online", "ativo", "expirado").
- Alerts: `.alert.error` (`--portal-danger-tint`, `--portal-error-text`), `.alert.ok` (`--portal-success-text`).
- Known drift to resolve deliberately: the input focus halo (`--portal-focus`) and a few borders on the help page are a leftover blue (`rgba(79, 140, 255, …)`); badge `.ok` edges use another green (`rgba(63, 185, 80, .4)`).

## Type

`--font-portal`: Montserrat, then the system sans. Body 15px/1.5; card titles 20px bold; panel headings 15px uppercase, tracking .06em, muted; labels and meta 13px; buttons 15px bold; help hero 34px; admin stat numbers 26px bold. Copy is Brazilian Portuguese, sentence case, short and plain ("Acesse com seu usuário e senha para abrir sua máquina.").

## Shape and depth

`--radius-portal` (12px) for cards and panels, `--radius-portal-control` (9px) for buttons, inputs and alerts, `--radius-portal-row` (10px) for target rows; badges are pills. The floating login/machines card carries `--shadow-portal`; panels on admin are flat with a hairline. Buttons press down 1px on `:active`; hover transitions are 150ms.

## Brand marks

Use `assets/Portal/data-agile-wordmark.png` at 26px tall in the card or top bar, on dark grounds only. App icons (favicon, PWA, apple-touch) are the **Data Agile Dev** set in `assets/DevIcons` — the "<DA/>" mark (DA between green code brackets), shared with DevDA, the app. Never set the wordmark on light, never recolour the green. The upstream herdr ram is not used in Data Agile products.

## Components

`PortalLogin`, `PortalMachines`, `PortalAdmin`, `PortalHelp` (group *Portal*). Wrap any portal markup in `.da-portal` so `bundle.css` applies the portal's styles and keeps herdr's classes (`.btn`, `.badge`, `.brand`) out of it.
