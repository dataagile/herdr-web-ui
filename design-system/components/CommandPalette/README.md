A top-offset search dialog that finds panes and actions, with recent panes first and one keyboard-active row.

## When to use
- `Mod+Shift+K` (or the header's More menu) to jump to any pane across workspaces or run a global action.
- Not a general search over files or chat history.

## Anatomy
- `.modal-scrim.palette-scrim` — the shared scrim, aligned to the top with `--palette-top` offset.
- `section.menu.command-palette[role="dialog"]` — a `.menu` surface `--palette-w` wide, no padding.
- `.palette-search` — `input.input[type="search"]` + close `.icon-button`, hairline below.
- `.palette-results[role="listbox"]` — scrolls; `.menu-heading` "Panes" and "Actions".
- Pane row: `button.menu-item.palette-pane[role="option"]` (`--row-h` tall) with `.palette-mark` (`--avatar-size` box on `--bg-elevated` holding the agent mark), `.menu-item-main` > `.palette-row-title` (+ `.palette-selected` tag) and `.palette-row-subtitle` (workspace · folder), then a status `.badge`.
- Action row: `button.menu-item[role="option"]` with a lucide icon, label and `.palette-shortcut` of `.kbd` keys.
- `.palette-empty[role="status"]` when nothing matches.

## States & variants
- Active row: `aria-selected="true"` (`--bg-hover`), mirrored in the input's `aria-activedescendant`.
- The pane open now carries the `Selected` tag in `--accent`.
- Badges follow agent state: READY / RUN / INPUT / DONE / `—`.
- `<=640px`: bottom sheet with a sticky search; `<=480px` hides key hints.

## What the consumer provides
- The pane snapshot (title, workspace label, cwd, agent, status) and the recent-pane order.
- Actions `{ id, label, icon, shortcut?, run }`; shortcuts render via `formatKeys` (`Mod` = `⌘` on Apple, `Ctrl` elsewhere).
- Arrows cycle, Enter activates, Escape and scrim click close.

## Tokens used
`--palette-w`, `--palette-top`, `--bg-panel`, `--bg-elevated`, `--bg-hover`, `--border`, `--shadow-pop`, `--radius-lg`, `--radius-md`, `--row-h`, `--avatar-size`, `--accent`, `--text-strong`, `--text-dim`, `--fs-xs`, `--fs-2xs`, `--tracking-caps`, `--status-working`, `--status-blocked`.

## Do & Don't
- Do lead an empty query with recent panes; filter both groups as the user types.
- Do show a shortcut only where a global one exists.
- Don't use the palette for confirmations or forms; it closes as soon as a row runs.

Source: src/components/CommandPalette.tsx · src/components/CommandPalette.css
Preview: static rendition (markup + the repo's CSS), not the live React component.
