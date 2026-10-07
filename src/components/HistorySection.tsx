/**
 * The sidebar's History section for the selected project: the Claude Code sessions that ran in
 * its folder (or a worktree of it), from this PC's transcripts. A row acts at once: a session
 * open in a pane selects that pane, any other opens a new tab of the project that resumes it.
 * The range is remembered per browser; five rows show until "See all" opens the whole list.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Copy } from "lucide-react";

import "./HistorySection.css";

import type { HistorySession } from "../../shared/protocol.ts";
import type { PaneInfo } from "../../shared/herdr-api.generated.ts";
import { rememberedAgentArgs } from "../lib/agentArgs.ts";
import { copyText } from "../lib/clipboard.ts";
import { groupByDay, HISTORY_RANGES, matchingSessions, resumeArgs, resumeCommandIn, rowAction, sinceFor, type HistoryRange } from "../lib/history.ts";
import { useLocale, useT } from "../lib/i18n.ts";
import { useMachineApi } from "../lib/machineContext.tsx";

const RANGE_KEY = "herdr-web-ui:history-range";
const AUTOMATED_KEY = "herdr-web-ui:history-automated";
const COMPACT_ROWS = 5;
const STARTED_MS = 60_000;

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
  workspaceId: string;
  /** the project's folder and its worktrees', as the project was when the section mounted: a pane's `cd` does not move it */
  folders: readonly string[];
  /** the PC's panes, to tell which sessions are open */
  panes: readonly PaneInfo[];
  onSelectPane: (paneId: string) => void;
  /** a tab was made for a resumed session: the roster must be read again before it can be selected */
  onOpened: (paneId: string) => void;
}

export function HistorySection({ workspaceId, folders: openedFolders, panes, onSelectPane, onOpened }: Props) {
  const t = useT();
  const locale = useLocale();
  const { createTab, fetchWorkspaceHistory } = useMachineApi();
  const [folders] = useState(openedFolders);
  const [range, setRange] = useState(storedRange);
  const [automated, setAutomated] = useState(storedAutomated);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [starting, setStarting] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // sessions this view started and herdr may not report yet (cleared after a minute)
  const [started, setStarted] = useState<ReadonlySet<string>>(new Set());
  const request = useRef(0);

  const load = useCallback((offset: number) => {
    if (folders.length === 0) return;
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
  }, [folders, range, automated, fetchWorkspaceHistory]);

  useEffect(() => { setSessions([]); setHasMore(false); load(0); }, [load]);

  const shown = matchingSessions(sessions, query);
  const rows = expanded ? shown : shown.slice(0, COMPACT_ROWS);
  const dayLabel = (kind: "today" | "yesterday" | "date", date: Date): string => kind === "today" ? t("Today")
    : kind === "yesterday" ? t("Yesterday")
    : date.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" });
  const timeOf = (session: HistorySession): string => new Date(session.last_activity).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const act = async (session: HistorySession): Promise<void> => {
    // an open session is forked, never resumed: two processes must not drive one session
    const { fork } = rowAction(session.session_id, panes, started);
    if (starting !== null) return;
    setStarting(session.session_id);
    setRowError(null);
    try {
      // the New tab dialog's launch: the arguments saved for claude go after --resume
      const result = await createTab({ workspace_id: workspaceId, cwd: session.cwd, label: null, agent: { kind: "claude", args: resumeArgs(session.session_id, rememberedAgentArgs("claude"), fork) } });
      if (!result.agent_started && result.error?.message) setRowError({ id: session.session_id, message: result.error.message });
      else {
        const id = session.session_id;
        setStarted((current) => new Set(current).add(id));
        window.setTimeout(() => setStarted((current) => { const next = new Set(current); next.delete(id); return next; }), STARTED_MS);
        onOpened(result.pane_id);
      }
    } catch (reason: unknown) {
      setRowError({ id: session.session_id, message: reason instanceof Error ? reason.message : String(reason) });
    } finally { setStarting(null); }
  };

  const copyCommand = async (session: HistorySession): Promise<void> => {
    if (await copyText(resumeCommandIn(session.cwd, session.session_id, rememberedAgentArgs("claude"), rowAction(session.session_id, panes, started).fork))) {
      setCopied(session.session_id);
      window.setTimeout(() => setCopied((current) => current === session.session_id ? null : current), 1500);
    }
  };

  const groups = groupByDay(rows, now);
  const count = hasMore ? `${shown.length}+` : shown.length;

  return (
    <div className="history-section">
      <div className="history-ranges" role="group" aria-label={t("History range")}>
        {HISTORY_RANGES.map((value) => (
          <button key={value} type="button" className="history-chip" aria-pressed={range === value} onClick={() => { setRange(value); remember(RANGE_KEY, value); }}>
            {t(value === "today" ? "Today" : value === "7d" ? "7 days" : "30 days")}
          </button>
        ))}
      </div>
      <input className="input history-search" type="search" value={query} placeholder={t("Search title or first prompt…")} aria-label={t("Search title or first prompt…")} autoComplete="off" spellCheck={false} onChange={(event) => setQuery(event.target.value)} />
      {expanded && (
        <label className="history-check">
          <input type="checkbox" checked={automated} onChange={(event) => { setAutomated(event.target.checked); remember(AUTOMATED_KEY, event.target.checked ? "1" : "0"); }} />
          {t("Show automated (claude -p)")}
        </label>
      )}

      {folders.length === 0 && <p className="history-state" role="status">{t("This project has no folder to look in")}</p>}
      {error && <p className="history-state history-error" role="status">{error} <button type="button" className="btn btn-ghost" onClick={() => load(0)}>{t("Retry")}</button></p>}
      {folders.length > 0 && !error && sessions.length === 0 && <p className="history-state" role="status">{loading ? t("Loading history…") : t("No sessions in this range")}</p>}
      {sessions.length > 0 && shown.length === 0 && <p className="history-state" role="status">{t(hasMore ? "No match in the loaded sessions. Show more to search further." : "No sessions match")}</p>}

      {groups.map((group) => (
        <section key={group.key} aria-label={dayLabel(group.kind, group.date)}>
          {range !== "today" && <h3 className="history-day-title">{dayLabel(group.kind, group.date)}</h3>}
          <ul className="history-list">
            {group.sessions.map((session) => {
              const { openPaneId, fork } = rowAction(session.session_id, panes, started);
              const pending = starting === session.session_id;
              return (
                <li key={session.session_id} className="history-row">
                  <button type="button" className="history-open" disabled={starting !== null && !pending} title={t(fork ? "Open a copy in a new tab" : "Resume in a new tab")} onClick={() => void act(session)}>
                    <span className="history-title">
                      <span className="history-title-text">{session.title || t("Untitled session")}</span>
                      {fork && <span className="history-live">{t("OPEN NOW")}</span>}
                    </span>
                    <span className="history-meta">
                      {pending ? t("Starting claude…") : <>
                        <span>{timeOf(session)}</span>
                        {session.prompt_count !== null && <span>{t("{n} prompts", { n: session.prompt_count })}</span>}
                        {session.prompt_count === null && session.model && <span>{session.model}</span>}
                      </>}
                    </span>
                  </button>
                  {openPaneId !== null && <button type="button" className="icon-button history-goto" aria-label={t("Go to tab")} title={t("Go to tab")} onClick={() => onSelectPane(openPaneId)}><ArrowRight aria-hidden="true" /></button>}
                  <button type="button" className="icon-button history-copy" aria-label={t("Copy command")} title={t(copied === session.session_id ? "Copied" : "Copy command")} onClick={() => void copyCommand(session)}><Copy aria-hidden="true" /></button>
                  {rowError?.id === session.session_id && <p className="history-row-error" role="status">{rowError.message}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {!expanded && shown.length > COMPACT_ROWS && <button type="button" className="history-more" onClick={() => setExpanded(true)}>{t("See all ({n}) →", { n: count })}</button>}
      {expanded && hasMore && <button type="button" className="history-more" disabled={loading} onClick={() => load(sessions.length)}>{t(loading ? "Loading…" : "Show more")}</button>}
      {expanded && <button type="button" className="history-more" onClick={() => setExpanded(false)}>{t("Show fewer")}</button>}
    </div>
  );
}
