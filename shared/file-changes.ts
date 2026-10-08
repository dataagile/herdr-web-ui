/**
 * The files a tool call changes, and what it did to each: the one place that reads a call's input
 * the way the chat's work rows do (the verb table, the Codex patch), so the server's list of a
 * session's edited files and the client's diff of them agree with what the chat shows.
 */

import { patchSections, patchText } from "./patch.ts";
import { toolVerbKind } from "./tool-verbs.ts";

/** What one call did to one file, in the form the client draws. */
export type ChangeBody =
  /** Claude's Edit / MultiEdit, pi's edit: old text -> new text, one pair per edit of the call */
  | { kind: "replace"; edits: { before: string; after: string }[] }
  /** a whole file written */
  | { kind: "write"; content: string }
  /** the part of a Codex patch that names this file, as its lines */
  | { kind: "patch"; action: "Update" | "Add" | "Delete" | ""; lines: string[] }
  /** omp's hash-line edit script */
  | { kind: "script"; script: string }
  /** a call whose input has a path but a shape this table does not know: its input as written */
  | { kind: "raw"; text: string };

export interface FileChange {
  /** as the call named it: absolute, or relative to the agent's folder */
  path: string;
  /** the call makes the file, for certain: a patch's Add File, the name a patch moves a file to */
  created: boolean;
  /** the call writes the whole file: it made it or replaced it, which only the call's result or git can tell */
  whole?: boolean;
  body: ChangeBody;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function pair(item: Record<string, unknown>): { before: string; after: string } | null {
  const before = text(item["old_string"]) ?? text(item["oldText"]);
  const after = text(item["new_string"]) ?? text(item["newText"]);
  return before === undefined && after === undefined ? null : { before: before ?? "", after: after ?? "" };
}

/** The files a tool call (its name and its input as the transcript parts carry them) changes; none for any other call. */
export function fileChanges(name: string, input: string): FileChange[] {
  const kind = toolVerbKind(name, input);
  if (kind !== "edit" && kind !== "write") return [];
  const patch = patchText(input);
  if (patch !== null) {
    return patchSections(patch).flatMap((section): FileChange[] => {
      if (section.file === null) return [];
      const body = { kind: "patch" as const, action: section.action, lines: section.lines };
      const move = section.action === "Update" ? section.lines.map((line) => /^\*\*\* Move to: (.+)$/.exec(line)?.[1]?.trim()).find((to) => to !== undefined) : undefined;
      // the file moved: the old name is changed (it is gone), the new one is made by this patch
      return [{ path: section.file, created: section.action === "Add", body }, ...(move === undefined ? [] : [{ path: move, created: true, body }])];
    });
  }
  let args: unknown;
  try { args = JSON.parse(input); } catch { return []; }
  if (typeof args !== "object" || args === null || Array.isArray(args)) return [];
  const record = args as Record<string, unknown>;
  const path = text(record["file_path"]) ?? text(record["notebook_path"]) ?? text(record["path"]);
  if (path === undefined || path.length === 0) return [];
  const content = text(record["content"]);
  if (kind === "write" && content !== undefined) return [{ path, created: false, whole: true, body: { kind: "write", content } }];
  const edits = Array.isArray(record["edits"])
    ? record["edits"].flatMap((item) => typeof item === "object" && item !== null ? [pair(item as Record<string, unknown>)] : []).filter((item) => item !== null)
    : [];
  const single = pair(record);
  if (edits.length > 0) return [{ path, created: false, body: { kind: "replace", edits } }];
  if (single !== null) return [{ path, created: false, body: { kind: "replace", edits: [single] } }];
  const script = text(record["input"]);
  if (script !== undefined) return [{ path, created: false, body: { kind: "script", script } }];
  return [{ path, created: false, body: { kind: "raw", text: input } }];
}
