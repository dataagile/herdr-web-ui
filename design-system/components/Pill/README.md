A rounded mono chip (`.pill`) for small metadata: the Needs you count, row facts like "Already open", and the header's danger-toned "herdr offline".

## When to use
- A count or short fact beside a heading or row: `Needs you 2`, worktree rows (`Already open`, `Checkout missing`).
- `.pill-offline` only for the one header pill that says herdr is unreachable.
- `.pill-soon` inside a segmented option for a lens that is on its way (`soon`).
- Not for agent state (that is `.badge`) and not for actions.

## Anatomy
- `span.pill` — inline-flex, `--chip-h` tall, `0 --space-2` padding, `--border` hairline edge, `--radius-pill`, `--font-mono` at `--fs-2xs`, `--text-dim`, no wrap.
- Needs you: `h2.needs-input-heading > button.sidebar-section-header.needs-input-toggle` (fold chevron, text, then `span.pill` with the count; `aria-expanded`); inside `.needs-input` the heading and pill take `--accent` (pill edge too).
- Header: `.header-meta > span.pill.pill-offline` before the sign-out icon button. The Alerts bell (`span.header-bell`, with `.header-bell-dot` while alerts are off) is a direct header child before the Chat/Terminal switch, not part of `.header-meta`; it stays in the header at every width.
- Count over an icon: `span.pill.header-amod-count` on the header's modified-files button (`span.header-amod`), `--accent` edge and `--accent-tint` fill, absolutely placed at the icon's top-right and `pointer-events: none`.
- Worktree: last child of `button.worktree-row`, after the branch/path copy.

## States & variants
- Default: dim mono text on transparent with a neutral edge.
- `.pill-offline`: `--status-blocked` text and edge on `--danger-tint`.
- `.pill-soon`: auto height, `--accent` text and edge on `--accent-tint`, uppercase, small left margin.
- At `<=480px` the offline pill (and `.pill-version`) are hidden from the header.

## What the consumer provides
- Short text or a number (counts are rendered as-is; zero hides the Needs you section entirely).
- Context comes from the surrounding heading or row; the pill itself has no role.

## Tokens used
`--chip-h`, `--space-1`, `--space-2`, `--hairline`, `--border`, `--radius-pill`, `--font-mono`, `--fs-2xs`, `--text-dim`, `--status-blocked`, `--danger-tint`, `--accent`, `--accent-tint`.

## Do & Don't
- Do keep pill text to a word, a short phrase or a number.
- Do keep `.pill-offline` the only danger-toned pill in the header.
- Don't put interactive behavior on a pill or use it as a button.
- Don't use a pill for agent state words: badges carry the status tints and the written state.

Source: src/components/NeedsInput.tsx · src/App.tsx · src/components/WorktreeDialog.tsx · src/styles.css (+ NeedsInput.css, WorktreeDialog.css)
Preview: static rendition (markup + the repo's CSS), not the live React component.
