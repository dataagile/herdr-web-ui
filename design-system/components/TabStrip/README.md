herdr's tab row over the pane: one tab per herdr tab of the selected project, state dots, the open tab underlined in the accent, a `⋯` menu on the selected tab, and a `+` for a new tab.

## When to use
- Over the pane column, always (even for a single pane, as herdr's TUI shows its single tab and `+`). On a phone (up to 480px), where the header carries no title, this strip is the one place the pane is named: there the open tab is always named by the pane in front (the Data Agile fork's phone rule), whatever its own name; another tab herdr still names by its number and that holds one pane shows the pane's title instead of **Tab n**.
- Not for switching projects (that is the roster) or for app-level navigation. Pane actions (Split, Zoom, Rename pane, Close pane) belong to the pane's own header menu (`PaneCanvas`), not to the strip.

## Anatomy
- `.tab-strip` (`role="tablist"`, labelled "Tabs of {project}"): a horizontally scrolling row without a scrollbar, `--control-h` tall on a hairline. Its surface is `--strip-bg`.
- Per tab `.tab-strip-item` (+ `.is-active`, `.has-panes`, `.is-editing`, `.is-dragging`, `.is-drop-before` / `.is-drop-after`):
  - `.tab-strip-tab` (`role="tab"`, `aria-selected`, roving `tabindex`) holding an optional `.tab-strip-dot[data-status]` (or `.tab-strip-glyph` when Settings → Status indicators is Dots or Symbols) and `.tab-strip-label`.
  - `.tab-strip-menu`: the `⋯` (ellipsis) button on the selected tab, which opens the tab's menu. No close buttons and no chevrons: Close tab lives in that menu.
  - `.tab-strip-rename`: the input that replaces the tab while renaming.
- `.tab-strip-add`: the `+`, sticky at the strip's end while tabs scroll under it.
- `.tab-strip-error`: a `--status-blocked` line at the end after a failed rename, close or move.
- `.tab-strip-row` / `.tab-strip-end`: the strip plus an end slot, when the consumer supplies one.

## States & variants
- Open tab: strong text and a 2px `--accent` inset underline under the whole item, `⋯` included.
- Other tabs: dim text.
- Dots (`--dot-size`) for working (`--status-working`), blocked (`--status-blocked`), done (`--status-done`) and waiting (a ring in `--status-working`: only background work runs); idle shows none. Dots and Symbols use the sidebar's glyph in `--indicator-*` colours, held still.
- Desktop with a mouse (≥769px, hover, fine pointer): the `⋯` holds its place on the selected tab, hidden, and fades in while the strip is hovered, the tab has keyboard focus or its menu is open, so the strip never reflows under the pointer. Right-click opens the same menu at the pointer; Shift+F10 or the menu key opens it from a focused tab.
- Touch (`pointer: coarse`) and up to 768px: the `⋯` is always in view; tabs, `⋯` and `+` are at least `--touch-target` square; the menu is a bottom sheet. Where a tab holds several panes and only one is shown at a time (up to 768px), the menu lists the panes first, the open one marked current.
- Phone (≤480px): the label is cut short with an ellipsis (`max-width: calc(100vw - 4 * var(--touch-target) - var(--space-4))`) so a long pane title never pushes the `⋯` or the `+` out of the strip. On a short phone (≤600px tall) the strip is hidden while a prompt card is docked; the pane's name returns once the card is answered.
- Drag to reorder (mouse): the dragged tab fades (`.is-dragging`) and a 2px `--accent` line (`.is-drop-before` / `.is-drop-after`) marks the insertion point, with edge scrolling. Touch uses Move tab left/right in the menu; Alt+Shift+Left/Right moves the focused tab.
- From 769px the strip takes the pane's surface (`--term-bg`, or `--bg` over chat) instead of `--bg-panel`.

## What the consumer provides
- The project's tabs in herdr order: label (or "Tab n" by place), rolled-up agent status, its panes; the selected pane.
- Handlers: select pane, new tab, rename, close (confirm only when an agent is working/blocked in it, or it is the last tab), move tab.
- aria: tab names, "Actions for {tab}" on the `⋯` with `aria-haspopup="menu"` and `aria-expanded`, "New terminal" on `+`.

## Tokens used
`--bg-panel` (`--strip-bg`), `--term-bg`, `--bg`, `--bg-hover`, `--border`, `--text-dim`, `--text-strong`, `--accent`, `--status-working`, `--status-blocked`, `--status-done`, `--indicator-working`, `--indicator-blocked`, `--indicator-done`, `--control-h`, `--touch-target`, `--hairline`, `--dot-size`, `--radius-sm`, `--radius-pill`, `--space-1`…`--space-3`, `--fs-sm`, `--fs-xs`, `--fw-medium`, `--dur-fast`, `--ease-out`.

## Do & Don't
- Do keep the underline the only accent on the strip (the drag line is momentary).
- Do keep the `+` reachable at the end, however many tabs scroll.
- Do read keys: arrows / Home / End move, F2 renames, Delete closes.
- Don't add per-tab close buttons or chevrons; the `⋯` menu is the one way in.
- Don't put pane actions in the tab menu; they belong to the pane.
- Don't ask before every close; only when it costs more than the tab.

Source: src/components/TabStrip.tsx · TabStrip.css
Preview: static rendition (markup + the repo's CSS), not the live React component.
