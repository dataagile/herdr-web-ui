import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { homedir } from "node:os";
import nodePath from "node:path";
import type { SpokenLine } from "../shared/protocol.ts";

/** Lines kept from the end of the file: more than one poll can miss, few enough to stay small. */
const KEEP = 5;
const TAIL_BYTES = 16 * 1024;

/**
 * What falacomigo (a Claude Code plugin) spoke in a Claude session, newest last: one JSON line
 * per utterance in `<state home>/falacomigo/<session id>.jsonl`. null when it wrote none.
 * `signature` changes whenever the file does, so the chat poll's ETag follows it.
 */
export function spokenLines(sessionId: string, stateHome = process.env["XDG_STATE_HOME"] || nodePath.join(homedir(), ".local", "state")): { lines: SpokenLine[]; signature: string } | null {
  let fd: number;
  try { fd = openSync(nodePath.join(stateHome, "falacomigo", `${sessionId}.jsonl`), "r"); } catch { return null; }
  try {
    const { size, mtimeMs } = fstatSync(fd);
    const length = Math.min(size, TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    const lines: SpokenLine[] = [];
    // the first line of a cut tail is partial and fails to parse, like any malformed one
    for (const raw of buffer.toString("utf8").split("\n")) {
      try {
        const line = JSON.parse(raw) as Partial<SpokenLine>;
        if (typeof line.at === "number" && typeof line.text === "string" && line.text !== "") lines.push({ at: line.at, text: line.text, ...(typeof line.lang === "string" ? { lang: line.lang } : {}) });
      } catch { /* skipped */ }
    }
    return { lines: lines.slice(-KEEP), signature: `${size}:${mtimeMs}` };
  } finally {
    closeSync(fd);
  }
}
