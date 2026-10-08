A stacked form field: a dim uppercase label, an `--bg-input` input or select, an optional hint and an inline error.

## When to use
- Every text, path or choice entry inside a dialog (New project, New tab, Add PC, Worktree, Settings).
- Not for the composer or the terminal input; those have their own surfaces.

## Anatomy
- `.field` — flex column, `--space-1` gap, `--space-4` bottom margin. A `<label>` when it wraps one input; a `<div>` when the label points at a control by `id`/`aria-labelledby`.
- `.field-label` — `--fs-xs`, medium weight, `--tracking-caps`, uppercase, `--text-dim`.
- `.input` — `--control-h` high, `--bg-input` fill, hairline `--border`, `--radius-md`, `--text-strong`. Native `<select>` uses `.input` too (Settings).
- `.select` — same box for a custom select trigger: the agent picker is `button.select.agent-picker-trigger` with the shell glyph or agent mark, `.agent-picker-label` and a `ChevronDown` (`.agent-picker-chevron`).
- `.field-hint` — `--fs-xs`, `--text-dim`, below the control.
- Compound rows from the dialogs: `.new-session-cwd` (input + Browse `.btn`), `.new-session-folder` (a folder shown as a fact in a dashed box, New tab).
- Textarea: `textarea.input.feedback-textarea` — `height: auto`, at least three controls tall, `--space-2`/`--space-3` padding, `--lh-base`, vertical resize, `--text-dim` placeholder (the feedback description).
- Checkbox: `label.feedback-check` — a 16px native checkbox (`accent-color: --primary`) with its text in `--fs-sm`, the hint under it in a `.field-hint`; the whole label is the click target.
- Error: `p.field-hint.new-session-error[role="alert"]` (or `.machine-error[role="alert"]`) in `--status-blocked`, wrapping anywhere.

## States & variants
- Default, placeholder (the value herdr would use: the folder basename, the tab number), disabled (while a request is pending).
- Focus: the border turns `--accent`; no offset ring (the field already has an edge). Not shown statically.
- Error: a `role="alert"` line under the fields, in the blocked colour; the field itself keeps its normal border.
- Size: `--fs-input` (16px) under 641px so iOS does not zoom on focus; `--fs-sm` on desktop. Coarse pointers grow dialog controls to `--touch-target`.

## What the consumer provides
- A visible label, linked to the control (`<label>` wrap, `for`/`id` or `aria-labelledby`).
- A placeholder that shows the default herdr will apply, and a hint when the input has a format (`absolute path or ~/…`).
- The error text from the API, rendered with `role="alert"` so it is announced.

## Tokens used
`--bg-input`, `--border`, `--accent`, `--text-strong`, `--text-dim`, `--status-blocked`, `--radius-md`, `--control-h`, `--fs-xs`, `--fs-sm`, `--fs-input`, `--fw-medium`, `--tracking-caps`, `--space-1`, `--space-4`, `--touch-target`.

## Do & Don't
- Do keep labels short nouns (Agent, Directory, Name) and put guidance in the hint.
- Do show an inferred value as a placeholder or a dashed fact box rather than a disabled input.
- Don't colour the label or border red for an error; the alert line carries it.
- Don't drop `--fs-input` on small screens.

Source: src/components/NewSessionDialog.tsx · src/styles.css (+ NewSessionDialog.css, MachineDialog.tsx / Machines.css)
Preview: static rendition (markup + the repo's CSS), not the live React component.
