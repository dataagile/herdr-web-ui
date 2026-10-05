import { useEffect, useState } from "react";
import { Terminal } from "lucide-react";

import "./SplitMenu.css";

import type { AgentKind, SplitDirection } from "../../shared/protocol.ts";
import { parseAgentArgs, rememberedAgentArgs } from "../lib/agentArgs.ts";
import { useMachineApi } from "../lib/machineContext.tsx";
import { useT } from "../lib/i18n.ts";
import { AgentMark } from "./AgentMark.tsx";
import { RowMenu, type RowMenuItem } from "./RowMenu.tsx";

/** What a split should open: the edge, and the shell (null) or the agent to start in it. */
export interface SplitTarget {
  direction: SplitDirection;
  agent: { kind: string; args?: string[] } | null;
}

export interface SplitMenuProps {
  anchor: HTMLElement;
  onClose: () => void;
  onSplit: (target: SplitTarget) => void;
}

/**
 * The header's Split menu: the edge (right or down) at the top, then what to open in the new
 * pane — a shell, or an agent carrying the arguments last used for it.
 */
export function SplitMenu({ anchor, onClose, onSplit }: SplitMenuProps) {
  const t = useT();
  const { fetchAgentKinds } = useMachineApi();
  const [direction, setDirection] = useState<SplitDirection>("right");
  const [agents, setAgents] = useState<AgentKind[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchAgentKinds()
      .then((next) => { if (!cancelled) setAgents(next); })
      .catch(() => { /* the shell is still offered */ });
    return () => { cancelled = true; };
  }, [fetchAgentKinds]);

  const header = (
    <div className="split-menu-head">
      <div className="segmented split-menu-dirs" role="group" aria-label={t("Direction")}>
        <button type="button" aria-pressed={direction === "right"} onClick={() => setDirection("right")}>{t("Right")}</button>
        <button type="button" aria-pressed={direction === "down"} onClick={() => setDirection("down")}>{t("Down")}</button>
      </div>
      <span className="split-menu-hint">{t("Opens in the new pane")}</span>
    </div>
  );

  const items: RowMenuItem[] = [
    { id: "shell", label: t("Shell"), icon: Terminal, run: () => onSplit({ direction, agent: null }) },
    ...agents.map((agent) => ({
      id: agent.kind,
      label: agent.label,
      icon: Terminal,
      glyph: <AgentMark agent={agent.kind} size={16} />,
      run: () => {
        const args = parseAgentArgs(rememberedAgentArgs(agent.kind));
        onSplit({ direction, agent: { kind: agent.kind, ...(args.length > 0 ? { args } : {}) } });
      },
    })),
  ];

  return <RowMenu anchor={anchor} title={t("Split")} align="start" header={header} items={items} onClose={onClose} />;
}
