import { patchFiles, patchText } from "../../shared/patch.ts";
import { toolVerbKind, type ToolVerbKind } from "../../shared/tool-verbs.ts";

export { toolVerbKind, type ToolVerbKind };

/** What a work row says the call did, before its object: "Read src/a.ts", "Ran bun test". */
const VERB_LABEL: Record<ToolVerbKind, string> = {
  read: "Read",
  edit: "Edited",
  write: "Wrote",
  run: "Ran",
};

/** The input fields a verb's object can be: a run's command, a file call's path. */
const OBJECT_KEYS: Record<ToolVerbKind, readonly string[]> = {
  read: ["file_path", "path"],
  edit: ["file_path", "notebook_path", "path"],
  write: ["file_path", "path"],
  run: ["cmd", "command"],
};

/** The server cuts a row's summary to this many characters. */
const SUMMARY_LENGTH = 120;

/**
 * Whether a row's summary is the thing the call acted on: its command or path, or the files of
 * its patch. omp sums a call up by its `intent` ("Checking ports") instead, and a verb in front
 * of that sentence would read "Ran Checking ports".
 */
function isObjectOf(kind: ToolVerbKind, input: string, object: string): boolean {
  const patch = patchText(input);
  if (patch !== null && patchFiles(patch).join(", ").slice(0, SUMMARY_LENGTH) === object) return true;
  let args: unknown;
  try { args = JSON.parse(input); } catch { return false; }
  if (typeof args !== "object" || args === null) return false;
  return OBJECT_KEYS[kind].some((key) => {
    const value = (args as Record<string, unknown>)[key];
    return typeof value === "string" && value.slice(0, SUMMARY_LENGTH) === object;
  });
}

/**
 * The English verb (an i18n key) a row shows in place of the tool id, or null when the id stays:
 * an unknown tool, a call with no object to follow the verb, or a summary that is not the call's
 * own command or path.
 */
export function toolVerb(part: { name: string; input: string }, object: string): string | null {
  if (object.trim().length === 0 || object === part.name) return null;
  const kind = toolVerbKind(part.name, part.input);
  return kind !== null && isObjectOf(kind, part.input, object) ? VERB_LABEL[kind] : null;
}
