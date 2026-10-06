The card an agent raises when it is blocked on a question, approval or plan menu: docked over the composer's input card, with the agent's options as flat keycapped rows the user answers in one press.

## When to use
- While the agent is blocked and the pane shows a supported question, permission prompt or plan menu (Claude, omp, omo, codex).
- It lives in `.prompt-dock` between the held messages and the input card, not in the transcript, and does not scroll with it.

## Anatomy
- `.prompt-dock` (`aria-live="polite"`, stays rendered while empty) > `section.prompt-card` (`role="region"`, "Agent is asking").
- `.prompt-card-header` > visually-hidden "input needed" + `h2` title (the card's one red).
- Optional `.prompt-card-steps` > `.prompt-card-step` (`.is-answered`, `.is-current`) with `.prompt-card-step-mark` and `.prompt-card-step-label`.
- `.prompt-card-question` (prose), `.prompt-card-hint`, `pre.prompt-card-body` (`.is-line` for a one-line command).
- `.prompt-card-options` > `button.prompt-card-option` (or `label` with a checkbox for multi-select): `.prompt-card-number` keycap + `.prompt-card-option-text` (`.prompt-card-option-label`, optional `.prompt-card-tag` "Recommended", `.prompt-card-option-description`).
- `.prompt-card-submit` (multi-select), `.prompt-card-custom` (label + `.input` + `.btn`), `.prompt-card-confirm` (typed pick: text + Confirm/Cancel), `.prompt-card-error`.

## States & variants
- Single choice submits on press; multi-select shows checks plus "Submit (n)".
- Hover/focus fills a row `--bg-hover`; a checked or typed pick (`.is-checked`, `.is-typed`) gets `--accent-tint`, an `--accent` border and keycap.
- Typed pick from the message box waits in the card's confirm row ("Send 2. Always allow?").
- `aria-busy="true"` while an answer is on its way. Coarse pointers make each row `--touch-target` tall.
- Height is capped at max(60% of `--app-height`, 240px); only the reference text shrinks, then the card scrolls with a bottom fade.

## What the consumer provides
- The prompt: id, title, question, optional body, options (label, description), multi-select flag, custom option index, optional steps.
- The composer placeholder while the card is open: `Type 1–3 to choose…` (or `…or your own reply…`).
- Labels for assistive tech: "Agent is asking", "input needed", each option's number as "1.".

## Tokens used
`--bg-elevated`, `--bg`, `--bg-hover`, `--border-strong`, `--status-blocked`, `--text-strong`, `--text-dim`, `--accent`, `--accent-tint`, `--primary`, `--radius-xl`, `--radius-md`, `--radius-sm`, `--font-mono`, `--fs-sm`, `--fs-xs`, `--fs-2xs`, `--control-h`, `--touch-target`, `--space-1`…`--space-5`, `--app-height`, `--chat-w`.

## Do
- Weigh every option the same: no filled, outlined or first-placed default.
- Keep the question in prose and only the reference text (command, plan, diff) in the mono box.
- Give each new prompt its own card, opened with nothing picked.

## Don't
- Don't add a shadow; the card is `--bg-elevated` with a `--border-strong` hairline.
- Don't use red anywhere but the title.
- Don't fabricate a chat reply: the answer goes to the agent as its own navigation keys.

Source: src/components/PromptCard.tsx · PromptCard.css (dock in Composer.css)
Preview: static rendition (markup + the repo's CSS), not the live React component.
