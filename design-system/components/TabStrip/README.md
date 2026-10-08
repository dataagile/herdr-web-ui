herdr's tab row over the pane: one tab per herdr tab of the selected workspace, state dots, the open tab underlined in the accent, and a `+` for a new tab.

## When to use
- Over the pane column, once the selected pane's workspace has two or more panes (a second tab or a split); for a lone pane only on a phone (up to 480px), where the header carries no title and this strip is the one place the pane is named: there the open tab is always named by the pane in front, whatever its own name; another tab herdr still names by its number and that holds one pane shows the pane's title instead of **Tab n**.
- Not for switching workspaces (that is the roster) or for app-level navigation.

## Anatomy
- `.tab-strip` (`role="tablist"`, labelled "Tabs of {workspace}"): a horizontally scrolling row without a scrollbar, `--control-h` tall on a hairline.
- Per tab `.tab-strip-item` (+ `.is-active`, `.has-panes`, `.is-editing`):
  - `.tab-strip-tab` (`role="tab"`, `aria-selected`, roving `tabindex`) holding an optional `.tab-strip-dot[data-status]` and `.tab-strip-label`.
  - `.tab-strip-panes`: the chevron that opens the pane picker / tab menu (shown on multi-pane tabs; on touch also on the open tab). On a multi-pane tab it carries `.tab-strip-panes-count`: the number of panes ("2") while the tab shows them side by side, or which one is in front ("1/2") when one pane at a time is shown (a phone, a narrow window, a zoom).
  - `.tab-strip-close`: the 20px x, its place kept in every tab so widths never move.
  - `.tab-strip-rename`: the input that replaces the tab while renaming.
- `.tab-strip-add`: the `+`, sticky at the strip's end while tabs scroll under it.
- `.tab-strip-error`: a `--status-blocked` line at the end for six seconds after a failed rename/close.

## States & variants
- Phone (≤480px): the label is cut short with an ellipsis (`max-width: calc(100vw - 11rem)`) so a long pane title never pushes the open tab's chevron or the `+` out of the strip.
- Open tab: strong text and a 2px `--accent` inset underline under the whole item, x included; the x is visible.
- Other tabs: dim text; the x shows on hover or focus.
- Dots (7px) only for working (`--status-working`), blocked (`--status-blocked`) and done (`--status-done`); idle shows none.
- Multi-pane tab: chevron beside the name; on the open tab the chevron and x sit side by side.
- Touch (`pointer: coarse`): no x, buttons grow to `--touch-target`, the open tab carries the chevron and its menu is a bottom sheet.
- From 769px the strip takes the pane's surface (`--term-bg`, or `--bg` over chat) instead of `--bg-panel`.

## What the consumer provides
- The workspace's tabs in herdr order: label (or "Tab n" by place), rolled-up agent status, its panes; the selected pane.
- Handlers: select pane, new tab, rename, close (confirm only when an agent is working/blocked in it, or it is the last tab).
- aria: tab names, "Panes in {tab}" / "Actions for {tab}" on the chevron with `aria-haspopup="menu"` and `aria-expanded`, "Close tab {name}" on the x, "New tab" on `+`.

## Tokens used
`--bg-panel` (`--strip-bg`), `--term-bg`, `--bg`, `--bg-hover`, `--border`, `--text-dim`, `--text-strong`, `--accent`, `--status-working`, `--status-blocked`, `--status-done`, `--control-h`, `--chip-h`, `--touch-target`, `--hairline`, `--radius-sm`, `--radius-pill`, `--space-1`…`--space-3`, `--fs-sm`, `--fs-xs`, `--fw-medium`.

## Do & Don't
- Do keep the underline the only accent on the strip.
- Do keep the `+` reachable at the end, however many tabs scroll.
- Do read keys: arrows / Home / End move, F2 renames, Delete closes.
- Don't show the strip for a workspace with one pane above 480px; at 480px and under always show it, with no selected pane never.
- Don't hide the x by removing it: it keeps its place (visibility) so tabs don't change width.
- Don't ask before every close; only when it costs more than the tab.

Source: src/components/TabStrip.tsx · TabStrip.css
Preview: static rendition (markup + the repo's CSS), not the live React component.
