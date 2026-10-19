The Files dialog's tree (`FileTree`), its filter, and the file viewer's drawn formats (markdown Preview, html Page, source with Edit).

## When to use
- Browsing the pane's folder from the header's Files button: folders open in place, a file opens in the viewer above the dialog.
- Not the folder picker of New project / New tab (`DirectoryBrowser`, one folder at a time, "Use this folder"); that keeps its flat list.

## Anatomy
- Dialog: `.modal.files-dialog.is-tree` (`--palette-w`; full height up to `640px`), one `.dir-browser.dir-browser-tree[role=group]` in the body.
- Bar: `.dir-browser-bar` — Parent folder, Home folder, the path (`.dir-browser-path`, mono, keeps its end), New folder.
- Filter: `.dir-browser-filter[role=search]` — Lucide `Search`, `.input[type=search]` "Filter by name…", and a clear `.icon-button` (×, title "Clear filter (Esc)") only while it holds text.
- List: `ul.dir-browser-list[role=tree]`; each row is `li[role=none] > div[role=treeitem][tabindex][aria-level][aria-setsize][aria-posinset][aria-expanded?][aria-selected].dir-browser-item.tree-row.is-folder|.is-file` (the treeitem is the focusable element; an open folder's children are a `ul[role=group].tree-group` after it, inside the same `li`) with `.tree-guides` (one `i` per level, a hairline under the parent's chevron), a chevron (`ChevronRight` / `ChevronDown`, `--text-dim`) or an empty `.tree-twist`, a Lucide icon (`Folder` / `FolderOpen`; files by type: `FileText`, `FileCode`, `FileBraces`, `Image`, `FileType`, `File`), `.tree-name` (folders `--fw-medium`) and `.dir-browser-size` for a file. Folders come before files.
- Selected row (`.is-selected`): `--bg-hover` and an `--accent` rail of `--rail-w`. Keyboard cursor (`:focus-visible` / `.is-active`): a 2px `--accent` ring inside the row.
- Notes take a folder's children place: `.tree-note` with the loading spinner (`LoaderCircle`, `--accent`, stepped, still under reduced motion), "Folders could not be loaded.", "Nothing here", and "More items than shown — refine the filter" when the server cut the listing at 500 entries.
- Footer: "Show hidden" and `.dir-browser-hints` (`.kbd`: ↑↓ move, → expand, ← collapse, Enter open, Esc close; hidden up to `640px`).

## Filter
- Matches the names in the folders already read and, through the pane's file search (`GET /api/pane/files`, up to 100 paths), the git files below the pane's folder. Only files whose own name holds the query show (the server's search is fuzzy over the whole path), with their folders, all open; a folder that only leads to one other folder folds into it (`a/b/c`, the leading part in `.tree-sep`, `--text-dim`). The matched part is `mark.dir-browser-hit` (bold on `--accent-tint`, never colour alone).
- `.dir-browser-scope[role=note]` above the footer: "Search by name in git files" (or "Searching only the open folders" when the tree is rooted somewhere else than the pane's folder, where the search does not apply).
- Nothing matched: `.dir-browser-empty[role=status]` with `SearchX`, "Nothing found for “…”" and where it looked. A folder row that matched with nothing under it opens that folder in the tree and clears the filter.
- Esc clears the filter and keeps focus on the field; a second Esc closes the dialog.

## Keyboard (WAI-ARIA tree)
↑ ↓ move, Home / End jump, → opens a closed folder or steps into an open one, ← closes an open folder or steps out to its parent, Enter / Space open the file or toggle the folder (also while filtering, where it folds or unfolds the folder inside the result). One row is tabbable (`tabindex=0`), the rest `-1`; ↓ in the filter field enters the tree. While filtering, folders start open; a click or Enter on one folds it (and opens it again).

## Viewer formats
- A file opens in `.file-viewer` (a dialog above the Files dialog, or the docked `.file-panel` beside the pane; the header's panel button switches between them). The dialog's header is `.file-viewer-header-stacked` (name, `.file-viewer-meta` with the size and folder, `.file-viewer-actions`, Close); the docked panel's is one row (`.file-viewer-header-docked`) with the meta and the view modes in `.file-viewer-toolbar` under it. A partial view says so in `.file-viewer-notice` (`--notice`, a warning icon and "256 KB of 1.3 MB").
- `.md` / `.markdown`: Preview is the default (the chat's own `.markdown` on a reading card, `.file-viewer-markdown`, as wide as the chat lane). In a dialog the header's Show source toggle (`Braces`, `aria-pressed`) swaps to the source; docked, the toolbar's `.segmented.file-viewer-modes` reads "Preview | Source".
- `.html` / `.htm`: `.segmented.file-viewer-modes` "Page | Source" over the body. Page is `iframe.file-viewer-page[sandbox="allow-scripts"]` drawn by the server with no origin and no network; Source is the highlighted text.
- Source is the one view that can be edited (the Data Agile fork's addition): `.file-viewer-editbar` with the **Edit** button (`Pencil`; disabled while the file is read in full, and over the size limit, where a note says to download it). Editing swaps the bar to "Unsaved changes" (`.file-viewer-editstate`), **Discard** and **Save**, over `textarea.file-viewer-editor`. A Preview or a Page shows what the file draws and has no Edit.
- Header actions after the view toggle: Open in a new tab, Open raw file (Preview and Page), Download, Copy, and a **More** menu (`.file-viewer-more-menu`) that holds the link actions on a phone. Long text is a virtualized source (`VirtualSource`). Links in a rendered markdown open in a new tab with `rel="noopener noreferrer"`, only for http, https and mailto; raw html in markdown shows as text. A changed file adds `.changed-tabs` ("Changes in this session | File"), see `components/ChangedFiles`.
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
- Don't add `allow-same-origin` (or anything beyond `allow-scripts`) to the html frame: its page has no origin and no network on purpose.
- Don't virtualize: a folder lists at most 500 entries.

Source: src/components/FileTree.tsx · FileTree.css · FilesDialog.tsx · FileViewer.tsx · FileViewer.css · FilePanelResizer.tsx · TextFileView.tsx · src/lib/fileTree.ts · src/lib/fileFormats.ts
Preview: static rendition (markup + the repo's CSS), not the live React component.
