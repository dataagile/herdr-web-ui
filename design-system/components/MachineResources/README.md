The PC's **resources** under its name in the sidebar: CPU, memory, disk and swap, the projects using the most, a warning on a project row that weighs on the PC (GLPI #269: "the PC froze and I did not know why"), and each agent's own use on its row (GLPI #280).

## When to use
- One line per connected PC, right under its `.machine-header` (and under the state or bridge notice when there is one). A PC that is not connected, or whose bridge has no `GET /api/system/resources`, draws no line.
- Not a monitor with history or charts: it answers "what is heavy right now". Disk and swap belong to the PC only; per project there are CPU and memory.

## Anatomy
- `div.machine-resources > button.machine-resources-strip` (`aria-expanded`; `aria-label` "PC resources: CPU 12%, …"; `title` with used and total, "Memory 5.0 GB of 7.6 GB"). In it one `span.machine-resource` per meter the PC reports: `.machine-resource-label` (CPU, Mem — "RAM" in Portuguese — Disk, Swap; `--text-dim`), `.machine-resource-value` (mono `--fs-2xs`, tabular), and `.machine-resource-bar`, a 2px hairline under the meter filled to `--fill` (the same drawing as the plan meters' chips).
- Popover `div.resource-popover[role=dialog]` "Who is using it", under the strip, inside the PC group: `p.resource-popover-head` (caps, `--fs-2xs`), up to five `button.resource-project` rows (agent `.sidebar-mark` of the project's heaviest pane, or the terminal glyph; `.resource-project-name`, the project; two `.resource-project-value`: CPU as a share of the whole PC, then memory), then `p.resource-popover-note` "Outside projects: 2.1 GB (browser, system…)". A row opens that pane.
- Project warning `span.resource-heavy` in the project row (`RosterRow`): Lucide `TriangleAlert` at 12px + what makes it heavy (CPU %, else memory), in `--status-blocked`, mono `--fs-2xs`. In a two-line row it leads `.workspace-place`, so the folder name is what gets cut; in a one-line row it follows the name. `title` "This project: CPU 95% · memory 1.8 GB".
- Agent use `span.resource-agent` in an Agents row (`RosterRow`): leads `.agent-context` with the memory of the agent's pane (its shell and everything under it), mono `--fs-2xs`, in the line's own `--text-dim`. Heavy (`.is-heavy`, the project thresholds applied to the one pane): `TriangleAlert` at 12px, the CPU % before the memory once it is past 50%, in `--status-blocked`. `title` "This agent: CPU 3% · memory 1.2 GB".

## States & variants
- High: a PC meter at 90% or more turns label and value `--status-blocked` and fills its hairline in it (`.is-high`); so does a project's CPU in the popover.
- Heavy project: from 50% of the PC's CPU or a quarter of its memory. Below that the row shows nothing. An agent row always shows its memory; only a heavy one turns red.
- First reading after the server starts: CPU has nothing to compare with and reads "—".
- A meter the PC cannot read is left out (swap on macOS, a page file Windows did not report).
- Open: the strip takes `--bg-hover`; Escape, a click outside or focus leaving closes it.
- Refresh: every 5 s while the page is on screen and the PC is connected; one server reading serves every device for 2 s (Windows: 10 s, one PowerShell at a time).

## What the consumer provides
- `MachineResources` from the PC's bridge (numbers and pane IDs only) and the PC's snapshot to group panes by project.
- Strings through `t()`, in every language.

## Tokens used
`--text`, `--text-dim`, `--text-strong`, `--status-blocked`, `--border`, `--border-strong`, `--bg-panel`, `--bg-hover`, `--side-hover`, `--shadow-pop`, `--hairline`, `--radius-pill`, `--radius-md`, `--radius-lg`, `--font-mono`, `--fs-xs`, `--fs-2xs`, `--fw-semibold`, `--tracking-caps`, `--side-row`, `--side-gutter`, `--machine-indent`, `--z-popover`, `--space-1` … `--space-3`.

## Do & Don't
- Do keep red for "this is what weighs": a meter at 90%, a heavy project. Nothing else on the line is coloured.
- Do keep the line under the PC it measures: a remote PC's numbers are that PC's.
- Don't show a warning on every row: a project that is not heavy draws nothing, an agent that is not heavy draws its memory in plain dim text.
- Don't add disk or swap per project: the disk is the PC's, and per-process swap exists on Linux only.

Source: src/components/MachineResources.tsx · MachineResources.css · src/lib/resources.ts · server/resources.ts
Preview: static rendition (markup + the repo's CSS), not the live React component.
