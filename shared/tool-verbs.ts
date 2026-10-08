import { patchText } from "./patch.ts";

export type ToolVerbKind = "read" | "edit" | "write" | "run";

/**
 * The tool ids a verb stands for, by exact name (case aside): Claude's Read / Edit / MultiEdit /
 * NotebookEdit / Write / Bash, Codex's exec / exec_command / shell / local_shell / apply_patch,
 * and the lowercase read / edit / write / bash / patch of pi, omp, gjc and omo. Anything else
 * (Grep, a web or task tool, a todo or goal call, an MCP tool) keeps its own name: a guess by
 * substring would call `mcp__files__read_all` a read.
 */
const VERB_OF: Record<string, ToolVerbKind> = {
  read: "read",
  edit: "edit", multiedit: "edit", notebookedit: "edit", apply_patch: "edit", patch: "edit",
  write: "write",
  bash: "run", exec: "run", exec_command: "run", shell: "run", shell_command: "run", local_shell: "run",
};

/** The kind of verb a tool id reads as, or null for a tool the table does not know. */
export function toolVerbKind(name: string, input = ""): ToolVerbKind | null {
  const key = name.toLowerCase();
  if (!Object.hasOwn(VERB_OF, key)) return null;
  const kind = VERB_OF[key]!;
  // Codex applies a patch from inside an exec script: the row names the files, so it is an edit.
  // The patch is found by its text, so a `tools.apply_patch("…")` the script only quotes or
  // comments out reads as an edit too, as it already does in the row's file list and diff.
  return kind === "run" && patchText(input) !== null ? "edit" : kind;
}
