The in-app feedback: a megaphone icon button in the header, a menu of three categories, a form dialog that opens a support ticket, and a picker that points at something on the screen. Shown only behind the portal, when the portal says feedback is on.

## When to use
- Reporting a bug, suggesting an improvement or giving general feedback from inside the app. The portal turns it into a ticket.
- Not for errors the app already reports (use the alert line of the dialog that failed).

## Anatomy
- Header button: `.icon-button.header-feedback` with a lucide `Megaphone`, `aria-label` and `title` "Send feedback", `aria-haspopup="menu"`, just before the bell, at every width (icon only). It takes the accent edge while its menu is open (`aria-expanded="true"`).
- Menu: the RowMenu (`.menu.row-menu`, a `.row-sheet` bottom sheet at `<=640px`) with Report a bug (`Bug`), Suggest an improvement (`Lightbulb`), General feedback (`MessageSquareText`).
- Dialog: `.modal-scrim > form.modal.feedback-modal` (560px; full height at `<=640px`), header with the category as title and a close button, body, footer Cancel + Send.
- Subtitle: a `.new-session-note` line above the first field.
- Description: `.field > label.field-label + textarea.input.feedback-textarea` (see Field).
- Image: `.feedback-image-actions` holds Choose image and, from 1024px with attachments on, Select element on screen; `.field-hint` says what was chosen. A chosen image shows as `figure.feedback-thumb` (image, caption with name and size, `.feedback-thumb-actions`: Remove ghost, Redo for a picker print).
- Technical data (from 1024px with attachments on): `.field.feedback-tech` with `label.feedback-check` (checkbox, on by default), a `.field-hint` with the masking note (it says the description is masked too), and `details.feedback-details` whose `pre.feedback-json` shows the exact JSON that will be sent: the description as the portal will mask it (secrets only: tokens, keys, passwords), plus the technical data and the element. Unchecked, neither `tech_context` nor `element_context` is sent and the preview shows only the description.
- Success: the body becomes `.feedback-success` (`role="status"`): the subtitle, a `CircleCheck` in `--status-done`, "Ticket #N opened", a thank-you hint and `a.feedback-link` "Open in support"; the footer keeps only Close.
- Error: a `p.field-hint.new-session-error[role="alert"]` in the body; the form is kept (429 too many submissions, 413 image too large, 503 unavailable, 503 `busy` says to try again in N s and disables Send for the portal's Retry-After, anything else generic). 504 (`glpi_timeout`: the ticket may exist) is never retried by the app, says so, and Send becomes a plain `.btn` reading "Send anyway" until the description is edited.
- Picker: `.picker-layer` (fixed, over everything, `--z-modal`, crosshair) with `.picker-dim` (`--scrim`), `.picker-target` (accent outline and `--accent-tint` over the element or the dragged area, `.picker-target-tag` with `tag.class`) and `.picker-hint` (a pill at the bottom: `Crosshair`, the instruction, `.kbd` Esc). While the print is made the hint says so. Everything it draws carries `data-feedback-picker` and is left out of the print. An icon (svg) resolves to the HTML element that holds it. Text of an element inside or holding a `data-feedback-private` surface (chat, composer, prompt cards, history rows, file viewer, files list, terminal) leaves only as `[TEXTO OMITIDO n chars]`; elsewhere it is masked and cut to 200 characters.

## States & variants
- Send is disabled until the description has text; while sending, fields and buttons are disabled and Send reads "Sending…".
- Phone (`<=1023px`): no picker, no technical data; the image can still be chosen.
- Picker: click selects an element, a drag over 6px an area, Escape cancels; the dialog is taken down while it runs so the print never shows it, and comes back with what was typed.

## What the consumer provides
- The portal's `feedback: { enabled, attachments }` from `/api/portal/me`; absent means off.
- Masking in the browser before anything leaves; the preview is the JSON that is sent.

## Tokens used
`--scrim`, `--ring`, `--row-h`, `--accent`, `--accent-tint`, `--shadow-pop`, `--bg-elevated`, `--bg-input`, `--border`, `--border-strong`, `--term-bg`, `--status-done`, `--primary`, `--text`, `--text-dim`, `--text-strong`, `--fs-xs`, `--fs-sm`, `--fs-2xs`, `--fs-md`, `--lh-base`, `--lh-code`, `--control-h`, `--chip-h`, `--radius-sm`, `--radius-md`, `--radius-pill`, `--space-1` … `--space-8`, `--z-modal`.

## Sizes derived from tokens
The thumbnail's `max-height` is `calc(var(--row-h) * 3)`, the JSON preview's `calc(var(--row-h) * 5)` and the checkbox is `var(--space-4)`: no token holds those sizes, so they are multiples of existing ones. The dialog is the stock `.modal` (560px).

## Do & Don't
- Do keep the footer to Cancel + Send; success leaves only Close.
- Do show the print as a thumbnail with Remove and Redo before it is sent.
- Don't draw the picker's own layer into the print, or let a click through to the app under it.
- Don't send technical data, an element or a description the preview does not show.

Source: src/components/FeedbackButton.tsx, FeedbackDialog.tsx, ElementPicker.tsx · src/components/Feedback.css
Preview: static rendition (markup + the repo's CSS), not the live React component.
