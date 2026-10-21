import { describe, expect, it } from "bun:test";

import type { MachineResources, SessionSnapshot } from "../../shared/protocol.ts";
import { fetchMachineResources } from "./api.ts";
import { formatSize, isHeavy, meterPercent, outsideProjects, projectLoads } from "./resources.ts";

const GB = 1024 ** 3;

const snapshot = {
  workspaces: [{ workspace_id: "w1", label: "api" }, { workspace_id: "w2", label: "web" }, { workspace_id: "w3", label: "docs" }],
  panes: [
    { pane_id: "p1", workspace_id: "w1", agent: "claude" },
    { pane_id: "p2", workspace_id: "w1", agent: null },
    { pane_id: "p3", workspace_id: "w2", agent: "codex" },
    { pane_id: "p4", workspace_id: "w3", agent: null },
  ],
} as unknown as SessionSnapshot;

const resources: MachineResources = {
  cpu: 97, memory: { used: 7 * GB, total: 8 * GB }, swap: null, disk: null,
  panes: [
    { pane_id: "p1", cpu: 10, memory: GB },
    { pane_id: "p2", cpu: 85, memory: GB },
    { pane_id: "p3", cpu: 4, memory: 0.5 * GB },
  ],
};

describe("resources", () => {
  it("sums a project's panes and orders projects by CPU, then memory", () => {
    const loads = projectLoads(snapshot, resources);
    expect(loads.map((load) => load.workspaceId)).toEqual(["w1", "w2"]);
    // its heaviest pane is the one the list opens and whose mark it draws
    expect(loads[0]).toMatchObject({ label: "api", cpu: 95, memory: 2 * GB, paneId: "p2", agent: null });
    expect(projectLoads(null, resources)).toEqual([]);
  });

  it("says a project is heavy from half the PC's CPU or a quarter of its memory", () => {
    const [api, web] = projectLoads(snapshot, resources);
    expect(isHeavy(api!, 8 * GB)).toBe(true);
    expect(isHeavy(web!, 8 * GB)).toBe(false);
    expect(isHeavy({ ...web!, memory: 2 * GB }, 8 * GB)).toBe(true);
    // an unmeasured CPU is not heavy by itself
    expect(isHeavy({ ...web!, cpu: null }, undefined)).toBe(false);
  });

  it("puts what the projects do not use outside them, never below 0", () => {
    expect(outsideProjects(resources)).toBe(4.5 * GB);
    expect(outsideProjects({ ...resources, memory: { used: GB, total: 8 * GB } })).toBe(0);
    expect(outsideProjects({ ...resources, memory: null })).toBeNull();
  });

  it("names sizes and shares", () => {
    expect(formatSize(640 * 1024 * 1024, "en")).toBe("640 MB");
    expect(formatSize(1.8 * GB, "en")).toBe("1.8 GB");
    expect(formatSize(1.8 * GB, "pt-BR")).toBe("1,8 GB");
    expect(meterPercent({ used: 1, total: 3 })).toBe(33);
    expect(meterPercent(null)).toBeNull();
  });
});

describe("fetchMachineResources", () => {
  const answer = (status: number) => async () => Response.json({ error: { code: status === 404 ? "not_found" : "unauthorized", message: "x" } }, { status });
  const real = globalThis.fetch;

  it("reads an older remote bridge's 401 or 403 as no such route, so the PC stops being asked", async () => {
    try {
      for (const status of [401, 403, 404]) {
        globalThis.fetch = answer(status) as unknown as typeof fetch;
        expect(await fetchMachineResources("pc-old", ["p1"])).toBeNull();
      }
      // on this PC a 401 is a signed-out client, not a missing route
      globalThis.fetch = answer(401) as unknown as typeof fetch;
      await expect(fetchMachineResources("local", [])).rejects.toThrow();
      globalThis.fetch = answer(500) as unknown as typeof fetch;
      await expect(fetchMachineResources("pc-old", [])).rejects.toThrow();
    } finally { globalThis.fetch = real; }
  });
});
