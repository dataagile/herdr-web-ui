/**
 * A project's History: the Claude Code sessions that ran in its folder (or a worktree of it),
 * read from the PC's own transcripts. A session open in some pane is marked and offers Go to tab;
 * any other can be resumed in a new tab of the project, or its command copied. The range and the
 * "automated" box are remembered per browser.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import "./HistoryView.css";

import type { HistorySession } from "../../shared/protocol.ts";
import type { PaneInfo, WorkspaceInfo } from "../../shared/herdr-api.generated.ts";
import { rememberedAgentArgs } from "../lib/agentArgs.ts";
import { copyText } from "../lib/clipboard.ts";
import { groupByDay, HISTORY_RANGES, matchingSessions, openPaneOf, resumeArgs, resumeCommand, resumeCommandIn, sinceFor, type HistoryRange } from "../lib/history.ts";
import { useLocale, useT } from "../lib/i18n.ts";
import { useMachineApi } from "../lib/machineContext.tsx";

const RANGE_KEY = "herdr-web-ui:history-range";
const AUTOMATED_KEY = "herdr-web-ui:history-automated";

function storedRange(): HistoryRange {
  try {
    const stored = window.localStorage.getItem(RANGE_KEY);
    if (stored === "today" || stored === "7d" || stored === "30d") return stored;
  } catch { /* private mode: the default */ }
  return "today";
}

function storedAutomated(): boolean {
  try { return window.localStorage.getItem(AUTOMATED_KEY) === "1"; } catch { return false; }
}

function remember(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* private mode: not remembered */ }
}

interface Props {
  /** history is read from the PC this app runs on; a remote bridge has no such endpoint */
  local: boolean;
  workspace: WorkspaceInfo;
  /** the project's folder and its worktrees', as the project was when History opened: a pane's `cd` does not move it */
  folders: readonly string[];
  /** the PC's panes, to tell which sessions are open */
  panes: readonly PaneInfo[];
  onGoTo: (paneId: string) => void;
  /** a tab was made for a resumed session */
  onOpened: (paneId: string) => void;
}

export function HistoryView({ local, workspace, folders: openedFolders, panes, onGoTo, onOpened }: Props) {
  const t = useT();
  const { fetchWorkspaceHistory } = useMachineApi();
  const [folders] = useState(openedFolders);
  const locale = useLocale();
  const [range, setRange] = useState(storedRange);
  const [automated, setAutomated] = useState(storedAutomated);
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resuming, setResuming] = useState<HistorySession | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const request = useRef(0);
  const root = useRef<HTMLDivElement>(null);

  // the terminal under this view may hold the keyboard focus: nothing typed here may reach it
  useEffect(() => { root.current?.focus({ preventScroll: true }); }, []);

  const load = useCallback((offset: number) => {
    if (!local || folders.length === 0) return;
    const mine = ++request.current;
    const stamp = Date.now();
    setLoading(true);
    setError(null);
    fetchWorkspaceHistory({ folders, since: sinceFor(range, stamp), automated, offset })
      .then((page) => {
        if (mine !== request.current) return;
        setNow(stamp);
        // a session written to since the first page moves up, so a later page can repeat one
        setSessions((current) => offset === 0 ? page.sessions : [...current, ...page.sessions.filter((next) => !current.some((known) => known.session_id === next.session_id))]);
        setHasMore(page.has_more);
      })
      .catch((reason: unknown) => { if (mine === request.current) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (mine === request.current) setLoading(false); });
  }, [local, folders, range, automated, fetchWorkspaceHistory]);

  useEffect(() => { setSessions([]); setHasMore(false); load(0); }, [load]);

  const shown = matchingSessions(sessions, query);
  const groups = groupByDay(shown, now);
  const dayLabel = (group: ReturnType<typeof groupByDay>[number]): string => group.kind === "today" ? t("Today")
    : group.kind === "yesterday" ? t("Yesterday")
    : group.date.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" });
  const timeOf = (session: HistorySession): string => new Date(session.last_activity).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const titleOf = (session: HistorySession): string => session.title || t("Untitled session");

  const copyCommand = async (session: HistorySession): Promise<void> => {
    if (await copyText(resumeCommandIn(session.cwd, session.session_id, rememberedAgentArgs("claude")))) {
      setCopied(session.session_id);
      window.setTimeout(() => setCopied((current) => current === session.session_id ? null : current), 1500);
    }
  };

  if (!local) return <div ref={root} className="history-view" tabIndex={-1}><p className="history-state" role="status">{t("History is not available for this PC")}</p></div>;

  return (
    <div ref={root} className="history-view" tabIndex={-1}>
      <div className="history-bar">
        <div className="history-ranges" role="group" aria-label={t("History range")}>
          {HISTORY_RANGES.map((value) => (
            <button key={value} type="button" className="history-chip" aria-pressed={range === value} onClick={() => { setRange(value); remember(RANGE_KEY, value); }}>
              {t(value === "today" ? "Today" : value === "7d" ? "7 days" : "30 days")}
            </button>
          ))}
        </div>
        <input className="input history-search" type="search" value={query} placeholder={t("Search title or first prompt…")} aria-label={t("Search title or first prompt…")} autoComplete="off" spellCheck={false} onChange={(event) => setQuery(event.target.value)} />
        <label className="history-check">
          <input type="checkbox" checked={automated} onChange={(event) => { setAutomated(event.target.checked); remember(AUTOMATED_KEY, event.target.checked ? "1" : "0"); }} />
          {t("Show automated (claude -p)")}
        </label>
      </div>
      {folders[0] !== undefined && <p className="history-folder" title={folders.join("\n")}>{folders[0]}{folders.length > 1 && ` +${folders.length - 1}`}</p>}

      {folders.length === 0 && <p className="history-state" role="status">{t("This project has no folder to look in")}</p>}
      {error && <p className="history-state history-error" role="status">{error} <button type="button" className="btn btn-ghost" onClick={() => load(0)}>{t("Retry")}</button></p>}
      {folders.length > 0 && !error && sessions.length === 0 && (
        <p className="history-state" role="status">{loading ? t("Loading history…") : t("No sessions in this range")}</p>
      )}
      {sessions.length > 0 && shown.length === 0 && <p className="history-state" role="status">{t(hasMore ? "No match in the loaded sessions. Show more to search further." : "No sessions match")}</p>}

      {groups.map((group) => (
        <section key={group.key} className="history-day" aria-label={dayLabel(group)}>
          <h3 className="history-day-title">{dayLabel(group)} · {t(group.sessions.length === 1 ? "1 session" : "{n} sessions", { n: group.sessions.length })}</h3>
          <ul className="history-list">
            {group.sessions.map((session) => {
              const openPane = openPaneOf(session.session_id, panes);
              return (
                <li key={session.session_id} className="history-row">
                  <div className="history-main">
                    <div className="history-title">
                      <span className="history-title-text">{titleOf(session)}</span>
                      {openPane !== null && <span className="history-open">{t("OPEN NOW")}</span>}
                      {session.automated && <span className="pill">claude -p</span>}
                    </div>
                    {session.first_prompt !== "" && session.first_prompt !== session.title && <p className="history-prompt">{session.first_prompt}</p>}
                    <p className="history-meta">
                      <span>{timeOf(session)}</span>
                      {session.prompt_count !== null && <span>{t("{n} prompts", { n: session.prompt_count })}</span>}
                      {session.git_branch && <span className="history-branch">{session.git_branch}</span>}
                      {session.model && <span>{session.model}</span>}
                    </p>
                  </div>
                  <div className="history-actions">
                    {openPane !== null
                      ? <button type="button" className="btn" onClick={() => onGoTo(openPane)}>{t("Go to tab")}</button>
                      : <>
                        <button type="button" className="btn btn-ghost" onClick={() => void copyCommand(session)}>{t(copied === session.session_id ? "Copied" : "Copy command")}</button>
                        <button type="button" className="btn btn-primary" onClick={() => setResuming(session)}>{t("Resume")}</button>
                      </>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {hasMore && <div className="history-more"><button type="button" className="btn" disabled={loading} onClick={() => load(sessions.length)}>{t(loading ? "Loading…" : "Show more")}</button></div>}

      {resuming && (
        <ResumeDialog
          session={resuming}
          title={titleOf(resuming)}
          when={new Date(resuming.last_activity).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}
          workspaceId={workspace.workspace_id}
          onClose={() => setResuming(null)}
          onOpened={(paneId) => { setResuming(null); onOpened(paneId); }}
        />
      )}
    </div>
  );
}

function ResumeDialog({ session, title, when, workspaceId, onClose, onOpened }: { session: HistorySession; title: string; when: string; workspaceId: string; onClose: () => void; onOpened: (paneId: string) => void }) {
  const t = useT();
  const { createTab } = useMachineApi();
  const saved = useRef(rememberedAgentArgs("claude")).current;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPaneId, setCreatedPaneId] = useState<string | null>(null);
  const confirm = useRef<HTMLButtonElement>(null);

  useEffect(() => { window.requestAnimationFrame(() => confirm.current?.focus()); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (!pending) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, pending]);

  const open = async (): Promise<void> => {
    if (createdPaneId !== null) { onOpened(createdPaneId); return; }
    setPending(true);
    setError(null);
    try {
      // the agent launch is the New tab dialog's: the arguments saved for claude go after --resume
      const result = await createTab({ workspace_id: workspaceId, cwd: session.cwd, label: null, agent: { kind: "claude", args: resumeArgs(session.session_id, saved) } });
      setPending(false);
      if (!result.agent_started && result.error?.message) { setError(result.error.message); setCreatedPaneId(result.pane_id); return; }
      onOpened(result.pane_id);
    } catch (reason: unknown) {
      setPending(false);
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <div className="modal history-resume" role="dialog" aria-modal="true" aria-labelledby="history-resume-title">
        <header className="modal-header">
          <h2 className="modal-title" id="history-resume-title">{t("Resume “{title}”", { title })}</h2>
          <button type="button" className="icon-button" aria-label={t("Close dialog")} disabled={pending} onClick={onClose}><X aria-hidden="true" /></button>
        </header>
        <div className="modal-body">
          <p className="history-resume-when">{t("Last activity {when}", { when })}{session.prompt_count !== null && ` · ${t("{n} prompts", { n: session.prompt_count })}`}</p>
          <div className="field">
            <span className="field-label">{t("Folder")}</span>
            <code className="history-code">{session.cwd}</code>
          </div>
          <div className="field">
            <span className="field-label">{t("Command")}</span>
            <code className="history-code">{resumeCommand(session.session_id, saved)}</code>
          </div>
          {pending && <p className="field-hint" role="status">{t("Starting claude… up to 60s")}</p>}
          {error && <p className="field-hint history-error" role="status">{error}</p>}
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={onClose}>{t("Cancel")}</button>
          <button ref={confirm} type="button" className="btn btn-primary" disabled={pending} onClick={() => void open()}>{t(pending ? "Starting…" : createdPaneId !== null ? "Open" : "Open in new tab")}</button>
        </footer>
      </div>
    </div>
  );
}
