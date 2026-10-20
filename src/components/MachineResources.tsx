import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import { Terminal, TriangleAlert } from "lucide-react";

import "./MachineResources.css";

import type { MachineResources as Resources, ResourceMeter } from "../../shared/protocol.ts";
import { useT } from "../lib/i18n.ts";
import { formatSize, HEAVY_CPU, HIGH_PERCENT, isHeavy, meterPercent, outsideProjects, type ProjectLoad } from "../lib/resources.ts";
import { AgentMark } from "./AgentMark.tsx";

/** How many projects the list names before it stops. */
const MAX_PROJECTS = 5;

function Meter({ label, percent, title }: { label: string; percent: number | null; title: string }) {
  return (
    <span className={`machine-resource${percent !== null && percent >= HIGH_PERCENT ? " is-high" : ""}`} title={title}>
      <span className="machine-resource-label">{label}</span>
      <span className="machine-resource-value">{percent === null ? "—" : `${percent}%`}</span>
      <span className="machine-resource-bar" style={{ "--fill": `${percent ?? 0}%` } as CSSProperties} />
    </span>
  );
}

/**
 * The PC's CPU, memory, disk and swap under its name; a click lists the projects using the most,
 * with what is used outside them. A meter this PC cannot read is left out.
 */
export function MachineResources({ resources, loads, onSelect }: { resources: Resources; loads: ProjectLoad[]; onSelect(paneId: string): void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Escape and focus belong to the list only while focus is in it: other dialogs keep theirs
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    stripRef.current?.focus();
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };

  const sized = (name: string, meter: ResourceMeter) => t("{name} {used} of {total}", { name, used: formatSize(meter.used), total: formatSize(meter.total) });
  const meters: Array<{ label: string; percent: number | null; title: string }> = [
    { label: "CPU", percent: resources.cpu, title: resources.cpu === null ? "CPU" : `CPU ${resources.cpu}%` },
    ...(resources.memory ? [{ label: t("Mem"), percent: meterPercent(resources.memory), title: sized(t("Memory"), resources.memory) }] : []),
    ...(resources.disk ? [{ label: t("Disk"), percent: meterPercent(resources.disk), title: sized(t("Disk"), resources.disk) }] : []),
    ...(resources.swap ? [{ label: t("Swap"), percent: meterPercent(resources.swap), title: sized(t("Swap"), resources.swap) }] : []),
  ];
  const summary = meters.map((meter) => `${meter.label} ${meter.percent === null ? "—" : `${meter.percent}%`}`).join(", ");
  const outside = outsideProjects(resources);

  return (
    <div className="machine-resources" ref={rootRef} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button ref={stripRef} type="button" className="machine-resources-strip" aria-expanded={open} aria-label={`${t("PC resources")}: ${summary}`} title={meters.map((meter) => meter.title).join(" · ")} onClick={() => setOpen(!open)}>
        {meters.map((meter) => <Meter key={meter.label} {...meter} />)}
      </button>
      {open && (
        <div className="resource-popover" role="dialog" aria-label={t("Who is using it")}>
          <p className="resource-popover-head">{t("Who is using it")}</p>
          {loads.slice(0, MAX_PROJECTS).map((load) => (
            <button key={load.workspaceId} type="button" className="resource-project" onClick={() => { setOpen(false); onSelect(load.paneId); }}>
              <span className="sidebar-mark" aria-hidden="true">{load.agent ? <AgentMark agent={load.agent} size={18} /> : <Terminal />}</span>
              <span className="resource-project-name">{load.label}</span>
              <span className={`resource-project-value${(load.cpu ?? 0) >= HIGH_PERCENT ? " is-high" : ""}`}>{load.cpu === null ? "—" : `${load.cpu}%`}</span>
              <span className="resource-project-value">{formatSize(load.memory)}</span>
            </button>
          ))}
          {loads.length === 0 && <p className="resource-popover-note">{t("No project measured yet")}</p>}
          {outside !== null && <p className="resource-popover-note">{t("Outside projects: {size} (browser, system…)", { size: formatSize(outside) })}</p>}
        </div>
      )}
    </div>
  );
}

/** The project row's warning: what makes it heavy, CPU first, else memory. */
export function HeavyProject({ load, memoryTotal }: { load: ProjectLoad; memoryTotal: number | undefined }) {
  const t = useT();
  if (!isHeavy(load, memoryTotal)) return null;
  const text = (load.cpu ?? 0) >= HEAVY_CPU ? `${load.cpu}%` : formatSize(load.memory);
  return (
    <span className="resource-heavy" title={t("This project: CPU {cpu} · memory {memory}", { cpu: load.cpu === null ? "—" : `${load.cpu}%`, memory: formatSize(load.memory) })}>
      <TriangleAlert aria-hidden="true" />{text}
    </span>
  );
}
