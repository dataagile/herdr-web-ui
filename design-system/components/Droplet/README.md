The in-app alert: an island-black card that drops from the top edge when a pane needs input, finishes a turn or ends, naming the pane and what happened.

## When to use
- While the app is on screen and a pane other than the open one changes state (needs input, finished per the device's Finished choice, or terminal ended).
- Not for the pane already open, not while the app is hidden (system notifications cover that), and not for app errors or confirmations.

## Anatomy
- `.droplet` (`role="status"`, `aria-live="polite"`, `data-phase="in|out"`, `data-kind="blocked|done|ended"`): fixed under the safe area and app header, `--z-droplet`; carries `--droplet-top`, `--droplet-drag`, `--droplet-fit` inline.
- `.droplet-goo > .droplet-blob`: the black liquid shape that falls, spreads and folds (SVG goo filter `#droplet-goo` in `.droplet-defs`).
- `.droplet-card` (a button, "Open pane"): `.droplet-mark` disc (agent mark, or `.droplet-mark-blank` without one), `.droplet-text` with `.droplet-title` (pane name) and `.droplet-detail` ("{PC} · Needs input" / "Finished" / "terminal ended"), and `.droplet-dot`.
- `.droplet-probe` measures `env(safe-area-inset-top)`.

## States & variants
- Kind sets `--droplet-tone`: blocked `--droplet-blocked`, done `--droplet-done`, ended `--droplet-text-dim`; the detail text and dot take it.
- Wide (over 768px): two-line card, 64px high, up to 396px.
- Phone (768px and under): one line, 44px high, as wide as its text (340px max, measured into `--droplet-fit`); the name is cut short, what happened is not, no dot.
- Motion: drop falls, spreads (540ms), text reveals at 560ms; stays 3.6s; exit fades text, folds, rises. A drag or flick up dismisses; touch holds it. Reduced motion: fade in place.

## What the consumer provides
- A queued notice: kind, pane title, optional PC name, agent (for the mark), machine and pane ids for the tap.
- `onOpen(machineId, paneId)`; one card at a time, a newer one folds the current away.
- aria: the card's `aria-label` "{title}, {detail}. Open pane"; the region is a polite live status.

## Tokens used
`--droplet-bg`, `--droplet-text`, `--droplet-text-dim`, `--droplet-blocked`, `--droplet-done`, `--droplet-mark-bg`, `--droplet-ring`, `--droplet-shadow`, `--z-droplet`, `--space-2`…`--space-5`, `--space-8`, `--radius-pill`, `--fs-md`, `--fs-sm`, `--fs-xs`, `--fw-semibold`, `--lh-tight`, `--ease-out`, `--ring`, `--ring-offset`.

## Do & Don't
- Do keep the card black in every theme; it is the one surface that ignores the palette.
- Do let what happened stay whole and cut the pane name instead.
- Do clear the measured header and safe area; never imitate a notch or guess a device.
- Don't stack alerts; replace.
- Don't alert for the pane already on screen.
- Don't add buttons to the card: the whole card opens the pane, a flick dismisses it.

Source: src/components/Droplet.tsx · Droplet.css
Preview: static rendition (markup + the repo's CSS), not the live React component.
