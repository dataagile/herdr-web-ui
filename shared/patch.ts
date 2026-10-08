/**
 * Codex's file edits: an `apply_patch` call carries the patch as its whole input, and the
 * `exec` tool's scripts carry it as the string argument of `tools.apply_patch(…)`. Both
 * read as a raw blob unless the patch is found and its files named.
 */

const BEGIN = "*** Begin Patch";

/**
 * The patch a shell call applies: Codex's `shell` / `local_shell` take `command: ["apply_patch", patch]`
 * (or the same words inside `bash -lc`), `exec_command` a `cmd` with an `apply_patch <<'EOF'` heredoc.
 */
function shellPatch(input: string): string | null {
  let args: unknown;
  try { args = JSON.parse(input); } catch { return null; }
  if (typeof args !== "object" || args === null) return null;
  const record = args as Record<string, unknown>;
  const command = record["cmd"] ?? record["command"];
  const words = (Array.isArray(command) ? command : [command]).filter((word): word is string => typeof word === "string");
  const at = words.findIndex((word) => /^(?:.*\/)?apply_?patch$/.test(word));
  if (at >= 0 && words[at + 1]?.trimStart().startsWith(BEGIN)) return words[at + 1]!.trimStart();
  for (const word of words) {
    const heredoc = /\bapply_?patch\b[^\n]*<<-?\s*(['"]?)(\w+)\1[^\n]*\n([\s\S]*?)\n[ \t]*\2[ \t]*(?:\n|$)/.exec(word);
    if (heredoc?.[3]?.trimStart().startsWith(BEGIN)) return heredoc[3].trimStart();
  }
  return null;
}

/** The patch an edit call carries, or null when the input is not one. */
export function patchText(input: string): string | null {
  const trimmed = input.trimStart();
  if (trimmed.startsWith(BEGIN)) return trimmed;
  const shell = shellPatch(input);
  if (shell !== null) return shell;
  const call = /tools\.apply_patch\(\s*("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/s.exec(input);
  if (call === null) return null;
  const literal = call[1]!;
  let text: string;
  if (literal.startsWith("`")) text = literal.slice(1, -1).replace(/\\`/g, "`");
  else {
    try { text = JSON.parse(literal) as string; } catch { return null; }
  }
  return text.trimStart().startsWith(BEGIN) ? text.trimStart() : null;
}

/** The files a patch adds, updates or deletes, in the order it names them. */
export function patchFiles(patch: string): string[] {
  const files: string[] = [];
  for (const match of patch.matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm)) {
    const file = match[1]!.trim();
    if (!files.includes(file)) files.push(file);
  }
  return files;
}

/** One file's part of a patch: what it does to the file and the lines under its header. */
export interface PatchSection { file: string | null; action: "Update" | "Add" | "Delete" | ""; lines: string[] }

/** A patch split by file; lines before the first header (none, in a well-formed patch) share a section with no file. */
export function patchSections(patch: string): PatchSection[] {
  const sections: PatchSection[] = [];
  for (const line of patch.split("\n")) {
    const file = /^\*\*\* (Update|Add|Delete) File: (.+)$/.exec(line);
    if (file !== null) { sections.push({ file: file[2]!.trim(), action: file[1] as PatchSection["action"], lines: [] }); continue; }
    if (/^\*\*\* (Begin|End) Patch/.test(line)) continue;
    if (sections.length === 0) sections.push({ file: null, action: "", lines: [] });
    sections.at(-1)!.lines.push(line);
  }
  // the blank line a patch ends on is not part of any file
  for (const section of sections) while (section.lines.at(-1)?.trim() === "") section.lines.pop();
  return sections;
}
