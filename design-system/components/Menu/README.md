A bordered popover list of actions: icon, ellipsized label and optional hint per row, with headings, hairlines and a danger item.

## When to use
- The sidebar row's `⋯` menu (`.row-menu`), the header's More menu, the tab strip's pane picker, split menus.
- The same `.menu` surface backs completion lists (composer slash and @ menus) and the command palette's rows.
- Not for choosing between 2-3 view modes (use the segmented control).

## Anatomy
- `.menu` — flex column, `--space-1` padding, `--bg-panel`, hairline `--border`, `--radius-lg`, `--shadow-pop`.
- `.row-menu` — the RowMenu popover: `position: fixed` via a portal, 208-280px wide, above the drawer (`--z-drawer` + 1).
- `.menu-item` — `--control-h` row, `--radius-md`, `--fs-sm`; contains a 16px lucide icon (`--text-dim`), `.menu-item-main` (ellipsized) and optional `.menu-item-hint` (`--fs-xs`, dim).
- `.menu-heading` — dim uppercase `--fs-2xs` micro label above a group.
- `.row-menu-divider` (`role="separator"`) — the hairline above Close.
- `.row-menu-header` — an optional ruled-off header (a split menu's direction toggle).

## States & variants
- Hover (pointer devices) and `aria-selected="true"` (keyboard/active row): `--bg-hover` fill, `--text-strong`.
- `.is-danger`: label and icon in `--status-blocked` (Close, Close workspace, Delete worktree checkout…).
- `aria-current="true"`: the open pane in a picker, strong colour and semibold.
- `role="menuitemcheckbox"` + `aria-checked`: a switch item; its state in words goes in the hint ("On in the app").
- At `<=640px` RowMenu becomes a `.modal.row-sheet` bottom sheet: grip, title + place, 48px rows, Cancel.

## What the consumer provides
- `title` (the menu's accessible name, the row's name) and items `{ id, label, icon, hint?, divider?, danger?, current?, checked?, run }`.
- An anchor button with `aria-haspopup="menu"` and `aria-expanded`; focus returns to it on close.
- Workspace row order: Rename workspace, Rename pane, New tab, New worktree, Open worktree…, hairline, Close (Close workspace with several panes).

## Tokens used
`--bg-panel`, `--bg-hover`, `--border`, `--shadow-pop`, `--radius-lg`, `--radius-md`, `--control-h`, `--text`, `--text-strong`, `--text-dim`, `--status-blocked`, `--fs-sm`, `--fs-xs`, `--fs-2xs`, `--tracking-caps`, `--hairline`, `--z-drawer`.

## Do & Don't
- Do put destructive items last, under a hairline, in the danger colour; a close then asks in a confirm.
- Do support arrows, Home/End, Escape and click-outside; Tab leaves (and closes) the popover.
- Don't put a menu inside a scroll container; portal it at fixed coordinates so it is not clipped.
- Don't use hints for help text; they state a current value.

Source: src/components/RowMenu.tsx · src/components/RowMenu.css (+ src/styles.css `.menu*`)
Preview: static rendition (markup + the repo's CSS), not the live React component.
