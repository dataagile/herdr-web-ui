A single-choice switch: one `aria-pressed="true"` option highlighted on an elevated, bordered track, used for the Chat/Terminal lens and for Settings choices like theme and density.

## When to use
- Switching between two to four mutually exclusive modes that apply immediately: the header's pane view (Chat / Terminal), Theme (Dark / Light / System), Colors, Density, Language, Sidebar grouping, Panes open in, Chat width.
- Not a generic tab list: it does not own panels, and it is not for navigation.

## Anatomy
- `div.segmented` — inline-flex track, 2px padding and gap, `--bg-elevated` fill, `--border` edge, `--radius-md`.
- `div.segmented > button` — option, `calc(--control-h - 6px)` tall, `--radius-sm`, `--fs-sm` medium label, optional 15px Lucide icon before the label.
- Header variant: `.segmented.view-switch` with `MessageSquare` / `SquareTerminal` icons and labels wrapped in `span.header-desktop-only` (labels drop below 560px, icons stay).
- Phone (`<=480px`): the header switch is hidden and `button.icon-button.view-toggle` stands in for it, one button whose icon is the current lens (`MessageSquare` or `SquareTerminal`) and whose title/`aria-label` names the other lens ("Switch to Terminal" / "Switch to Chat"). It is not a segmented control: it holds no `aria-pressed`.
- Optional `span.pill.pill-soon` inside an option for a lens that is not available yet.

## States & variants
- Unpressed: transparent, `--text-dim`.
- Pressed (`aria-pressed="true"`): `--bg-hover` fill, `--text-strong` label, and its icon takes `--accent`.
- Labels never wrap (`white-space: nowrap`), including CJK/Hangul.

## What the consumer provides
- An accessible name on the group (`aria-label="Pane view"`, `"Theme"`…); the header one also sets `role="group"`.
- `type="button"` options with `aria-pressed` reflecting the current value; exactly one is true.
- Tooltips naming the shortcut where one exists (`Chat transcript (⌘⇧J)`).

## Tokens used
`--bg-elevated`, `--bg-hover`, `--border`, `--hairline`, `--radius-md`, `--radius-sm`, `--control-h`, `--space-1`, `--space-3`, `--fs-sm`, `--fw-medium`, `--text-dim`, `--text-strong`, `--accent`, `--dur-fast`, `--ease-out`.

## Do & Don't
- Do keep options short (one or two words) and the set small.
- Do use `aria-pressed`, not a class, for the selected state: the CSS keys off the attribute.
- Don't use it for actions (that is a button group) or for more than about four choices (use a select).
- Don't add a floating view-toggle pill elsewhere: the header switch is the only lens control.

Source: src/App.tsx · src/components/SettingsDialog.tsx · src/styles.css
Preview: static rendition (markup + the repo's CSS), not the live React component.
