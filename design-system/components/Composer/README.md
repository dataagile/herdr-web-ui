The chat's message input: one raised card (`--radius-2xl`, `--shadow-card`) with the message box on top and one row of controls under it, ending in a single round button that is Send or Stop.

## When to use
- At the bottom of the chat lens, on the same `--chat-w` column and gutter as the transcript. It is the only card on that surface besides the prompt card docked over it.
- The terminal lens uses its own input line (TerminalInput), not this.

## Anatomy
- `.composer` (region; transparent inside `.terminal-stack.is-chat`) > optional `.composer-greeting`, `.composer-quick`, then `.composer-surface` (grid: attachments / text / left · status · right).
- `.composer-resize` grip on the card's top edge; `.composer-attachments` strip; `textarea.composer-text`.
- `.composer-controls.composer-controls-left`: `.icon-button.composer-attach` (lucide Plus), `.voice-mic-wrap` > `.voice-mic` (lucide Mic), background-task chip.
- `.composer-status` (`role="status"`, `data-status`): `.composer-status-meta` > visually-hidden agent name/state, `strong` (DONE only drawn), `.composer-pill` (`.agent-mark`, `.composer-model`, `.composer-reasoning`, `.composer-context` ring).
- `.composer-controls.composer-controls-right`: `.composer-queue-button` (lucide Clock + "Queue") and `.composer-action.composer-send` (lucide ArrowUp) or `.composer-action.composer-stop` (lucide Square).

## States & variants
- Idle: Send in `--primary`; disabled (0.7) while the box is empty.
- Done unseen: `data-status="done"` draws `DONE` in `--status-done` caps before the pill.
- Working: Stop replaces Send in the same circle (`--text-strong` fill, `--bg` glyph, `--status-blocked` on hover/focus). With a draft, Queue appears (`--primary-tint` pill; `--primary` outline in light themes only).
- Offline: Stop/Add disabled; "Reconnecting… message held here, never queued" as placeholder or status sentence.
- Focus: the card border turns `--accent`; no inner outline. Dragging files: `.is-dragging`.
- Context ring turns `--status-blocked` at 20% left or less (`.is-low`). The model label steps out whole when the row is too narrow (`data-model="out"`).

## What the consumer provides
- Placeholder `Message <agent>…` (or `Type 1–3 to choose…` while a prompt card takes typed answers).
- Agent id, status, model id + reasoning effort + context usage (metadata), background-task count.
- `aria-label`s: "Message composer", "Message", "Attach files", "Dictate (hold)", "Send message", "Stop agent", "Queue message", and the ring's "Context N% left · used of window tokens".

## Tokens used
`--bg`, `--bg-elevated`, `--bg-hover`, `--border`, `--border-strong`, `--accent`, `--accent-tint`, `--primary`, `--primary-hover`, `--primary-tint`, `--primary-text`, `--text`, `--text-strong`, `--text-dim`, `--status-done`, `--status-blocked`, `--radius-2xl`, `--radius-pill`, `--shadow-card`, `--touch-target`, `--control-h`, `--chip-h`, `--icon-size`, `--fs-chat`, `--fs-input`, `--fs-xs`, `--space-1`…`--space-5`, `--chat-w`.

## Do
- Keep one round button and swap only its glyph between Send and Stop.
- Let the pill be display-only: the context ring is its one pressable part.
- Keep the agent name and READY/RUN/INPUT visually hidden but in the status for assistive tech.

## Don't
- Don't add suggestion chips or starter prompts to the empty state.
- Don't give the pill hover, focus, cursor or a chevron.
- Don't ellipsize a status sentence; it takes its own line instead.

Source: src/components/Composer.tsx · Composer.css (mic from VoiceInput.tsx · VoiceInput.css)
Preview: static rendition (markup + the repo's CSS), not the live React component.
