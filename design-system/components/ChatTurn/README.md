One exchange in the chat lens: the user's words as a raised neutral card on the right, the agent's answer as plain prose, and everything it did in between folded under one "Worked for 41s · 1 edit" work block.

## When to use
- The chat transcript (`.chat-view` > `.chat-transcript`), a quiet document on a centred `--chat-w` column over `--bg`.
- Not for the terminal fallback or runtime notices: those use `.chat-terminal-fallback` and `.chat-compact`.

## Anatomy
- `.chat-turn.chat-turn-user` > `.chat-user-row` > `.chat-bubble` (holds a `.markdown`) + `.chat-turn-meta` (time, `.icon-button.chat-copy`).
- `.chat-turn.chat-turn-agent`: optional `.work-block`, then one `.markdown` per answer part, then `.chat-turn-meta.chat-agent-meta` (`.chat-meta-btn` MD / `.chat-meta-plain` "Plain text", time).
- Markdown: `p`, `.markdown-list` (`ul`/`ol`), inline `code`, `.markdown-code` (`.markdown-code-header` with language + `.markdown-code-copy`, then `pre > code`, optional `.markdown-code-more`), tables in `.markdown-table-wrap`.
- `.work-block` > `button.work-block-head` (`.work-row-caret`, `.work-block-title`, `.work-block-summary`, `.work-block-failed`) + `.work-block-rows`.
- `.work-row` > `button.work-row-head` (`.work-row-caret`, `.work-row-name.is-verb` or `.work-row-name`, `.work-row-summary`, `.work-row-failed`) + `.work-row-detail` when opened; `.work-narration` between rows.

## States & variants
- User bubble: at most 80% wide, no avatar or name. A user turn after an agent turn gets `--space-5` extra above it.
- Meta rows are `opacity: 0` until hover/focus with a fine pointer; always visible on coarse pointers.
- Work block: `.is-folded` (settled; dim regular-weight footnote with a hairline under it), open, `.is-live` ("Working…" in `--status-working` behind a breathing dot), `.is-live.is-waiting` ("Needs you", still `--status-blocked` dot).
- Work row: verb + object (`Read`, `Edited`, `Wrote`, `Ran`), unknown tool keeps its id in mono; `.is-error` turns the verb red and adds "failed" after the object.
- Code blocks never scroll inside; over 30 lines they open at 20 behind "Show all N lines". With a mouse the header becomes a hover-only corner control.

## What the consumer provides
- Turns (role, timestamp, parts); the answer as Markdown; tool parts with name, summary, error, input/output.
- Duration and counts for the work header (`workSummary`, `formatWorkDuration`); verbs from `lib/toolVerbs.ts`.
- `aria-expanded` on every head button; `role="log"` + `aria-live="polite"` on `.chat-view`; copy buttons need `aria-label` ("Copy message", "Copy as markdown").

## Tokens used
`--bg`, `--bg-elevated`, `--bg-panel`, `--bg-hover`, `--bubble-border`, `--border`, `--text`, `--text-strong`, `--text-dim`, `--accent`, `--status-working`, `--status-blocked`, `--status-done`, `--radius-lg`, `--radius-sm`, `--fs-chat` (via `--chat-fs-body`), `--fs-sm`, `--fs-xs`, `--fs-2xs`, `--lh-prose`, `--lh-code`, `--font-chat`, `--font-mono`, `--space-1`…`--space-5`, `--control-h`, `--chip-h`, `--chat-w`.

## Do
- Keep the answer outside the fold; keep only the running turn's block open.
- Let space separate exchanges; the only rule is the hairline under a folded work block.
- Show a failure count in its own `.work-block-failed` so it is never ellipsized.

## Don't
- Don't colour the user bubble with the accent or add avatars/names to either side.
- Don't add per-tool icons or separators to work rows.
- Don't set prose or questions in mono; mono is for code, paths and commands.

Source: src/components/ChatView.tsx · ChatView.css (Markdown from src/components/Markdown.tsx)
Preview: static rendition (markup + the repo's CSS), not the live React component.
