import { expect, it } from "bun:test";
import { kickRefresh } from "./roster-refresh.ts";

it("returns at once whatever the read does", () => {
  let started = 0;
  kickRefresh(() => { started++; return new Promise<void>(() => {}); });
  kickRefresh(() => { started++; return Promise.reject(new Error("herdr down")); });
  kickRefresh(() => { started++; throw new Error("sync"); });
  kickRefresh(undefined);
  expect(started).toBe(3);
});
