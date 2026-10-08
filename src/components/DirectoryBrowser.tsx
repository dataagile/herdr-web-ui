import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, FileText, Folder, FolderPlus, House } from "lucide-react";

import "./DirectoryBrowser.css";

import type { DirectoryListing } from "../../shared/protocol.ts";
import { ApiError } from "../lib/api.ts";
import { formatBytes } from "../lib/bridgeProgress.ts";
import { useMachineApi } from "../lib/machineContext.tsx";
import { useT } from "../lib/i18n.ts";

export interface DirectoryBrowserProps {
  /** where to open: the path typed so far (absolute, `~` or `~/…`); empty or unreadable opens home */
  start: string;
  /** the folder chosen, in the dialog's own syntax (`~/…` inside home); without it there is no "Use this folder" */
  onPick?: (path: string) => void;
  /** lists files too, and opens the one clicked (its absolute path) */
  onOpenFile?: (path: string) => void;
}

/** `~/…` for a path inside home, as the directory field is usually typed. */
export function homeRelative(path: string, home: string): string {
  if (path === home) return "~";
  return path.startsWith(`${home}/`) ? `~/${path.slice(home.length + 1)}` : path;
}

function childPath(parent: string, name: string): string {
  return parent.endsWith("/") ? `${parent}${name}` : `${parent}/${name}`;
}

/**
 * Keys of a text field inside a dialog. Enter confirms an IME candidate and Escape dismisses it:
 * neither is the field's, and neither may reach the dialog's own Escape, which closes it. Enter
 * never submits a form; Escape is the field's only when `escape` handles it (returns true), and
 * then it stops here. Otherwise it goes on to close the dialog.
 */
export function fieldKeys(event: KeyboardEvent<HTMLInputElement>, on: { enter?: () => void; escape: () => boolean }): void {
  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
    event.stopPropagation();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    on.enter?.();
  }
  if (event.key === "Escape" && on.escape()) {
    event.preventDefault();
    event.stopPropagation();
  }
}

/**
 * A folder browser for the new-session dialog: one directory at a time, fetched from the
 * PC the session starts on. Nothing is kept but the folder shown now.
 */
export function DirectoryBrowser({ start, onPick, onOpenFile }: DirectoryBrowserProps) {
  const t = useT();
  const { fetchDirectories, createDirectory } = useMachineApi();
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const request = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);

  const open = useCallback(async (path: string, showHidden: boolean, fallbackHome: boolean) => {
    const id = ++request.current;
    setLoading(true);
    try {
      const next = await fetchDirectories(path, showHidden, onOpenFile !== undefined);
      if (id !== request.current) return;
      if (listing !== null && next.path !== listing.path) setQuery("");
      setListing(next);
      setError(null);
      listRef.current?.scrollTo({ top: 0 });
    } catch (reason: unknown) {
      if (id !== request.current) return;
      // a path typed half-way opens home instead of an error
      if (fallbackHome && reason instanceof ApiError && reason.code === "invalid_cwd") return void open("", showHidden, false);
      setError(reason instanceof ApiError && reason.status === 404
        ? t("This PC's bridge cannot browse folders yet. Type the path instead.")
        : reason instanceof ApiError && reason.code === "invalid_cwd" ? t("This folder cannot be opened.") : t("Folders could not be loaded."));
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [fetchDirectories, listing, onOpenFile, t]);

  useEffect(() => { void open(start, false, true); }, []);

  const create = async (): Promise<void> => {
    const name = newName.trim();
    if (name === "" || busy || listing === null) return;
    setBusy(true);
    setCreateError(null);
    try {
      const made = await createDirectory(listing.path, name);
      setCreating(false);
      setNewName("");
      // step into the folder just made, so the next pick starts there
      await open(made, hidden, false);
    } catch (reason: unknown) {
      setCreateError(reason instanceof ApiError && reason.code === "exists" ? t("A folder with that name already exists.")
        : reason instanceof ApiError && reason.code === "invalid_name" ? t("That name cannot be used.")
        : t("The folder could not be created."));
    } finally {
      setBusy(false);
    }
  };

  const path = listing?.path ?? "";
  const shown = listing ? homeRelative(listing.path, listing.home) : start || "~";
  const normalizedQuery = query.trim().toLowerCase();
  const directories = listing === null || onPick === undefined || normalizedQuery === ""
    ? listing?.directories
    : listing.directories.filter((name) => name.toLowerCase().includes(normalizedQuery));

  return (
    <div className="dir-browser" role="group" aria-label={t("Choose a folder")} aria-busy={loading}>
      <div className="dir-browser-bar">
        <button type="button" className="icon-button" aria-label={t("Parent folder")} title={t("Parent folder")} disabled={!listing?.parent || loading} onClick={() => listing?.parent && void open(listing.parent, hidden, false)}>
          <ArrowUp aria-hidden="true" />
        </button>
        <button type="button" className="icon-button" aria-label={t("Home folder")} title={t("Home folder")} disabled={loading || (listing !== null && listing.path === listing.home)} onClick={() => void open("", hidden, false)}>
          <House aria-hidden="true" />
        </button>
        <span className="dir-browser-path" title={path}><span dir="ltr">{shown}</span></span>
        <button type="button" className="icon-button" aria-label={t("New folder")} title={t("New folder")} disabled={loading || listing === null} onClick={() => { setCreating((open) => !open); setCreateError(null); }}>
          <FolderPlus aria-hidden="true" />
        </button>
      </div>
      {creating && (
        <div className="dir-browser-new">
          <div className="dir-browser-new-row">
            <input
              className="input"
              aria-label={t("Folder name")}
              placeholder={t("Folder name")}
              autoFocus
              value={newName}
              disabled={busy}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => fieldKeys(event, {
                enter: () => void create(),
                escape: () => { setCreating(false); setNewName(""); setCreateError(null); return true; },
              })}
            />
            <button type="button" className="btn btn-primary" disabled={busy || newName.trim() === ""} onClick={() => void create()}>{t("Create")}</button>
          </div>
          {createError !== null && <p className="dir-browser-error dir-browser-new-error" role="alert">{createError}</p>}
        </div>
      )}
      {onPick !== undefined && (
        <label className="field dir-browser-search">
          <span className="field-label">{t("Filter folders")}</span>
          {/* a touch screen would raise its keyboard over the list just opened; Escape clears the
              filter before it reaches the dialog's own Escape, which closes the dialog */}
          <input type="search" className="input" value={query} autoFocus={window.matchMedia?.("(pointer: coarse)").matches !== true}
            autoComplete="off" spellCheck={false}
            onChange={(event) => { setQuery(event.target.value); listRef.current?.scrollTo({ top: 0 }); }}
            onKeyDown={(event) => fieldKeys(event, {
              escape: () => {
                if (query === "") return false;
                setQuery("");
                return true;
              },
            })} />
        </label>
      )}
      {error !== null ? <p className="dir-browser-note dir-browser-error" role="alert">{error}</p> : (
        <ul className="dir-browser-list" ref={listRef}>
          {listing === null && <li className="dir-browser-note" role="status">{t("Loading…")}</li>}
          {directories?.map((name) => (
            <li key={name}>
              <button type="button" className="dir-browser-item" disabled={loading} onClick={() => void open(childPath(path, name), hidden, false)}>
                <Folder aria-hidden="true" />
                <span>{name}</span>
              </button>
            </li>
          ))}
          {onOpenFile !== undefined && listing?.files?.map((file) => (
            <li key={`file:${file.name}`}>
              <button type="button" className="dir-browser-item is-file" disabled={loading} onClick={() => onOpenFile(childPath(path, file.name))}>
                <FileText aria-hidden="true" />
                <span>{file.name}</span>
                <span className="dir-browser-size">{formatBytes(file.size)}</span>
              </button>
            </li>
          ))}
          {listing !== null && onPick !== undefined && normalizedQuery !== "" && directories?.length === 0 && <li className="dir-browser-note" role="status">{t("No matching folders")}</li>}
          {listing !== null && normalizedQuery === "" && listing.directories.length === 0 && (listing.files ?? []).length === 0 && <li className="dir-browser-note">{t(onOpenFile ? "Nothing here" : "No folders here")}</li>}
          {listing?.truncated && <li className="dir-browser-note">{t("Showing the first {n} folders; type the rest of the path to go further.", { n: listing.directories.length })}</li>}
          {listing?.truncated && onPick !== undefined && <li className="dir-browser-note">{t("Search is limited to the {n} loaded folders.", { n: listing.directories.length })}</li>}
        </ul>
      )}
      <div className="dir-browser-footer">
        <label className="dir-browser-hidden">
          <input type="checkbox" checked={hidden} disabled={loading && listing === null} onChange={(event) => { setHidden(event.target.checked); if (listing) void open(listing.path, event.target.checked, false); }} />
          {t("Show hidden")}
        </label>
        {onPick && <button type="button" className="btn btn-primary" disabled={listing === null || loading} onClick={() => listing && onPick(homeRelative(listing.path, listing.home))}>
          {t("Use this folder")}
        </button>}
      </div>
    </div>
  );
}
