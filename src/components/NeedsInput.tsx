import { useId } from "react";
import type { Machine } from "../../shared/machines.ts";
import { paneStorageId } from "../../shared/machines.ts";
import { useT } from "../lib/i18n.ts";
import type { PaneNeedingYou } from "../lib/needsInput.ts";
import { useStoredFold } from "../lib/storedFold.ts";
import { AgentMark } from "./AgentMark.tsx";
import { FoldChevron } from "./FoldChevron.tsx";
import { displayPaneTitle, StatusBadge } from "./Sidebar.tsx";
import "./NeedsInput.css";

/** The block folds per PC, open unless stored as "1"; a new waiting pane never reopens it. */
const foldedKey = (machineId: string) => `herdr-web-ui:needs-folded:${machineId}`;

/** One PC's panes that wait for the user (blocked, then done); nothing at all when there are none. */
export function NeedsInput({ machine, waiting, selectedPaneId, onSelect }: {
  machine: Machine;
  waiting: PaneNeedingYou[];
  selectedPaneId: string | null;
  onSelect(machineId: string, paneId: string): void;
}) {
  const t = useT();
  const listId = useId();
  const [folded, toggle] = useStoredFold(foldedKey(machine.id));
  if (waiting.length === 0) return null;
  return <section className="needs-input" aria-label={t("Needs you on {machine}", { machine: machine.name })}>
    <h2 className="needs-input-heading">
      <button type="button" className="sidebar-section-header needs-input-toggle" aria-expanded={!folded} aria-controls={listId} onClick={toggle}>
        <FoldChevron folded={folded} />
        {t("Needs you")} <span className="pill">{waiting.length}</span>
      </button>
    </h2>
    <ul className="pane-list" id={listId} hidden={folded}>
      {waiting.map(({ pane, workspace }) => {
        const selected = pane.pane_id === selectedPaneId;
        return <li className={`needs-input-item${selected ? " is-selected" : ""}`} key={paneStorageId(machine.id, pane.pane_id)}>
          <button type="button" className="pane-select needs-input-select" aria-current={selected ? "true" : undefined} onClick={() => onSelect(machine.id, pane.pane_id)}>
            <span className="agent-mark-holder"><AgentMark agent={pane.agent ?? ""} size={22} /></span>
            <span className="pane-copy">
              <span className="pane-title">{displayPaneTitle(pane)}</span>
              <span className="pane-meta"><StatusBadge status={pane.agent_status} /><span className="pane-subtitle">{workspace.label}</span></span>
            </span>
          </button>
        </li>;
      })}
    </ul>
  </section>;
}
