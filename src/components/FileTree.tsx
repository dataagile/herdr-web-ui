import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowUp, ChevronDown, ChevronRight, File, FileBraces, FileCode, FileText, FileType, Folder, FolderOpen, FolderPlus,
  House, Image as ImageIcon, Info, LoaderCircle, Search, SearchX, X,
} from "lucide-react";

import "./DirectoryBrowser.css";
import "./FileTree.css";
import { fieldKeys, homeRelative } from "./DirectoryBrowser.tsx";

import type { DirectoryListing } from "../../shared/protocol.ts";
import { ApiError } from "../lib/api.ts";
import { formatBytes } from "../lib/bridgeProgress.ts";
import {
  expandedKey, fileIcon, filterEntries, filterRows, foldRows, highlight, nestRows, paneRoot, pendingFolders, readExpanded, treeKey, visibleRows, writeExpanded,
  type DirState, type FileIcon, type TreeNode, type TreeRow,
} from "../lib/fileTree.ts";
import { useMachineApi, useMachineId } from "../lib/machineContext.tsx";
import { useT } from "../lib/i18n.ts";

export interface FileTreeProps {
  /** the pane's folder: where the tree opens (empty or unreadable opens home) */
  start: string;
  /** the pane the folder belongs to: its fuzzy file search finds files in folders not opened yet */
  paneId: string | null;
  onOpenFile: (path: string) => void;
}

const FILE_ICON: Record<FileIcon, typeof File> = { text: FileText, code: FileCode, json: FileBraces, image: ImageIcon, pdf: FileType, file: File };
const SEARCH_DELAY_MS = 200;

/**
 * The pane's folder as a tree: folders open in place and read their children on demand (one listing
 * each), a filter finds a name in the open folders and, through the pane's file search, in the git
 * files below. Keys follow the WAI-ARIA tree pattern.
 */
export function FileTree({ start, paneId, onOpenFile }: FileTreeProps) {
  const t = useT();
  const machineId = useMachineId();
  const api = useMachineApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const storageKey = expandedKey(machineId, start);

  const [rootRequest, setRootRequest] = useState(start);
  const [reload, setReload] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [root, setRoot] = useState<DirectoryListing | null>(null);
  const [loaded, setLoaded] = useState<Record<string, DirState>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => readExpanded(storageKey));
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; paths: string[] } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** folders the user closed inside the filter's result (they all start open) */
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const generation = useRef(0);
  const requested = useRef(new Set<string>());
  const homeRoot = useRef<string | null>(null);
  const items = useRef(new Map<string, HTMLDivElement>());
  const busy = useRef(false);
  const filterInput = useRef<HTMLInputElement>(null);

  useEffect(() => { writeExpanded(storageKey, expanded, root?.path ?? null); }, [storageKey, expanded, root]);
  useEffect(() => { setClosed(new Set()); }, [query]);

  // the root: the pane's folder, then wherever Up / Home lead
  useEffect(() => {
    const mine = ++generation.current;
    requested.current = new Set();
    setLoaded({});
    apiRef.current.fetchDirectories(rootRequest, hidden, true).then((listing) => {
      if (mine !== generation.current) return;
      homeRoot.current = paneRoot(homeRoot.current, rootRequest, start, listing.path);
      setRoot(listing);
      setError(null);
    }).catch((reason: unknown) => {
      if (mine !== generation.current) return;
      // a path typed half-way opens home instead of an error
      if (reason instanceof ApiError && reason.code === "invalid_cwd" && rootRequest !== "") return setRootRequest("");
      setError(reason instanceof ApiError && reason.status === 404
        ? t("This PC's bridge cannot browse folders yet. Type the path instead.")
        : reason instanceof ApiError && reason.code === "invalid_cwd" ? t("This folder cannot be opened.") : t("Folders could not be loaded."));
    });
  }, [rootRequest, hidden, reload]);

  const filtering = query.trim() !== "";
  // the server's search is relative to the pane's folder: it only fits a tree rooted there
  const canSearch = paneId !== null && root !== null && root.path === homeRoot.current;
  const rootEntries = root === null ? null : { directories: root.directories, files: root.files ?? [], truncated: root.truncated };

  const rows = useMemo<TreeRow[]>(() => {
    if (root === null || rootEntries === null) return [];
    if (!filtering) return visibleRows(rootEntries, root.path, loaded, expanded);
    const paths = found !== null && found.query === query.trim() ? found.paths : [];
    return foldRows(filterRows(filterEntries(rootEntries, root.path, loaded, paths, query, hidden), root.path), closed);
  }, [root, loaded, expanded, filtering, query, found, hidden, closed]);
  const nodes = useMemo(() => nestRows(rows), [rows]);

  // an open folder with no answer yet is read now
  const pending = pendingFolders(rows).join("\n");
  useEffect(() => {
    if (pending === "") return;
    const mine = generation.current;
    for (const path of pending.split("\n")) {
      if (requested.current.has(path)) continue;
      requested.current.add(path);
      setLoaded((state) => ({ ...state, [path]: { status: "loading" } }));
      apiRef.current.fetchDirectories(path, hidden, true).then((listing) => {
        if (mine === generation.current) setLoaded((state) => ({ ...state, [path]: { status: "ok", directories: listing.directories, files: listing.files ?? [], truncated: listing.truncated } }));
      }).catch(() => {
        if (mine === generation.current) setLoaded((state) => ({ ...state, [path]: { status: "error" } }));
      });
    }
  }, [pending, hidden]);

  // the filter, in the git files below the root
  useEffect(() => {
    const q = query.trim();
    if (q === "" || !canSearch || paneId === null) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiRef.current.fetchPaneFiles(paneId, q, 100)
        .then((paths) => { if (!cancelled) setFound({ query: q, paths }); })
        .catch(() => { if (!cancelled) setFound({ query: q, paths: [] }); });
    }, SEARCH_DELAY_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, canSearch, paneId]);

  const setOpen = (path: string, open: boolean): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(path); else next.delete(path);
      return next;
    });
    if (open && loaded[path]?.status === "error") {
      requested.current.delete(path);
      setLoaded(({ [path]: _failed, ...rest }) => rest);
    }
  };

  // a folder picked in the filter's result leads back to the tree, open down to it
  const reveal = (path: string): void => {
    if (root === null) return;
    const parts = path.slice(root.path.replace(/\/$/, "").length + 1).split("/");
    setExpanded((current) => {
      const next = new Set(current);
      let at = root.path.replace(/\/$/, "");
      for (const part of parts) next.add(at = `${at}/${part}`);
      return next;
    });
    setQuery("");
  };

  const activate = (row: TreeRow): void => {
    setActive(row.path);
    if (row.type === "file") {
      setSelected(row.path);
      onOpenFile(row.path);
    } else if (!filtering) setOpen(row.path, !row.expanded);
    else if (closed.has(row.path) || row.expanded) {
      // inside the filter a folder with matches under it folds and unfolds in place
      setClosed((current) => {
        const next = new Set(current);
        if (!next.delete(row.path)) next.add(row.path);
        return next;
      });
    } else reveal(row.path);
  };

  const focusRow = (path: string): void => {
    setActive(path);
    items.current.get(path)?.focus();
  };

  const onTreeKey = (event: KeyboardEvent<HTMLUListElement>): void => {
    const path = (event.target as HTMLElement).closest<HTMLElement>("[data-path]")?.dataset.path ?? null;
    if (path === null || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Enter" || event.key === " ") {
      const row = rows.find((candidate) => candidate.type !== "note" && candidate.path === path);
      if (row !== undefined) { event.preventDefault(); activate(row); }
      return;
    }
    const action = treeKey(rows, path, event.key, filtering);
    if (action === null) return;
    event.preventDefault();
    if (action.do === "focus") focusRow(action.path);
    else setOpen(action.path, action.do === "expand");
  };

  // Escape clears the filter first; a second one reaches the dialog and closes it
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Escape" || !filtering || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    setQuery("");
    filterInput.current?.focus();
  };

  const create = async (): Promise<void> => {
    const name = newName.trim();
    if (name === "" || root === null || busy.current) return;
    busy.current = true;
    setSaving(true);
    const mine = generation.current;
    const parent = root.path;
    try {
      await apiRef.current.createDirectory(parent, name);
      setCreating(false);
      setNewName("");
      setCreateError(null);
      // only the folder it was made in is read again; the others stay as they are
      apiRef.current.fetchDirectories(parent, hidden, true).then((listing) => {
        if (mine === generation.current) setRoot(listing);
      }).catch(() => { if (mine === generation.current) setReload((n) => n + 1); });
    } catch (reason: unknown) {
      setCreateError(reason instanceof ApiError && reason.code === "exists" ? t("A folder with that name already exists.")
        : reason instanceof ApiError && reason.code === "invalid_name" ? t("That name cannot be used.")
        : t("The folder could not be created."));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const shown = root ? homeRelative(root.path, root.home) : start || "~";
  const first = rows.find((row) => row.type !== "note")?.path ?? null;
  const cursor = rows.some((row) => row.type !== "note" && row.path === active) ? active : first;
  const settled = !canSearch || (found !== null && found.query === query.trim());
  const name = (row: TreeRow): ReactNode => {
    const hit = highlight(row.name, query);
    return <span className="tree-name">
      {row.sep !== "" && <span className="tree-sep" dir="ltr">{row.sep}</span>}
      {hit === null ? row.name : <>{hit.before}<mark className="dir-browser-hit">{hit.hit}</mark>{hit.after}</>}
    </span>;
  };
  const guides = (level: number): ReactNode => <span className="tree-guides" aria-hidden="true">{Array.from({ length: level }, (_, index) => <i key={index} />)}</span>;

  const renderNode = (node: TreeNode): ReactNode => {
    const { row } = node;
    if (row.type === "note") {
      const text = row.note === "loading" ? t("Loading…") : row.note === "error" ? t("Folders could not be loaded.")
        : row.note === "empty" ? t("Nothing here") : t("More items than shown — refine the filter");
      return (
        <li key={`${row.note}:${row.path}`} role="none">
          <div className="dir-browser-note tree-note" role={row.note === "loading" ? "status" : undefined}>
            {guides(row.level)}<span className="tree-twist" />
            {row.note === "loading" && <LoaderCircle className="tree-spin" aria-hidden="true" />}
            <span>{text}</span>
          </div>
        </li>
      );
    }
    const folder = row.type === "dir";
    const Icon = folder ? (row.expanded ? FolderOpen : Folder) : FILE_ICON[fileIcon(row.name)];
    return (
      <li key={row.path} role="none">
        <div role="treeitem" data-path={row.path} tabIndex={cursor === row.path ? 0 : -1} title={row.path}
          aria-level={row.level + 1} aria-setsize={node.size} aria-posinset={node.pos}
          aria-expanded={folder ? row.expanded : undefined} aria-selected={selected === row.path}
          ref={(element) => { if (element) items.current.set(row.path, element); else items.current.delete(row.path); }}
          className={`dir-browser-item tree-row ${folder ? "is-folder" : "is-file"}${selected === row.path ? " is-selected" : ""}`}
          onClick={() => activate(row)} onFocus={() => setActive(row.path)}>
          {guides(row.level)}
          {folder ? (row.expanded ? <ChevronDown className="tree-chev" aria-hidden="true" /> : <ChevronRight className="tree-chev" aria-hidden="true" />) : <span className="tree-twist" aria-hidden="true" />}
          <Icon aria-hidden="true" />
          {name(row)}
          {row.size !== undefined && <span className="dir-browser-size">{formatBytes(row.size)}</span>}
        </div>
        {node.children.length > 0 && <ul role="group" className="tree-group">{node.children.map(renderNode)}</ul>}
      </li>
    );
  };

  return (
    <div className="dir-browser dir-browser-tree" role="group" aria-label={t("Files of {path}", { path: shown })} aria-busy={root === null && error === null} onKeyDown={onKeyDown}>
      <div className="dir-browser-bar">
        <button type="button" className="icon-button" aria-label={t("Parent folder")} title={t("Parent folder")} disabled={!root?.parent} onClick={() => root?.parent && setRootRequest(root.parent)}>
          <ArrowUp aria-hidden="true" />
        </button>
        <button type="button" className="icon-button" aria-label={t("Home folder")} title={t("Home folder")} disabled={root !== null && root.path === root.home} onClick={() => setRootRequest("")}>
          <House aria-hidden="true" />
        </button>
        <span className="dir-browser-path" title={root?.path ?? ""}><span dir="ltr">{shown}</span></span>
        <button type="button" className="icon-button" aria-label={t("New folder")} title={t("New folder")} disabled={root === null} onClick={() => { setCreating((open) => !open); setCreateError(null); }}>
          <FolderPlus aria-hidden="true" />
        </button>
      </div>
      {creating && (
        <div className="dir-browser-new">
          <div className="dir-browser-new-row">
            <input className="input" aria-label={t("Folder name")} placeholder={t("Folder name")} autoFocus value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => fieldKeys(event, { enter: () => void create(), escape: () => { setCreating(false); setNewName(""); setCreateError(null); return true; } })} />
            <button type="button" className="btn btn-primary" disabled={newName.trim() === "" || saving} onClick={() => void create()}>{t("Create")}</button>
          </div>
          {createError !== null && <p className="dir-browser-error dir-browser-new-error" role="alert">{createError}</p>}
        </div>
      )}
      <div className="dir-browser-filter" role="search">
        <Search aria-hidden="true" />
        {/* a touch screen would raise its keyboard over the tree just opened */}
        <input ref={filterInput} type="search" className="input" value={query} placeholder={t("Filter by name…")} aria-label={t("Filter by name")}
          autoFocus={window.matchMedia?.("(pointer: coarse)").matches !== true} autoComplete="off" spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && first !== null) { event.preventDefault(); focusRow(first); return; }
            fieldKeys(event, { escape: () => false });
          }} />
        {query !== "" && <button type="button" className="icon-button" aria-label={t("Clear filter")} title={t("Clear filter (Esc)")} onClick={() => { setQuery(""); filterInput.current?.focus(); }}><X aria-hidden="true" /></button>}
      </div>
      {error !== null ? <p className="dir-browser-note dir-browser-error" role="alert">{error}</p> : (
        <ul className="dir-browser-list" role="tree" aria-label={t("Folders and files")} onKeyDown={onTreeKey}>
          {root === null && <li className="dir-browser-note" role="status">{t("Loading…")}</li>}
          {nodes.map(renderNode)}
          {root !== null && rows.length === 0 && (filtering
            ? (settled ? (
              <li className="dir-browser-empty" role="status">
                <SearchX aria-hidden="true" />
                <span>{t("Nothing found for “{query}”", { query: query.trim() })}</span>
                {canSearch && <span>{t("Searched in every folder under {path}.", { path: shown })}</span>}
              </li>
            ) : <li className="dir-browser-note" role="status">{t("Loading…")}</li>)
            : <li className="dir-browser-note" role="status">{t("Nothing here")}</li>)}
        </ul>
      )}
      {filtering && (
        <div className="dir-browser-scope" role="note">
          <Info aria-hidden="true" />
          <span>{t(canSearch ? "Search by name in git files" : "Searching only the open folders")}</span>
        </div>
      )}
      <div className="dir-browser-footer">
        <label className="dir-browser-hidden">
          <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
          {t("Show hidden")}
        </label>
        <span className="dir-browser-hints" aria-label={t("Shortcuts")}>
          <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> {t("move")}</span>
          <span><kbd className="kbd">→</kbd> {t("expand")}</span>
          <span><kbd className="kbd">←</kbd> {t("collapse")}</span>
          <span><kbd className="kbd">Enter</kbd> {t("open")}</span>
          <span><kbd className="kbd">Esc</kbd> {t("close")}</span>
        </span>
      </div>
    </div>
  );
}
