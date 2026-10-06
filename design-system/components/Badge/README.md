The agent state chip: a tinted uppercase word, READY, RUN, INPUT, DONE or "—", so state never rests on color alone.

## When to use
- Wherever a pane's or workspace's agent state is shown: sidebar roster rows (`.pane-meta`), the command palette, Needs you.
- `.badge-restore-error` (NOT RESTORED) for a pane herdr could not bring back after a restart, with the reason in `title`.
- `.badge-background` beside the state for background tasks still running (Layers icon + count).

## Anatomy
- `span.badge.badge-<state>` with `data-status="<state>"` and `title="Agent <WORD>"`; text is the state word.
- `--chip-h` tall, `--radius-sm`, `--fs-2xs` semibold, `--tracking-caps`, uppercase.
- Inside `.pane-meta` the badge shrinks to `--chip-h - 2px` with `--space-1` padding, followed by an optional background badge and the `.pane-subtitle` place line (`api · server`).

## States & variants
- `badge-idle` READY: `--text-dim` on `--bg-elevated`.
- `badge-working` RUN: `--status-working` on `--status-working-tint`, with a 5px breathing dot (`::before`, `pulse` animation) before the word; the word never fades.
- `badge-blocked` INPUT: `--status-blocked` on `--status-blocked-tint`.
- `badge-done` DONE: `--status-done` on `--status-done-tint`.
- `badge-unknown` "—": dim text, dashed `--border` edge (unknown herdr statuses fall here).
- `badge-restore-error` NOT RESTORED: `--danger-text` on `--danger-tint`.
- `badge-background`: dim, bordered, tabular numbers, 10px Layers icon.
- Reduced motion stops the RUN dot.

## What the consumer provides
- The herdr status, mapped through `knownStatus()` / `STATUS_WORD` (lib/status.ts); a row standing for several panes uses `rollupStatus()` (blocked > working > done > idle).
- The localized word and `title`; for background tasks an `aria-label` with the count.

## Tokens used
`--chip-h`, `--radius-sm`, `--radius-pill`, `--space-1`, `--space-2`, `--fs-2xs`, `--fw-semibold`, `--tracking-caps`, `--bg-elevated`, `--text-dim`, `--border`, `--status-working`, `--status-working-tint`, `--status-blocked`, `--status-blocked-tint`, `--status-done`, `--status-done-tint`, `--danger-text`, `--danger-tint`, `--dur-pulse`, `--ease-pulse`.

## Do & Don't
- Do always render the word; color and the dot only reinforce it.
- Do use the same four words on every surface (sidebar, palette, composer).
- Don't animate anything but the RUN dot, and never fade the word.
- Don't invent new states: anything herdr adds reads as unknown "—".

Source: src/components/Sidebar.tsx · src/styles.css · src/components/Sidebar.css
Preview: static rendition (markup + the repo's CSS), not the live React component.
