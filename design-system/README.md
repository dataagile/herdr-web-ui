Data Agile's developer environment is two products used in sequence: the **Portal Dev Data Agile** (herdr.dataagile.com.br — login, "Minhas máquinas", admin, help; Data Agile green on dark navy) authenticates each person and hands them off to **herdr web ui**, the app that runs their coding agents (chat, terminal, phone; amber on graphite). This brand book covers herdr web ui; the portal has its own section, **Portal**.

Pick the product before you design: anything before or around sign-in, accounts, machines and onboarding is the portal (`portal-*` tokens, `--font-portal`, markup inside `.da-portal`); anything inside a machine — workspaces, panes, agents — is herdr (every other token). Never mix the two palettes on one screen; the hand-off from the portal's **Abrir** button to herdr is the seam.

herdr web ui is a warm terminal: an amber-phosphor console on lamp-lit graphite (dark) or ledger paper (light), with chat-app clarity. It puts live herdr workspaces, panes and coding agents in a browser. *Your agents. Any screen.*

Build every screen from `tokens.css` + `components/bundle.css` and the class names in each component's guide. Never hard-code a hex value: every colour below is a token, and every theme re-maps the same names.

## Identity rules

- **Amber is the one chrome colour.** `--accent` marks what you are looking at (selected row rail, focus ring, links, the chosen lens glyph, the terminal cursor); `--primary` is the user's own action (Send, primary buttons) with `--primary-text` on it. Nothing else in the chrome is saturated.
- **Agent states own the other saturated colours, and none of them is amber:** `--status-idle` (READY), `--status-working` (RUN), `--status-blocked` (INPUT / needs you), `--status-done` (DONE). Fill with the matching `-tint`, write the word in the solid colour.
- **State is always a word as well as a colour.** Unknown state is `--text-dim` with a dashed `--border` edge — never a fifth colour.
- **The signature is the amber status rail:** a `--rail-w` (3px) `--accent` bar on the selected row, whose mark box takes an amber edge too, tying "what I am looking at" to "where I am typing".
- The user's chat turns are neutral raised cards (`--bg-elevated`, edge `--bubble-border`), so a long thread never becomes a wall of colour.
- Tints are named tokens. Never introduce an ad-hoc translucent colour.

## Themes

Ten themes, one hierarchy. `dark` (Amber) is the default and the look before settings load; `light` is its ledger-paper twin. Four opt-in palettes keep the same token names:

| Theme id | Character |
|---|---|
| `dark`, `light` | Amber. Light uses the darker, text-safe ochre `--accent` and a brighter `--primary` fill carrying ink text. |
| `report-dark`, `report-light` | Near-black blue-grey canvas with hairlines; primary is white (ink on paper), accent is electric blue for small marks only; states never blue. Near-square corners (radius 2/3/3/4/6px, applied by `bundle.css`) and no resting card shadow in dark. |
| `charcoal-dark`, `charcoal-light` | Neutral Ghostty-style charcoal; accent and primary near-white (ink on paper); muted states. |
| `catppuccin-dark`, `catppuccin-light` | Catppuccin Mocha / Latte: content on Base, chrome on Mantle; Latte accents darkened until they pass AA. |
| `lilac-dark`, `lilac-light` | One quiet lavender, flat on every surface. Light: lavender canvas under paler chrome, indigo ink, indigo accent and primary (white text). Dark: the same hue at night, indigo-black canvas, pale lilac accent and primary (dark ink). Keeps amber's corners; shadows tinted indigo in light. In the app this is `data-palette="lilac"` over `data-theme`. |

Density is a second axis: `[data-density="compact"]` on the root steps the type scale and sizes down (see the usage notes on `fs-*`, `control-h`, `row-h`…).

## Colour usage

- Surfaces, darkest to lightest in dark: `--bg` (chat canvas) → `--bg-panel` (sidebar, header, tabs) → `--bg-elevated` (selection, chips, tracks, the user bubble) → `--bg-hover`. Fields sit on `--bg-input`.
- Text: `--text` for body, `--text-dim` for subtitles, labels and hints, `--text-strong` for titles, `strong` in prose and the open tab. All three read on `--bg`, `--bg-panel`, `--bg-elevated` and `--bg-hover` at WCAG AA in every theme.
- Edges: a `--hairline` of `--border`; `--border-strong` for hover/focus separation and meter tracks.
- Danger: `--danger-tint` fill with `--danger-text`, border `--status-blocked`. Plan meters turn `--status-blocked` from 80% used — amber stays chrome.
- Terminal: `--term-bg`, `--term-fg`, `--term-cursor`, `--term-selection` are mirrored verbatim into xterm's JS theme.
- The in-app alert (Droplet) is island black in every theme: `--droplet-*` only.

## Typography

- `--font-ui` (Pretendard Variable, then system sans) for chrome and chat prose; `--font-mono` (JetBrains Mono, served as "JetBrains Mono Web") for code, paths, keys and terminal-adjacent metadata.
- Scale: `--fs-2xs` 11 micro (badges, kbd) · `--fs-xs` 12 meta and field labels · `--fs-sm` 13 controls and row titles · `--fs-md` 14 body · `--fs-chat` 15 reading · `--fs-lg` 16 header and modal titles · `--fs-xl` 18 markdown h1 · `--fs-display` 22 the empty chat's greeting · `--fs-input` 16 for text inputs on phones (iOS never zooms it).
- Chat prose is `--fs-chat` on `--lh-prose` (1.65); code blocks `--fs-sm` on `--lh-code`; titles `--lh-tight`.
- Weights: 400 body, 500 controls, 600 labels and titles, 700 the brand only.
- Uppercase is for operational labels only (field labels, menu headings, state words), always with `--tracking-caps`.

## Spacing, shape, depth

- 4px base: `--space-1` 4 … `--space-8` 32. Controls pad `--space-3`; sections and modals `--space-4`/`--space-5`.
- Radii: `--radius-sm` chips and kbd · `--radius-md` buttons, inputs, selected rows · `--radius-lg` menus and chat surfaces · `--radius-xl` modals and sheets · `--radius-2xl` the composer card · `--radius-pill` pills and dots.
- **Tonal shift + hairline; shadow only for overlays.** Resting shell surfaces have no shadow. `--shadow-pop` for menus, palette and modals; `--shadow-drawer` for the phone drawer; `--shadow-card` only on the composer's input box.
- Sizes: controls `--control-h` (34px), coarse pointers grow to `--touch-target` (40px); rows `--row-h`; sidebar `--sidebar-w` 320px; dialogs and settings `--content-w` 820px; palette `--palette-w` 640px.

## Layout

- The shell is a full-viewport column: header over body; the body is sidebar plus the pane (chat or terminal). The header is one line at every width. Its controls are plain buttons, no overflow menu: copy path (`.context-copy`, end of the crumb; beside the title while the crumb is wrapped out of sight, `.is-crumb-hidden`), Files, Alerts bell (`.header-bell`, with a dot while alerts are off) and Split. Files and the bell stay in the header at every width (hover shows their `title`); up to `768px` (the drawer's breakpoint) the path is the first row of the drawer (`.drawer-rows`), and at `480px` and below the palette is its second (`.drawer-palette`) and the bar is icons only (no title, mark or crumb; the tab strip names the pane).
- From 769px the header splits in two: over the sidebar it is the sidebar's own top row on `--bg-panel`; over the pane it takes the pane's surface (`--bg` under chat, `--term-bg` under terminal).
- At ≤768px the sidebar becomes a drawer with `--scrim`; at ≤640px dialogs and menus become bottom sheets with top `--radius-xl` corners and safe-area padding; at ≤1100px the header buttons drop their labels and keep icons; at ≤480px the pane's title leaves the header too.

## Motion

Only state changes move: hover/press (`120ms`, `cubic-bezier(0.2, 0, 0, 1)`), the drawer (`180ms`), settings switches, and the working/reconnecting dot (1600ms two-step pulse, trough opacity 0.35 — text never pulses). Dialogs and scrims snap open and closed. Honour `prefers-reduced-motion`: pulses and transitions go, state stays legible.

## Content

- Voice: short, plain, sentence case. Name things by what the user sees: "New project", "New tab · api", "Open worktree…", "Close project".
- State words are fixed: **READY**, **RUN**, **INPUT**, **DONE**, and **—** for unknown. The attention group is **Needs you**.
- Shortcuts are written `Mod+Shift+key`; Mod renders `⌘` on Apple platforms and `Ctrl` elsewhere, in `.kbd` keycaps.
- A working directory used as a title shows its last folder (`~/dev/api` → `api`); the full path lives in the tooltip.
- Danger is asked, not hidden: an irreversible action opens a confirm with Cancel focused and the danger action on the right; a refusal turns into its escalation (**Delete anyway**) with the refusal's own words above it.
- No emoji, no exclamation marks. The UI ships in English, Korean, Japanese and Chinese.

## Iconography

- Lucide (`lucide-react`), 24 viewBox, `stroke="currentColor"`, stroke-width 2, drawn at `--icon-size` (18px) in chrome and 16px in dense rows; decorative icons are `aria-hidden`. Icon-only controls (`.icon-button`) always carry an `aria-label`.
- Agent marks sit in a neutral `--avatar-size` box; an unknown agent gets its initial in a disc; the shell gets Lucide's terminal glyph.
- The app icon of both products is **Data Agile Dev** (`assets/DevIcons`): the DA monogram with a green terminal cursor on navy. In the Data Agile fork it replaces upstream's ram (kept in `assets/Logos` and `assets/Icons` for reference only) — in the header at `--mark-size` (22px) beside the wordmark "herdr" + a dim "web ui" in `--fw-bold`, `--tracking-tight`, and as favicon, PWA and notification icons.

## Accessibility

WCAG 2.2 AA in every theme. Global `:focus-visible` is a 2px solid `--accent` ring with 2px offset. Toggles expose `aria-pressed` or `role="switch"`; the selected pane `aria-current`; status and progress `role="status"`, failures `role="alert"`. Fields stay `--fs-input` where mobile zoom is a risk.

## Not synced

- Pretendard is the Latin subset of the app's own dynamic-subset chunks (as the app, accented letters such as ã, á and all Hangul fall back to the system sans); the 1.2 MB Symbols Nerd Font Mono (terminal icon glyphs) is not included.
- Components are static renditions: the repository's real markup and CSS (`components/bundle.css`), not the live React components (the app is not packaged as a component library). Agent logos from `agentSvgMarks.ts` are not reproduced.
- Not built as cards: Settings dialog, Worktree dialog, Directory browser, File viewer, Plan meters, Voice input, Key bar, Token gate.
- Portal: Montserrat is named but not loaded by the portal itself (devices without it show the system sans); the 17.5 MB `film.mp4` demo, the help page's tour script and screen mocks are not included.
