The sidebar roster: a PC group header followed by one two-line row per herdr workspace, each showing the workspace's current pane and its rolled-up agent state.

## When to use
- The left sidebar (`--sidebar-w`, on `--bg-panel`) is the only place this lives: one `.machine-group` per PC, one `.workspace` row per workspace, as herdr's Spaces sidebar.
- Not for a list of panes: the other panes of a workspace are reached from the tab strip, the command palette and Needs you.

## Anatomy
- PC header `.machine-header`: `.machine-toggle` (caret `.machine-caret`, monitor `.machine-icon`, `.machine-name`, `.machine-kind` "Host" for the local PC, `.machine-dot.is-<state>`), then a `.sidebar-row-action` `+` (new workspace, disabled offline) and, for SSH PCs, a manage button. `.machine-state` spells out every state except connected (kept `.visually-hidden`).
- List: `.machine-workspaces > nav.sidebar-list > ul.workspace-list > li.workspace.pane-item`.
- Row `.pane-row`: `.sidebar-drag-handle` (absolute, left gutter, hover/focus only), `.pane-select` (`role="button"`) holding `.agent-mark-holder` (agent mark, or `.is-shell` with the Terminal glyph) and `.pane-copy` with `.pane-primary > .pane-title` on line one and `.pane-meta` (state `.badge`, optional `.badge-background` count, `.pane-subtitle` place) on line two; `.pane-actions > .row-menu-toggle` (the `⋯`).
- Worktree children sit in `li.worktree-children` behind a hairline; By folder mode adds `.directory-group` / `.directory-header`.

## States & variants
- Selected `.is-selected`: `--bg-hover` fill, an amber rail (`::before`, `--rail-w`, `--accent`) outside the rounded box, an amber-edged mark box on `--accent-tint`, and the `⋯` visible.
- Hover / focus-within: hover fill, grip and `⋯` appear. Touch: grip and `⋯` always shown, actions grow to `--touch-target`.
- State word (roll-up: blocked > working > done > ready): INPUT `.badge-blocked`, RUN `.badge-working` (breathing dot), DONE `.badge-done`, READY `.badge-idle`, `—` `.badge-unknown`; `.badge-restore-error` replaces it for a pane herdr could not restore.
- PC dot: `is-connected` done green, `is-connecting`/`is-reconnecting` working pulse, `is-error` blocked, otherwise idle.
- Dragging `.is-dragging` (55% opacity); inline rename swaps the title/meta for `.pane-rename-input`; `.sidebar-inline-error` under a row for server failures.

## What the consumer provides
- Per PC: name, kind (local/ssh), connection state, error text.
- Per row: the workspace label, its current pane (agent or shell, title with prompt chrome stripped and paths shortened to their last folder, cwd), every pane's status for the roll-up, background task count.
- aria: `aria-current="true"` on the selected `.pane-select`; `aria-label` "Reorder project {name}", "More for {title}", "New project on {pc}"; `aria-expanded` on the toggle and `⋯`; full pane id/title/cwd in the row's `title`.

## Tokens used
`--bg-panel`, `--bg-hover`, `--bg-elevated`, `--border`, `--text`, `--text-strong`, `--text-dim`, `--accent`, `--accent-tint`, `--status-done`, `--status-working`, `--status-blocked`, `--status-idle` (+ their `-tint`s via badges), `--row-h`, `--avatar-size`, `--mark-size`, `--rail-w`, `--dot-size`, `--chip-h`, `--control-h`, `--icon-size`, `--radius-md`, `--radius-sm`, `--radius-pill`, `--space-1`…`--space-4`, `--fs-sm`, `--fs-xs`, `--fw-semibold`, `--lh-tight`.

## Do & Don't
- Do keep every row two lines: title alone on line one, state word first on line two.
- Do spend amber only on the selected row (rail + mark box edge); mark boxes stay neutral otherwise.
- Do name on line two only what the title does not already say (workspace, then folder).
- Don't add workspace headers, numbers or folds in the By project view.
- Don't colour a row by state: the badge carries the colour and the word.
- Don't put more than the one `⋯` at the row's end; actions live in the row menu.

Source: src/components/Sidebar.tsx · Sidebar.css (PC header: MachineSidebar.tsx · Machines.css)
Preview: static rendition (markup + the repo's CSS), not the live React component.
