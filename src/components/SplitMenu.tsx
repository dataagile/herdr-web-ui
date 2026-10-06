import { useEffect, useState } from "react";
import { Columns2, Rows2 } from "lucide-react";

import "./SplitMenu.css";

import type { AgentKind, SplitDirection } from "../../shared/protocol.ts";
import { parseAgentArgs, rememberAgentArgs, rememberedAgentArgs } from "../lib/agentArgs.ts";
import { useMachineApi } from "../lib/machineContext.tsx";
import { useT } from "../lib/i18n.ts";
import { RowMenu, type RowMenuItem } from "./RowMenu.tsx";

/** What a split should open: the edge, and the shell (null) or the agent to start in the new pane. */
export interface SplitTarget {
  direction: SplitDirection;
  agent: { kind: string; args?: string[] } | null;
}

export interface SplitMenuProps {
  anchor: HTMLElement;
  /** opens here instead of under the anchor (a right-click at the cursor) */
  point?: { top: number; left: number };
  /** the menu's name: what is being split */
  title: string;
  onClose: () => void;
  onSplit: (target: SplitTarget) => void;
  /** more items under Split right / down (the pane menu's zoom, new tab and close) */
  more?: RowMenuItem[];
}

/**
 * Split right / Split down, over the agent the new pane starts: a shell, or an agent with the
 * arguments it was last given (the same field as New tab, remembered per agent).
 */
export function SplitMenu({ anchor, point, title, onClose, onSplit, more = [] }: SplitMenuProps) {
  const t = useT();
  const { fetchAgentKinds } = useMachineApi();
  const [agents, setAgents] = useState<AgentKind[]>([]);
  const [kind, setKind] = useState("");
  const [args, setArgs] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchAgentKinds()
      .then((next) => { if (!cancelled) setAgents(next); })
      .catch(() => { /* the shell is still offered */ });
    return () => { cancelled = true; };
  }, [fetchAgentKinds]);

  const choose = (next: string): void => {
    setKind(next);
    setArgs(rememberedAgentArgs(next));
  };
  const target = (direction: SplitDirection): SplitTarget => {
    if (kind === "") return { direction, agent: null };
    rememberAgentArgs(kind, args);
    const parsed = parseAgentArgs(args);
    return { direction, agent: { kind, ...(parsed.length > 0 ? { args: parsed } : {}) } };
  };

  const header = (
    <div className="split-menu-head">
      <span className="split-menu-title">{title}</span>
      <label className="split-menu-field">
        <span className="field-label">{t("Agent")}</span>
        <select className="select" value={kind} onChange={(event) => choose(event.target.value)} aria-label={t("Agent of the new pane")}>
          <option value="">{t("Shell")}</option>
          {agents.map((agent) => <option key={agent.kind} value={agent.kind}>{agent.label}</option>)}
        </select>
      </label>
      {kind !== "" && (
        <label className="split-menu-field">
          <span className="field-label">{t("Arguments")}</span>
          <input
            className="input"
            value={args}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("e.g. --auto")}
            onChange={(event) => setArgs(event.target.value)}
            // Home and End move the caret here, not the menu's focus
            onKeyDown={(event) => { if (event.key === "Home" || event.key === "End") event.stopPropagation(); }}
          />
        </label>
      )}
    </div>
  );

  const items: RowMenuItem[] = [
    { id: "split-right", label: t("Split right"), icon: Columns2, run: () => onSplit(target("right")) },
    { id: "split-down", label: t("Split down"), icon: Rows2, run: () => onSplit(target("down")) },
    ...more,
  ];
  return <RowMenu anchor={anchor} {...(point ? { point } : {})} title={title} align="start" header={header} items={items} onClose={onClose} />;
}
