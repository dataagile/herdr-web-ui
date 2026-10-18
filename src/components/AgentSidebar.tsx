import { useId, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Terminal } from "lucide-react";

import type { Machine } from "../../shared/machines.ts";
import { paneStorageId } from "../../shared/machines.ts";
import type { AgentStatus } from "../../shared/protocol.ts";
import { useT } from "../lib/i18n.ts";
import { agentContext, agentTabName, paneMark, sidebarAgents } from "../lib/sidebarAgents.ts";
import { useSettings } from "../lib/settings.ts";
import { useSidebarActivity } from "../lib/sidebarActivity.tsx";
import { activityOrder } from "../lib/sidebarOrder.ts";
import { AgentMark } from "./AgentMark.tsx";
import { BackgroundBadge, displayPaneTitle, StatusBadge } from "./Sidebar.tsx";
import "./AgentSidebar.css";

interface AgentRowBodyProps {
  /** the agent's kind or name; null draws a terminal, for a shell */
  mark: string | null;
  title: string;
  context: string;
  backgroundTasks?: number;
  status?: AgentStatus;
}

/**
 * One agent in a list: the coding agent's mark, what it is working on, who and where it is, and
 * how it is doing.
 */
function AgentRowBody({ mark, title, context, backgroundTasks, status }: AgentRowBodyProps) {
  return <>
    <span className="sidebar-mark" aria-hidden="true">{mark !== null ? <AgentMark agent={mark} size={18} /> : <Terminal />}</span>
    <span className="agent-copy">
      <span className="agent-title">{title}</span>
      {context && <span className="agent-context">{context}</span>}
    </span>
    <span className="agent-row-status"><BackgroundBadge count={backgroundTasks} /><StatusBadge status={status} compact /></span>
  </>;
}

export interface AgentSidebarProps {
  machines: Machine[];
  selectedMachineId: string;
  selectedPaneId: string | null;
  /** a PC's state in words, for the tooltip of a row whose PC is not connected */
  stateWord(machine: Machine): string;
  onSelect(machineId: string, paneId: string): void;
}

/** the width under which the sidebar is a drawer (src/styles.css) */
const DRAWER_QUERY = "(max-width: 768px)";

/**
 * One PC's live agents, drawn inside that PC between Projects and History: the project folds do
 * not hide these rows, the PC's own fold does. In the phone's drawer the list starts folded.
 */
export function AgentSidebar({ machines, selectedMachineId, selectedPaneId, stateWord, onSelect }: AgentSidebarProps) {
  const t = useT();
  const listId = useId();
  const foldKey = `herdr-web-ui:sidebar-section:${machines[0]?.id}:agents`;
  // one fold per PC. Not useStoredFold: that is open unless stored, and here the phone's drawer starts
  // folded until the user picks one, so the open choice ("0") is stored too.
  const [collapsed, setCollapsed] = useState(() => {
    try { const stored = localStorage.getItem(foldKey); if (stored !== null) return stored === "1"; } catch {}
    return window.matchMedia?.(DRAWER_QUERY).matches === true;
  });
  const toggle = () => {
    try { localStorage.setItem(foldKey, collapsed ? "0" : "1"); } catch {}
    setCollapsed(!collapsed);
  };
  const { settings } = useSettings();
  const activity = useSidebarActivity();
  // Settings → Agents order: herdr's order, or Activity within each PC (each herdr counts its own changes)
  const byActivity = settings.agentOrder === "activity";
  const rows = useMemo(() => machines.flatMap((machine) => {
    const agents = sidebarAgents(machine.snapshot);
    return (byActivity ? activityOrder(agents, (entry) => entry.pane, activity.seqs(machine.id)) : agents).map((entry) => ({ machine, entry }));
  }), [machines, byActivity, activity]);
  return <section className={`agents-sidebar${collapsed ? " is-collapsed" : ""}${rows.length === 0 ? " is-empty" : ""}`} aria-label={t("Agents on {machine}", { machine: machines[0]?.name ?? "" })}>
    <button type="button" className="agent-section-toggle sidebar-section-label" aria-expanded={!collapsed} aria-controls={listId} onClick={toggle}>
      {collapsed ? <ChevronRight className="agent-section-caret" aria-hidden="true" /> : <ChevronDown className="agent-section-caret" aria-hidden="true" />}
      <span>{t("Agents")}</span>
      {collapsed && rows.length > 0 && <span className="agent-section-count">{rows.length}</span>}
    </button>
    <div className="agent-list-contents" id={listId} hidden={collapsed}>
      {rows.length === 0 ? <p className="agent-empty" role="status">{t("No agents running")}</p> : <ul className="agent-list">
        {rows.map(({ machine, entry }) => {
          const { pane, workspace, tab, agent, agentLabel } = entry;
          const selected = machine.id === selectedMachineId && pane.pane_id === selectedPaneId;
          const online = machine.state === "connected";
          const title = pane.label?.trim() || agent?.title?.trim() || pane.title?.trim() || displayPaneTitle(pane);
          const tabs = machine.snapshot?.tabs.filter((candidate) => candidate.workspace_id === workspace.workspace_id) ?? [];
          const tabName = agentTabName(tab, tabs, t);
          const context = agentContext({ agentLabel, title, machineName: null, workspaceLabel: workspace.label, tabName }).join(" · ");
          const tooltip = [...new Set([pane.pane_id, title, context, agent?.name, agent?.display_agent, pane.cwd, online ? null : stateWord(machine)].filter(Boolean))].join("\n");
          return <li className={`agent-item${selected ? " is-selected" : ""}${online ? "" : " is-offline"}`} key={paneStorageId(machine.id, pane.pane_id)} data-machine={machine.id} data-pane={pane.pane_id}>
            <button type="button" className="agent-select agent-row" disabled={!online} aria-current={selected ? "true" : undefined} title={tooltip} onClick={() => onSelect(machine.id, pane.pane_id)}>
              {/* a saved roster's state is not news: a PC that is away says nothing about its agents */}
              <AgentRowBody mark={paneMark(entry)} title={title} context={context} backgroundTasks={online ? pane.background_tasks : 0} status={online ? activity.status(machine.id, pane) : undefined} />
            </button>
          </li>;
        })}
      </ul>}
    </div>
  </section>;
}
