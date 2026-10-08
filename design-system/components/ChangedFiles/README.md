The header's **modified files** button, its panel, and the changes tab of the file viewer: what the pane's agent changed in its session, and what else git sees changed in the pane's folder.

## When to use
- The pane in front runs an agent whose transcript shows file-changing calls (Edit, Write, MultiEdit, a Codex patch, pi / omp / gjc / omo edits). The button is not drawn at 0 files, nor for a PC whose bridge has no `GET /api/pane/changed-files`.
- Not a file browser (that is Files) and not a git client: it lists, shows diffs, and opens the viewer. It never stages, reverts or writes.

## Anatomy
- Button: `span.header-amod > button.icon-button` (Lucide `FileDiff`) + `span.pill.header-amod-count` (the number of session files, over the icon's top-right corner, `--accent` edge and `--accent-tint` fill, `pointer-events: none`). It is the last control of the bar, after the Chat/Terminal switch and before `.header-meta`, at every width. `aria-label` and `title`: "Files modified in this session (N)".
- Panel: the Files dialog's modal (`.modal.files-dialog.changed-dialog`, a bottom sheet up to `640px`). Two groups, each `h3.menu-heading` + `span.pill` count + `.dir-browser > ul.dir-browser-list`:
  - **In this session** — files the agent's calls changed, newest first.
  - **Other changes in git** — changed in the pane's repo but by no call of the session, with `p.changed-note` "May include changes that are not from this agent."
- Row: `button.dir-browser-item.is-file.changed-row` — file icon, `.changed-main` (`.changed-path`: folder in `--text-dim` then the file name in `--text-strong`, mono `--fs-xs`; for a session file `.changed-meta`: `span.pill` "edited ×N" or "created" (plus `span.pill` "uncertain" for a failed Codex script whose patch may have landed), then `.changed-time`), and `.changed-git`, git's one letter: `M` / `R` dim, `A` and `?` (not tracked yet) `--status-done`, `D` `--status-blocked`.
- Viewer: the File viewer with `.changed-tabs` under its header — `.segmented` "Changes in this session" (or "Changes in git") and "File" (the existing viewer), and `.changed-tabs-note` "N edits · last HH:MM" (hidden up to `640px`, where the segmented fills the row). The changes tab is a column of `section.changed-edit`: `p.changed-edit-head` "Edit 2 of 3 · 10:35" then the chat's own diff (`.chat-tool-io.is-whole > pre.chat-diff` with `.chat-diff-add` / `-del` / `-head`). A git-only file shows `git diff` the same way.

## States & variants
- Loading / failed: `.file-viewer-note` ("Loading…", "The changes could not be loaded.", the latter `role="alert"`).
- Session longer than the server reads (the newest 40 pages): `p.changed-note` "Long session: showing the last N parts" above the groups.
- Watch-only device: the viewer has no changes tab (the diff route refuses it).
- Git status too long to read: no git group, `p.changed-note` "Too many changes in the repository to list".
- Opened from the panel, the viewer starts on the changes tab; opened any other way (Files, a path in the chat) it starts on "File" and still offers the tab.
- Refresh: when the pane's status changes (the count) and every 15 s while the panel is open; a closed panel does not poll.
- Phone (`<=480px`): the Chat/Terminal switch is one `button.icon-button.view-toggle` showing the current lens' icon; its title says what a tap switches to. This frees a `--touch-target` for this button.

## What the consumer provides
- The list from the server and one fetch per opened file. Paths are the ones the list returned; any other path is refused (404 `file_not_changed`).
- Strings through `t()`, in every language.

## Tokens used
`--accent`, `--accent-tint`, `--status-done`, `--status-blocked`, `--text-dim`, `--text-strong`, `--border`, `--hairline`, `--font-mono`, `--fs-xs`, `--fs-2xs`, `--fw-semibold`, `--lh-base`, `--control-h`, `--touch-target`, `--space-1` … `--space-5`.

## Do & Don't
- Do keep git's letter the only colour on a row: green and red mean added and deleted, nothing else.
- Do say that the git group may hold changes that are not the agent's.
- Don't show the button for a pane with nothing in the session.
- Don't add a second Chat/Terminal control above `480px`: the single toggle replaces the switch only on a phone.

Source: src/components/ChangedFilesDialog.tsx · FileChanges.tsx · FileViewer.tsx · ChangedFiles.css · src/styles.css (`.view-toggle`)
Preview: static rendition (markup + the repo's CSS), not the live React component.
