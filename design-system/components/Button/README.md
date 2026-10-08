Medium text buttons (`.btn` with primary, danger and ghost variants) and square unlabeled icon buttons (`.icon-button`) at the shared control height.

## When to use
- `.btn` for a labeled command: dialog footers (Cancel / Close project), New project, Reconnect, the header's Split.
- `.btn-primary` for the one forward action of a surface; `.btn-danger` for something that cannot be undone (usually inside a confirm); `.btn-ghost` for a quiet header or toolbar command.
- `.icon-button` for a familiar glyph-only control (sign out, the header's Alerts bell, steppers; `.context-copy` is the small dim copy-path variant); add `.is-outlined` when it sits on its own and needs an edge (font-size steppers in Settings).

## Anatomy
- `button.btn` — inline-flex, `gap: --space-2`, optional leading 16px Lucide `svg` + label text.
- Variant classes stack on `.btn`: `.btn.btn-primary`, `.btn.btn-danger`, `.btn.btn-ghost`.
- `button.icon-button` — `--control-h` square, one Lucide `svg` sized `--icon-size`; `.icon-button.is-outlined` adds the `--border` edge.

## States & variants
- Neutral: `--bg-elevated` fill, `--border` edge, `--text-strong` label.
- Primary: `--primary` fill and edge, `--primary-text`; hover `--primary-hover`.
- Danger: `--danger-tint` fill, `--status-blocked` edge, `--danger-text` label.
- Ghost: no fill, no edge, `--text` label.
- Hover (pointer devices only, `@media (hover: hover)`): `--bg-hover` fill, `--border-strong` edge.
- Disabled: `.btn` at opacity 0.55, `.icon-button` at 0.7; no hover.
- Icon button open/pressed (`:active` or `aria-expanded="true"`): `--bg-elevated` fill, `--accent` edge, `--text-strong` glyph.
- Coarse pointers grow both families to `--touch-target`; reduced motion drops the transitions.

## What the consumer provides
- A real `<button type="button">` (or an `<a>` styled as `.btn` for links like Reconnect).
- `.icon-button` must carry `aria-label` (and usually a matching `title`); glyphs are `aria-hidden="true"`.
- Menu triggers set `aria-haspopup="menu"` and `aria-expanded`.

## Tokens used
`--control-h`, `--touch-target`, `--radius-md`, `--hairline`, `--space-2`, `--space-3`, `--fs-sm`, `--fw-medium`, `--icon-size`, `--bg-elevated`, `--bg-hover`, `--border`, `--border-strong`, `--text`, `--text-strong`, `--primary`, `--primary-hover`, `--primary-text`, `--danger-tint`, `--danger-text`, `--status-blocked`, `--accent`, `--dur-fast`, `--ease-out`.

## Do & Don't
- Do keep one primary per surface; put the danger action on the right of a confirm, with focus on Cancel.
- Do give every icon button an accessible name.
- Don't invent sizes: both families share `--control-h` so they line up in a header.
- Don't use `.btn-danger` for a reversible action, or an icon button for an unfamiliar action that needs words.

Source: src/components/*.tsx (App.tsx header, ConfirmDialog.tsx, SettingsDialog.tsx) · src/styles.css
Preview: static rendition (markup + the repo's CSS), not the live React component.
