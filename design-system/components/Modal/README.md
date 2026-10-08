A centered dialog column with a header, a scrollable body and a footer of actions, over a dimming scrim; a bottom sheet on phones.

## When to use
- Focused tasks that need input or a decision: New project / New tab, Add PC, Worktree, Settings, Files, confirms.
- Not for quick action lists (use Menu) or transient notices (in-app alert).

## Anatomy
- `.modal-scrim` — `position: fixed`, full viewport, `--scrim` fill, `--z-modal`, centers the dialog with `--space-4` padding.
- `.modal` — flex column, `width: min(100%, 560px)`, `max-height: min(100%, 720px)`, `--bg-panel`, `--radius-xl`, `--shadow-pop`. Carries `role="dialog"` (or is a `<dialog>`), `aria-modal="true"`, `aria-labelledby`.
- `.modal-header` — `.modal-title` (`h2`, `--fs-lg`, semibold, `--text-strong`) + a close `.icon-button` with `aria-label`; hairline below.
- `.modal-body` — scrolls; holds `.field`s.
- `.modal-footer` — right-aligned buttons: `.btn.btn-ghost` Cancel, then `.btn.btn-primary`; hairline above.
- Feature classes add width or content: `.new-session-modal` (`--sidebar-w + --content-w / 4`), `.confirm-dialog` (420px), `.machine-dialog`, `.row-sheet`.

## States & variants
- Pending: fields and buttons disabled, primary label changes (Start → Starting…), a `role="status"` note.
- Error: a `role="alert"` line in `--status-blocked` inside the body.
- Subtitle: a `p.new-session-note` (`--fs-sm`, `--text-dim`) first in the body says what the dialog is for (feedback).
- Success: the body is replaced by a `role="status"` result (`.feedback-success`) and the footer keeps one primary Close; see FeedbackDialog.
- New tab variant: title `New tab · <workspace>`, the folder shown in a dashed `.new-session-folder` box.
- `<=640px`: bottom sheet, top `--radius-xl` corners, safe-area padding; with the keyboard up (`[data-keyboard]`) the scrim is `--app-height` tall.

## What the consumer provides
- A title naming the task and its target (`New project · devbox`), a labelled close button, the first field to focus.
- Escape, close button and scrim click all close; Cancel never commits.
- One primary action; a destructive confirm puts the danger button at the right and focuses Cancel.

## Tokens used
`--scrim`, `--bg-panel`, `--shadow-pop`, `--radius-xl`, `--border`, `--hairline`, `--text-strong`, `--fs-lg`, `--fw-semibold`, `--space-2` … `--space-5`, `--z-modal`, `--primary`, `--status-blocked`, `--app-height`.

## Do & Don't
- Do keep the footer to Cancel + one primary.
- Do let the body scroll, not the whole dialog.
- Don't stack modals; a confirm replaces or sits in the flow of the dialog that asked.
- Don't hide the close button while a request runs; disable it.

Source: src/components/NewSessionDialog.tsx · src/styles.css `.modal*` (+ NewSessionDialog.css)
Preview: static rendition (markup + the repo's CSS), not the live React component.
