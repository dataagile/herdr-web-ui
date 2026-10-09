The sidebar roster: per PC a header, the Needs you block, a Projects head and one row per herdr workspace (its current pane and rolled-up state), then one Agents list across all PCs. Upstream's v0.4 sidebar (one grid, quiet heads) with the Data Agile additions on top.

## When to use
- The left sidebar (`--sidebar-w`, or the width its edge was dragged to; on `--bg-panel`) is the only place this lives: one `.machine-group` per PC, one `.workspace` row per workspace, one `.agents-sidebar` for every PC's agents.
- Not for a list of panes: the other panes of a workspace are reached from the tab strip and the command palette. Needs you and Agents are the lists that name panes.

## Anatomy
- Every row sits on the `--side-*` grid declared on `.sidebar-shell`: a `--control-h` leading cell (`.sidebar-mark`), the title, a `--control-h` trailing status cell.
- PC header `.machine-header`: `.machine-title` (monitor `.sidebar-mark`, `.machine-name`, `.machine-kind` "Host" for the local PC, `.machine-dot.is-<state>`), an SSH PC's manage button, then the fold caret `.machine-toggle`. No `+` here (fork): a project starts from the Projects head. `.machine-state` spells out every state except connected (kept `.visually-hidden`).
- Needs you (fork) `section.needs-input`, inside the `.machine-group` right under the header and outside the PC fold: `h2.needs-input-heading > button.sidebar-section-header.needs-input-toggle` (chevron, label, `span.pill` count; folds the list, stored per PC, open by default) and `ul.agent-list > li.needs-input-item > button.agent-row.needs-input-select` (agent mark, `.agent-title.pane-title`, `.agent-context` with the workspace, the full state `.badge` at the right). Blocked rows (INPUT) first, then done (DONE).
- Projects head (fork) `.sidebar-section-row`: `button.sidebar-section-header` ("Projects · n", chevron in the leading cell) and `button.sidebar-row-action.sidebar-section-new` (New project on the PC) in the status column. History (local PC) follows the rows under the same kind of head.
- List: `.machine-workspaces > nav.sidebar-list > ul.workspace-list > li.workspace.workspace-group`, each `.workspace-header`: the folder (`.workspace-folder`, or the `.workspace-toggle` fold of a repository with linked worktrees), `.pane-select.workspace-select` (`role="button"`: agent `.sidebar-mark`, `.workspace-copy` one or two lines, `.sidebar-pane-meta` with the compact status), then `.workspace-actions` (fork `+` New tab, then the `⋯` `.row-menu-toggle`).
- Worktree children sit indented in `li.worktree-children`.
- Agents `.agents-sidebar`: `.agent-section-toggle` head, `.agent-list-contents > ul.agent-list > li.agent-item > button.agent-row` (mark, `.agent-title`, `.agent-context`, `.agent-row-status`).

## States & variants
- Selected `.is-selected`: `--side-selected` fill, title in `--text-strong`. Hover (pointer only): `--side-hover`. Keyboard focus: ring inside the row.
- Compact status (`.sidebar-status`): a red `?` while blocked, a green dot when done and not looked at, a dim spinning arc while working, empty when ready. Needs you rows keep the full word badge (INPUT, DONE).
- Needs you: `--accent-tint` fill, `--rail-w` left bar in `--accent`, head and pill in `--accent`, `--radius-md`. Absent when the PC has no waiting pane and when it is offline; stays visible when the PC is folded.
- The `⋯` and `+` of a row take no width at rest; shown on hover, focus, selection and while the menu is open; always on touch.
- PC dot: `is-connected` done green, `is-connecting`/`is-reconnecting` working pulse, `is-error` blocked, otherwise idle.
- Dragging `.is-dragging`; inline rename swaps the title for `.workspace-rename-input` / `.pane-rename-input`; `.sidebar-inline-error` under a row for server failures.

## What the consumer provides
- Per PC: name, kind (local/ssh), connection state, error text.
- Per row: the workspace label, its current pane (agent or shell, title, cwd), every pane's status for the roll-up, background task count.
- aria: `aria-current="true"` on the selected selector; `aria-label` "Reorder project {name}", "More for {title}", "New project on {pc}", "New tab in {workspace}"; `aria-expanded` on the folds and `⋯`.

## Tokens used
`--bg-panel`, `--bg-hover`, `--bg-elevated`, `--border`, `--text`, `--text-strong`, `--text-dim`, `--accent`, `--accent-tint`, `--status-*`, `--control-h`, `--space-1`…`--space-6`, `--rail-w`, `--radius-md`, `--radius-sm`, `--fs-sm`, `--fs-xs`, `--fs-md`, `--lh-tight`, `--icon-size`.

## Do & Don't
- Do keep one grid: leading cell, title, status cell.
- Do part sections by space and quiet heads, never by rules.
- Don't colour a row by state: the status glyph or badge carries it.
- Don't add a second attention block or a top-level one: Needs you is per PC.

Source: src/components/Sidebar.tsx · Sidebar.css · NeedsInput.tsx · AgentSidebar.tsx (PC header: MachineSidebar.tsx · Machines.css)
Preview: static rendition (markup + the repo's CSS), not the live React component.
