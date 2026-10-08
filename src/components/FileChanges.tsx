import { useEffect, useState } from "react";

import "./ChangedFiles.css";
import { EditDiff, EditScript, formatTime, PatchLines } from "./diffLines.tsx";
import type { ChangeBody } from "../../shared/file-changes.ts";
import type { ChangedFileDiff } from "../../shared/protocol.ts";
import { formatBytes } from "../lib/bridgeProgress.ts";
import { useT } from "../lib/i18n.ts";
import { useMachineApi } from "../lib/machineContext.tsx";

/** One change as the chat draws the call that made it. */
function ChangeView({ body }: { body: ChangeBody }) {
  switch (body.kind) {
    case "replace": return <div className="chat-tool-io is-whole">{body.edits.map((edit, index) => <EditDiff key={index} before={edit.before} after={edit.after} />)}</div>;
    case "write": return <div className="chat-tool-io is-whole"><EditDiff before="" after={body.content} /></div>;
    case "patch": return <div className="chat-tool-io is-whole"><PatchLines lines={body.lines} /></div>;
    case "script": return <EditScript script={body.script} className="chat-tool-io is-whole chat-diff" />;
    default: return <pre className="chat-tool-io is-whole">{body.text}</pre>;
  }
}

/** git's unified diff: the lines before the first hunk are its headers (the `---` / `+++` names are not changes), the hunks are drawn as a patch's are. */
function GitDiff({ diff }: { diff: string }) {
  const lines = diff.replace(/\n$/, "").split("\n");
  const hunk = lines.findIndex((line) => line.startsWith("@@"));
  const head = hunk === -1 ? lines : lines.slice(0, hunk);
  return <div className="chat-tool-io is-whole">
    <pre className="chat-diff">{head.map((line, index) => <span key={index} className="chat-diff-head">{line}{"\n"}</span>)}</pre>
    {hunk !== -1 && <PatchLines lines={lines.slice(hunk)} />}
  </div>;
}

/** A file's changes: each edit of the session in order, or git's diff for a file the session did not edit. */
export function FileChanges({ paneId, path }: { paneId: string; path: string }) {
  const t = useT();
  const { fetchChangedFileDiff } = useMachineApi();
  const [diff, setDiff] = useState<ChangedFileDiff | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setDiff(null); setFailed(false);
    fetchChangedFileDiff(paneId, path).then((next) => { if (!cancelled) setDiff(next); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [paneId, path, fetchChangedFileDiff]);

  if (failed) return <p className="file-viewer-note" role="alert">{t("The changes could not be loaded.")}</p>;
  if (diff === null) return <p className="file-viewer-note">{t("Loading…")}</p>;
  if (diff.kind === "git") {
    return <div className="changed-edits">
      {diff.diff.length === 0 ? <p className="file-viewer-note">{t("Git shows no difference for this file.")}</p>
        : <GitDiff diff={diff.diff} />}
      {diff.truncated && <p className="file-viewer-note">{t("Showing the first {shown} of the diff.", { shown: formatBytes(diff.diff.length) })}</p>}
    </div>;
  }
  return <div className="changed-edits">{diff.edits.map((edit, index) => {
    const time = formatTime(edit.at);
    const head = t("Edit {n} of {total}", { n: index + 1, total: diff.edits.length });
    return <section key={index} className="changed-edit" aria-label={head}>
      <p className="changed-edit-head"><strong>{head}</strong>{time !== null && <><span>·</span><time dateTime={edit.at ?? undefined}>{time}</time></>}</p>
      <ChangeView body={edit.body} />
    </section>;
  })}</div>;
}
