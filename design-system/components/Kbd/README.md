An inline mono keycap (`kbd.kbd`) that names a keyboard key in hint text, the command palette and the Settings shortcut table.

## When to use
- Next to an action that has a global shortcut: command palette rows (`.palette-shortcut`), the Settings → Shortcuts table, and inline hint sentences.
- One keycap per key; a chord is several keycaps side by side.

## Anatomy
- `kbd.kbd` — inline-flex, 18px high, `0 5px` padding, `--border-strong` hairline edge with a 2px bottom edge, `--radius-sm`, `--bg-elevated` fill, `--text-dim` mono text at `--fs-2xs`.
- In the palette the keys are grouped in `span.palette-shortcut` (inline-flex, `--space-1` gap, pushed right with `margin-left: auto`) carrying an `aria-label` like `⌘ + Shift + K`.

## States & variants
- One visual state; it is not interactive.
- Keys render as their names (`Shift`, `K`, `Enter`, `Esc`); `Mod` resolves to `⌘` on Apple platforms and `Ctrl` elsewhere (`formatKeys` in lib/shortcuts.ts).
- The palette hides `.palette-shortcut` on small screens where there is no keyboard.

## What the consumer provides
- The key labels, already resolved for the platform.
- An `aria-label` on the grouping wrapper so a screen reader hears the chord as one phrase.

## Tokens used
`--font-mono`, `--fs-2xs`, `--radius-sm`, `--hairline`, `--border-strong`, `--bg-elevated`, `--text-dim`.

## Do & Don't
- Do use real `<kbd>` elements so the semantics match the look.
- Do show the platform's modifier (`⌘` vs `Ctrl`), never the literal word `Mod`.
- Don't use a keycap for a key with no shortcut behind it, or to style arbitrary mono labels (that is `.pill`).
- Don't show keycaps on touch-only layouts.

Source: src/components/CommandPalette.tsx · src/components/SettingsDialog.tsx · src/styles.css (+ CommandPalette.css, SettingsDialog.css)
Preview: static rendition (markup + the repo's CSS), not the live React component.
