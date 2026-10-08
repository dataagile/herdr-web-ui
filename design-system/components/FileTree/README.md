The Files dialog's tree (`FileTree`), its filter, and the file viewer's two drawn formats (markdown and html).

## When to use
- Browsing the pane's folder from the header's Files button: folders open in place, a file opens in the viewer above the dialog.
- Not the folder picker of New project / New tab (`DirectoryBrowser`, one folder at a time, "Use this folder"); that keeps its flat list.

## Anatomy
- Dialog: `.modal.files-dialog.is-tree` (640px; full height up to `640px`), one `.dir-browser.dir-browser-tree[role=group]` in the body.
- Bar: `.dir-browser-bar` — Parent folder, Home folder, the path (`.dir-browser-path`, mono, keeps its end), New folder.
- Filter: `.dir-browser-filter[role=search]` — Lucide `Search`, `.input[type=search]` "Filter by name…", and a clear `.icon-button` (×, title "Clear filter (Esc)") only while it holds text.
- List: `ul.dir-browser-list[role=tree]`; each row is `li[role=treeitem][aria-level][aria-expanded?][aria-selected?] > button.dir-browser-item.tree-row.is-folder|.is-file` with `.tree-guides` (one `i` per level, a hairline under the parent's chevron), a chevron (`ChevronRight` / `ChevronDown`, `--text-dim`) or an empty `.tree-twist`, a Lucide icon (`Folder` / `FolderOpen`; files by type: `FileText`, `FileCode`, `FileBraces`, `Image`, `FileType`, `File`), `.tree-name` (folders `--fw-medium`) and `.dir-browser-size` for a file. Folders come before files.
- Selected row (`.is-selected`): `--bg-hover` and an `--accent` rail of `--rail-w`. Keyboard cursor (`:focus-visible` / `.is-active`): a 2px `--accent` ring inside the row.
- Notes take a folder's children place: `.tree-note` with the loading spinner (`LoaderCircle`, `--accent`, stepped, still under reduced motion), "Folders could not be loaded.", "Nothing here", and "More items than shown — refine the filter" when the server cut the listing at 500 entries.
- Footer: "Show hidden" and `.dir-browser-hints` (`.kbd`: ↑↓ move, → expand, ← collapse, Enter open, Esc close; hidden up to `640px`).

## Filter
- Matches the names in the folders already read and, through the pane's file search (`GET /api/pane/files`, up to 100 paths), the git files below the pane's folder. Only matches and their folders show, all open; a folder that only leads to one other folder folds into it (`a/b/c`, the leading part in `.tree-sep`, `--text-dim`). The matched part is `mark.dir-browser-hit` (bold on `--accent-tint`, never colour alone).
- `.dir-browser-scope[role=note]` above the footer: "Search by name in git files" (or "Searching only the open folders" when the tree is rooted somewhere else than the pane's folder, where the search does not apply).
- Nothing matched: `.dir-browser-empty[role=status]` with `SearchX`, "Nothing found for “…”" and where it looked. A folder row that matched with nothing under it opens that folder in the tree and clears the filter.
- Esc clears the filter and keeps focus on the field; a second Esc closes the dialog.

## Keyboard (WAI-ARIA tree)
↑ ↓ move, Home / End jump, → opens a closed folder or steps into an open one, ← closes an open folder or steps out to its parent, Enter / Space open the file or toggle the folder. One row is tabbable (`tabindex=0`), the rest `-1`; ↓ in the filter field enters the tree. While filtering, folders stay open.

## Viewer formats
- `.md` / `.markdown`: `.file-viewer-toolbar` with `.segmented` "View | Code" (`Eye`, `Code`); View is the chat's own `.markdown` on a reading card (`.file-viewer-render`, max 820px). Code is the text with the Edit button at the right of the same bar; Edit exists only in Code, and View is disabled while editing.
- `.html` / `.htm`: the same bar, and in View a `iframe.file-viewer-html[sandbox=""]` drawn from the text (`srcdoc`; white like the PDF frame) with `.file-viewer-sandbox` "Scripts are off in this view" (`ShieldOff`). No scripts, no forms, no popups, no access to the app. Relative images and links of the file may not load.
- The choice is remembered per format (View by default). A large file draws only the part already read, with the existing "Showing the first N of M." note. Links in rendered markdown open in a new tab with `rel="noopener noreferrer"` and only for http, https and mailto; raw html in markdown shows as text.
- Everything drawn from a file is `data-feedback-private`; the tree shows names only.

## States & variants
- Opening: `aria-busy` on the group and a "Loading…" row; failed: `.dir-browser-error[role=alert]`.
- Open folders are remembered per PC and per pane folder (`localStorage`, best effort). A remembered folder that no longer exists shows its error row and can be toggled to retry.
- Phone (`<=640px`): full height, `--tree-indent` 12px, rows at `--touch-target` on a coarse pointer, hints hidden.

## What the consumer provides
- `start` (the pane's folder), `paneId` (for the search), `onOpenFile`. Strings through `t()`.

## Tokens used
`--accent`, `--accent-tint`, `--bg`, `--bg-elevated`, `--bg-hover`, `--border`, `--hairline`, `--rail-w`, `--text`, `--text-dim`, `--text-strong`, `--control-h`, `--touch-target`, `--radius-md`, `--radius-sm`, `--fs-2xs`, `--fs-xs`, `--fs-sm`, `--fw-medium`, `--fw-semibold`, `--space-1` … `--space-6`; the component-local `--tree-indent` (16px; 12px on a phone) and `--tree-row-h` (`--control-h` minus `--space-1`).

## Do & Don't
- Do keep the selected row's rail and the keyboard ring distinct: one says what is open, the other where the cursor is.
- Do say what the search covers; it is by name, in git's files, not by content.
- Don't add scripts or `allow-*` to the html frame.
- Don't virtualize: a folder lists at most 500 entries.

Source: src/components/FileTree.tsx · FileTree.css · FilesDialog.tsx · FileViewer.tsx · HtmlFrame.tsx · FileViewer.css · src/lib/fileTree.ts · src/lib/fileFormats.ts
Preview: static rendition (markup + the repo's CSS), not the live React component.
