Data Agile's developer environment is two products used in sequence: the **Portal Dev Data Agile** (herdr.dataagile.com.br — login, "Minhas máquinas", admin, help; Data Agile green on dark navy) authenticates each person and hands them off to **herdr web ui**, the app that runs their coding agents (chat, terminal, phone; amber on graphite). This brand book covers herdr web ui; the portal has its own section, **Portal**.

Pick the product before you design: anything before or around sign-in, accounts, machines and onboarding is the portal (`portal-*` tokens, `--font-portal`, markup inside `.da-portal`); anything inside a machine — projects, panes, agents — is herdr (every other token). Never mix the two palettes on one screen; the hand-off from the portal's **Abrir** button to herdr is the seam.

herdr web ui is a warm terminal: an amber-phosphor console on lamp-lit graphite (dark) or ledger paper (light), with chat-app clarity. It puts live herdr projects, panes and coding agents in a browser. *Your agents. Any screen.*

Build every screen from `tokens.css` + `components/bundle.css` and the class names in each component's guide. Never hard-code a hex value: every colour below is a token, and every theme re-maps the same names.

## Identity rules

- **Amber is the one chrome colour.** `--accent` marks what you are looking at (selected row rail, focus ring, links, the chosen lens glyph, the terminal cursor); `--primary` is the user's own action (Send, primary buttons) with `--primary-text` on it. Nothing else in the chrome is saturated.
- **Agent states own the other saturated colours, and none of them is amber:** `--status-idle` (READY), `--status-working` (RUN), `--status-blocked` (INPUT / needs you), `--status-done` (DONE). Fill with the matching `-tint`, write the word in the solid colour.
- **State is always a word as well as a colour.** Unknown state is `--text-dim` with a dashed `--border` edge — never a fifth colour.
- **The signature is the amber status rail:** a `--rail-w` (3px) `--accent` bar on the selected row, whose mark box takes an amber edge too, tying "what I am looking at" to "where I am typing".
- The user's chat turns are neutral raised cards (`--bg-elevated`, edge `--bubble-border`), so a long thread never becomes a wall of colour.
- Tints are named tokens. Never introduce an ad-hoc translucent colour.

## Themes

Twenty-four theme ids, one hierarchy. In the app a theme is a mode (`data-theme`, dark or light) plus a palette (`data-palette`); the design system flattens each pair to one `data-theme` id in `tokens.css`. The app's default is **codex** in either mode; `dark` / `light` (Amber) is the base block and the look before settings load. Every palette keeps the same token names. Any theme can be picked on either side of the light/dark setting; picking one half of a pair (Catppuccin Mocha / Latte, Tokyo Night / Day, Gruvbox / Gruvbox Light, One Dark / One Light, Solarized / Solarized Light, Kanagawa / Kanagawa Lotus, Rose Pine / Rose Pine Dawn) pre-fills the other side with its sibling.

| Theme ids | Character |
|---|---|
| `dark`, `light` | Amber. Light uses the darker, text-safe ochre `--accent` and a brighter `--primary` fill carrying ink text. |
| `codex-dark`, `codex-light` | The Codex desktop app's default: white / `#181818` surface, ink primary, blue `#3a83f7` accent. The app's default theme. |
| `charcoal-dark`, `charcoal-light` | Neutral Ghostty-style charcoal; accent and primary near-white (ink on paper); muted states. |
| `catppuccin-dark`, `catppuccin-light`, `catppuccin-latte` | Catppuccin Mocha / Latte: content on Base, chrome on Mantle; Latte accents darkened until they pass AA. `catppuccin-latte` is the light block's second selector (same values as `catppuccin-light`). |
| `tokyo-night`, `tokyo-night-day` | Tokyo Night (dark) and Tokyo Night Day (light). |
| `gruvbox`, `gruvbox-light` | Gruvbox dark and light. |
| `one-dark`, `one-light` | One Dark and One Light. |
| `solarized`, `solarized-light` | Solarized dark and light. |
| `kanagawa`, `kanagawa-lotus` | Kanagawa (dark) and Kanagawa Lotus (light). |
| `rose-pine`, `rose-pine-dawn` | Rose Pine (dark) and Rose Pine Dawn (light). |
| `dracula`, `nord`, `vesper` | Dark only. A dark theme picked for light mode still draws dark. |

The Report and Lilac palettes of the earlier fork no longer exist; a saved `report`, `lilac` or `forest` choice loads as amber. Theme values are authored only in the theme blocks of `src/styles.css` (`bun run generate:themes` writes the copies); `tokens.json` / `tokens.css` here list each one. The light terminal ANSI colours (`--term-black` … `--term-bright-white`) live in the app's light blocks only and are not exported.

Density is a second axis: `[data-density="compact"]` on the root steps the type scale and sizes down (see the usage notes on `fs-*`, `control-h`, `row-h`…). The Interface font size setting scales every `--fs-*` through `--ui-scale`.

## Colour usage

- Surfaces, darkest to lightest in dark: `--bg` (chat canvas) → `--bg-panel` (sidebar, header, tabs) → `--bg-elevated` (selection, chips, tracks, the user bubble) → `--bg-hover`. Fields sit on `--bg-input`.
- Text: `--text` for body, `--text-dim` for subtitles, labels and hints, `--text-strong` for titles, `strong` in prose and the open tab. All three read on `--bg`, `--bg-panel`, `--bg-elevated` and `--bg-hover` at WCAG AA in every theme.
- Edges: a `--hairline` of `--border`; `--border-strong` for hover/focus separation and meter tracks.
- Notices: `--notice` (warning yellow) marks a partial view, such as a file cut short. Code uses `--syntax-*` and `--line-number`; herdr's TUI state colours are `--indicator-*`. The phone header and the input card are glass: `--bar-bg` / `--card-glass` behind `--glass-blur`.
- Danger: `--danger-tint` fill with `--danger-text`, border `--status-blocked`. Plan meters turn `--status-blocked` from 80% used — amber stays chrome.
- Terminal: `--term-bg`, `--term-fg`, `--term-cursor`, `--term-selection` are mirrored verbatim into xterm's JS theme.
- The in-app alert (Droplet) is island black in every theme: `--droplet-*` only.

## Typography

- `--font-ui` (Pretendard Variable, then system sans) for chrome and chat prose; `--font-mono` (JetBrains Mono, served as "JetBrains Mono Web") for code, paths, keys and terminal-adjacent metadata.
- Scale (each is `calc(Npx * var(--ui-scale))`, `--ui-scale` 1 by default): `--fs-2xs` 11 micro (badges, kbd) · `--fs-xs` 12 meta and field labels · `--fs-sm` 13 controls and row titles · `--fs-md` 14 body · `--fs-chat` 15 reading · `--fs-lg` 16 header and modal titles · `--fs-xl` 18 markdown h1 · `--fs-display` 22 the empty chat's greeting · `--fs-pairing` 32 the phone pairing code (compact 26) · `--fs-input` 16 for text inputs on phones (iOS never zooms it).
- Chat prose is `--fs-chat` on `--lh-prose` (1.65); code blocks `--fs-sm` on `--lh-code`; titles `--lh-tight`.
- Weights: 400 body, 500 controls, 600 labels and titles, 700 the brand only.
- Uppercase is for operational labels only (field labels, menu headings, state words), always with `--tracking-caps`.

## Spacing, shape, depth

- 4px base: `--space-1` 4 … `--space-8` 32. Controls pad `--space-3`; sections and modals `--space-4`/`--space-5`.
- Radii: `--radius-sm` chips and kbd · `--radius-md` buttons, inputs, selected rows · `--radius-lg` menus and chat surfaces · `--radius-xl` modals and sheets · `--radius-2xl` the composer card · `--radius-pill` pills and dots.
- **Tonal shift + hairline; shadow only for overlays.** Resting shell surfaces have no shadow. `--shadow-pop` for menus, palette and modals; `--shadow-drawer` for the phone drawer; `--shadow-card` only on the composer's input box.
- Sizes: controls `--control-h` (34px), coarse pointers grow to `--touch-target` (44px; the phone header's controls `--touch-target-header`, a mouse's smallest hit area `--pointer-target` 24px); rows `--row-h`; sidebar `--sidebar-w` 320px; dialogs and settings `--content-w` 820px; palette `--palette-w` 640px.

## Layout

- The shell is a full-viewport column: header over body; the body is sidebar plus the pane area (chat or terminal, one or more panes). The header is one line at every width. Its controls are plain buttons, no overflow menu: copy path (`.context-copy`, end of the crumb; beside the title while the crumb is wrapped out of sight, `.is-crumb-hidden`), New tab, Files, the feedback megaphone, Alerts bell (`.header-bell`, with a dot while alerts are off), then the Chat/Terminal switch and last the modified-files button (`.header-amod`, with a count; hidden at 0, see `components/ChangedFiles`). Splitting, zooming and the pane's other actions are the pane's own (`PaneCanvas`: its header's menu, or a right-click), not header buttons; the tab strip's `⋯` menu carries the tab's. Files and the bell stay in the header at every width (hover shows their `title`); at `480px` and below the Chat/Terminal switch is a single toggle button (`.view-toggle`) and New tab leaves the bar (the tab strip ends in its own `+`); up to `768px` (the drawer's breakpoint) the drawer's first row is the path (`.drawer-rows`), at `480px` and below the palette is its second (`.drawer-palette`), and Find in terminal (`.drawer-find`) and Copy link (`.drawer-copy-link`) close the rows; at `480px` and below the bar is icons only (no title, mark or crumb; the tab strip names the pane).
- From 769px the header splits in two: over the sidebar it is the sidebar's own top row on `--bg-panel`; over the pane it takes the pane's surface (`--bg` under chat, `--term-bg` under terminal).
- At ≤768px the sidebar becomes a drawer with `--scrim`; at ≤640px dialogs and menus become bottom sheets with top `--radius-xl` corners and safe-area padding; at ≤1100px the header buttons drop their labels and keep icons; at ≤480px the pane's title leaves the header too.

## Motion

Only state changes move: hover/press (`--dur-fast` 120ms, `--ease-out`), the drawer (`--dur-base` 180ms), a phone sheet (`--dur-sheet` 360ms in on `--ease-spring`, `--dur-sheet-out` 240ms out), settings switches, and the working/reconnecting dot (`--dur-pulse` 1600ms, `--ease-pulse` two-step, trough opacity 0.35 — text never pulses). Dialogs and scrims snap open and closed. Honour `prefers-reduced-motion`: pulses and transitions go, state stays legible.

## Content

- Voice: short, plain, sentence case. Name things by what the user sees: "New project", "New tab · api", "Open worktree…", "Close project".
- State words are fixed: **READY**, **RUN**, **INPUT**, **DONE**, and **—** for unknown. The attention group is **Needs you**: one per PC, inside its group, listing INPUT then DONE panes.
- Shortcuts are written `Mod+Shift+key`; Mod renders `⌘` on Apple platforms and `Ctrl` elsewhere, in `.kbd` keycaps.
- A working directory used as a title shows its last folder (`~/dev/api` → `api`); the full path lives in the tooltip.
- Danger is asked, not hidden: an irreversible action opens a confirm with Cancel focused and the danger action on the right; a refusal turns into its escalation (**Delete anyway**) with the refusal's own words above it.
- No emoji, no exclamation marks. The UI ships in English, Korean, Japanese and Chinese.

## Iconography

- Lucide (`lucide-react`), 24 viewBox, `stroke="currentColor"`, stroke-width 2, drawn at `--icon-size` (18px) in chrome and 16px in dense rows; decorative icons are `aria-hidden`. Icon-only controls (`.icon-button`) always carry an `aria-label`.
- Agent marks sit in a neutral `--avatar-size` box; an unknown agent gets its initial in a disc; the shell gets Lucide's terminal glyph.
- The app icon of both products is **Data Agile Dev** (`assets/DevIcons`): the "<DA/>" mark (DA monogram between green code brackets, approved 08/10/2026) on navy. In the Data Agile fork, whose user-facing name is **DevDA** (never "herdr" in the UI), it replaces upstream's ram (kept in `assets/Logos` and `assets/Icons` for reference only) — in the header at `--mark-size` (22px) beside the wordmark "DevDA" in `--fw-bold`, `--tracking-tight`, and as favicon, PWA and notification icons.

## Accessibility

WCAG 2.2 AA in every theme. Global `:focus-visible` is a 2px solid `--accent` ring with 2px offset. Toggles expose `aria-pressed` or `role="switch"`; the selected pane `aria-current`; status and progress `role="status"`, failures `role="alert"`. Fields stay `--fs-input` where mobile zoom is a risk.

## Not synced

- Pretendard is the Latin subset of the app's own dynamic-subset chunks (as the app, accented letters such as ã, á and all Hangul fall back to the system sans); the 1.2 MB Symbols Nerd Font Mono (terminal icon glyphs) is not included.
- Components are static renditions: the repository's real markup and CSS (`components/bundle.css`), not the live React components (the app is not packaged as a component library). Agent logos from `agentSvgMarks.ts` are not reproduced.
- Not built as cards: Settings dialog, Worktree dialog, Directory browser, the pane canvas, Plan meters, Voice input, Key bar, Token gate.
- Portal: Montserrat is named but not loaded by the portal itself (devices without it show the system sans); the 17.5 MB `film.mp4` demo, the help page's tour script and screen mocks are not included.
