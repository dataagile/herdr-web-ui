import { useEffect } from "react";
import { FileText, X } from "lucide-react";

import "./ChangedFiles.css";
import { formatTime } from "./diffLines.tsx";
import type { ChangedFile, ChangedFilesResponse, SessionChangedFile } from "../../shared/protocol.ts";
import { useT } from "../lib/i18n.ts";

export interface ChangedFilesDialogProps {
  files: ChangedFilesResponse | null;
  /** a file is open above this dialog: Escape belongs to the viewer, which closes first */
  viewing: boolean;
  onOpenFile: (path: string) => void;
  onClose: () => void;
}

/** git's letter for a file and what it says; `?` (not tracked yet) reads as an addition. */
function GitLetter({ status }: { status: NonNullable<ChangedFile["git"]> }) {
  const t = useT();
  const title = status === "M" ? t("Git: modified") : status === "A" ? t("Git: added") : status === "D" ? t("Git: deleted")
    : status === "R" ? t("Git: renamed") : t("Git: not tracked yet");
  return <span className={`changed-git${status === "A" || status === "?" ? " is-add" : status === "D" ? " is-del" : ""}`} title={title}>{status}</span>;
}

function Row({ file, onOpenFile }: { file: ChangedFile | SessionChangedFile; onOpenFile: (path: string) => void }) {
  const t = useT();
  const slash = file.rel.lastIndexOf("/");
  const session = "edits" in file ? file : null;
  const time = session === null ? null : formatTime(session.last_at);
  return <li>
    <button type="button" className="dir-browser-item is-file changed-row" title={t("Open {path}", { path: file.rel })} onClick={() => onOpenFile(file.path)}>
      <FileText aria-hidden="true" />
      <span className="changed-main">
        <span className="changed-path"><span className="changed-dir">{file.rel.slice(0, slash + 1)}</span><strong>{file.rel.slice(slash + 1)}</strong></span>
        {session !== null && <span className="changed-meta">
          <span className="pill">{session.created ? t("created") : t("edited ×{n}", { n: session.edits })}</span>
          {session.uncertain === true && <span className="pill" title={t("The script failed; its patch may not have been applied")}>{t("uncertain")}</span>}
          {time !== null && <span className="changed-time">{time}</span>}
        </span>}
      </span>
      {file.git !== undefined && <GitLetter status={file.git} />}
    </button>
  </li>;
}

/**
 * The files the pane's agent changed in this session, and the other changes git sees in its
 * folder (which may not be the agent's). Each opens in the file viewer, on its changes.
 */
export function ChangedFilesDialog({ files, viewing, onOpenFile, onClose }: ChangedFilesDialogProps) {
  const t = useT();
  useEffect(() => {
    if (viewing) return;
    const onKey = (event: KeyboardEvent): void => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, viewing]);
  const session = files?.session ?? [];
  const other = files?.git ?? [];
  return (
    <div className="modal-scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal files-dialog changed-dialog" role="dialog" aria-modal="true" aria-labelledby="changed-dialog-title">
        <header className="modal-header">
          <h2 className="modal-title" id="changed-dialog-title">{t("Modified files")}</h2>
          <button type="button" className="icon-button" aria-label={t("Close modified files")} onClick={onClose}><X aria-hidden="true" /></button>
        </header>
        <div className="modal-body">
          {files === null && <p className="changed-note">{t("Loading…")}</p>}
          {files !== null && session.length === 0 && other.length === 0 && files.gitTruncated !== true && <p className="changed-note">{t("No modified files")}</p>}
          {files?.sessionTruncated === true && <p className="changed-note">{t("Long session: showing the last {n} parts", { n: files.sessionParts ?? 0 })}</p>}
          {session.length > 0 && <>
            <h3 className="menu-heading changed-heading">{t("In this session")} <span className="pill">{session.length}</span></h3>
            <div className="dir-browser"><ul className="dir-browser-list">{session.map((file) => <Row key={file.path} file={file} onOpenFile={onOpenFile} />)}</ul></div>
          </>}
          {files?.gitTruncated === true && <p className="changed-note">{t("Too many changes in the repository to list")}</p>}
          {other.length > 0 && <>
            <h3 className={`menu-heading changed-heading${session.length > 0 ? " changed-gap" : ""}`}>{t("Other changes in git")} <span className="pill">{other.length}</span></h3>
            <p className="changed-note">{t("May include changes that are not from this agent.")}</p>
            <div className="dir-browser"><ul className="dir-browser-list">{other.map((file) => <Row key={file.path} file={file} onOpenFile={onOpenFile} />)}</ul></div>
          </>}
        </div>
      </section>
    </div>
  );
}
