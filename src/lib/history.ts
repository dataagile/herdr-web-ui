/**
 * The History view's pure parts: which sessions a range asks for, how they group by day, the
 * `claude --resume` command, and which sessions a pane already has open.
 */
import type { HistorySession } from "../../shared/protocol.ts";
import type { PaneInfo, WorkspaceInfo } from "../../shared/herdr-api.generated.ts";
import { parseAgentArgs } from "./agentArgs.ts";

export type HistoryRange = "today" | "7d" | "30d";
export const HISTORY_RANGES: readonly HistoryRange[] = ["today", "7d", "30d"];
const DAY_MS = 86_400_000;

/** Epoch ms a range reaches back to: Today is since this device's midnight, the others a rolling window. */
export function sinceFor(range: HistoryRange, now: number): number {
  if (range === "7d") return now - 7 * DAY_MS;
  if (range === "30d") return now - 30 * DAY_MS;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}

/** The project's folder: a worktree's checkout, else where its first pane is (as New tab resolves it). */
export function projectFolder(workspace: Pick<WorkspaceInfo, "workspace_id" | "worktree">, panes: readonly Pick<PaneInfo, "workspace_id" | "cwd">[]): string | null {
  return workspace.worktree?.checkout_path ?? panes.find((pane) => pane.workspace_id === workspace.workspace_id && pane.cwd)?.cwd ?? null;
}

/** The folders a project's History looks in: its own, and the checkouts of its worktree projects (a repository's project, not a worktree's own). */
export function historyFolders(workspace: Pick<WorkspaceInfo, "workspace_id" | "worktree">, workspaces: readonly Pick<WorkspaceInfo, "workspace_id" | "worktree">[], folder: string | null): string[] {
  const own = workspace.worktree;
  const linked = own && !own.is_linked_worktree
    ? workspaces.filter((other) => other.worktree?.is_linked_worktree && other.worktree.repo_key === own.repo_key).map((other) => other.worktree!.checkout_path)
    : [];
  return [...new Set([...(folder === null ? [] : [folder]), ...linked])].slice(0, 20);
}

/** Sessions whose title or first prompt holds `query`, case-insensitively; all of them for a blank one. */
export function matchingSessions(sessions: readonly HistorySession[], query: string): HistorySession[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === "") return [...sessions];
  return sessions.filter((session) => `${session.title}\n${session.first_prompt}`.toLocaleLowerCase().includes(needle));
}

export interface DayGroup { key: string; kind: "today" | "yesterday" | "date"; date: Date; sessions: HistorySession[] }

/** Sessions (newest first) in runs of one local calendar day. */
export function groupByDay(sessions: readonly HistorySession[], now: number): DayGroup[] {
  const startOf = (time: number): number => { const day = new Date(time); day.setHours(0, 0, 0, 0); return day.getTime(); };
  const today = startOf(now);
  const yesterday = startOf(today - 1);
  const groups: DayGroup[] = [];
  for (const session of sessions) {
    const day = startOf(session.last_activity);
    let group = groups[groups.length - 1];
    if (!group || group.key !== String(day)) {
      group = { key: String(day), kind: day === today ? "today" : day === yesterday ? "yesterday" : "date", date: new Date(day), sessions: [] };
      groups.push(group);
    }
    group.sessions.push(session);
  }
  return groups;
}

/** The argv after `claude`: `--resume <id>` and the arguments saved for the claude agent. */
export function resumeArgs(sessionId: string, savedArgs: string, fork = false): string[] {
  // a session another process has open is forked: Claude gives the copy its own session id
  return ["--resume", sessionId, ...(fork ? ["--fork-session"] : []), ...parseAgentArgs(savedArgs)];
}

/** `claude --resume …` as it is typed; an argument with a space or a quote is quoted. */
export function resumeCommand(sessionId: string, savedArgs: string, fork = false): string {
  return ["claude", ...resumeArgs(sessionId, savedArgs, fork)].map(shellWord).join(" ");
}

/** The command for a terminal elsewhere: Claude finds a session only from the folder it ran in. */
export function resumeCommandIn(cwd: string, sessionId: string, savedArgs: string, fork = false): string {
  return `cd ${shellWord(cwd)} && ${resumeCommand(sessionId, savedArgs, fork)}`;
}

function shellWord(word: string): string {
  return /^[\w@%+=:,./~-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;
}

/** The pane that has `sessionId` open, as herdr reports a Claude pane's session; null when none does. */
export function openPaneOf(sessionId: string, panes: readonly Pick<PaneInfo, "pane_id" | "agent" | "agent_session">[]): string | null {
  const open = panes.find((pane) => (pane.agent ?? pane.agent_session?.agent) === "claude" && pane.agent_session?.kind === "id" && pane.agent_session.value.toLowerCase() === sessionId.toLowerCase());
  return open?.pane_id ?? null;
}
