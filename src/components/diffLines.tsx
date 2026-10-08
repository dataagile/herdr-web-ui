import { currentLocale } from "../lib/i18n.ts";
import { lineDiff } from "../lib/diff.ts";

/** The pieces of a diff the chat's work rows and the modified-files panel both draw. */

/** A turn's time of day in the viewer's locale; null for none or an invalid one. */
export function formatTime(ts: string | null): string | null {
  if (ts === null) return null;
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString(currentLocale(), { hour: "2-digit", minute: "2-digit" });
}

/** The class of a line of omp's hash-line edit script. */
export function ompEditLineClass(line: string): string | undefined {
  if (line.startsWith("+-") || line.startsWith("-") || /^(CUT|REM)\b/.test(line)) return "chat-diff-del";
  if (line.startsWith("+")) return "chat-diff-add";
  if (/^(PUT|MV)/.test(line) || line.startsWith("[")) return "chat-diff-head";
  return undefined;
}

/** An edit's old and new text as one diff: the unchanged lines once, the changes in place. */
export function EditDiff({ before, after }: { before: string; after: string }) {
  const lines = lineDiff(before, after);
  return <pre className="chat-diff">{lines.map((line, index) =>
    <span key={index} className={line.kind === "add" ? "chat-diff-add" : line.kind === "del" ? "chat-diff-del" : undefined}>{line.kind === "add" ? "+ " : line.kind === "del" ? "- " : "  "}{line.text}{"\n"}</span>)}</pre>;
}

/** The lines of a Codex patch, coloured; one file's part of it, or all of it. */
export function PatchLines({ lines }: { lines: string[] }) {
  const lineClass = (line: string): string | undefined =>
    line.startsWith("@@") || line.startsWith("*** Move to:") ? "chat-diff-head" : line.startsWith("+") ? "chat-diff-add" : line.startsWith("-") ? "chat-diff-del" : undefined;
  return <pre className="chat-diff">{lines.map((line, at) => <span key={at} className={lineClass(line)}>{line}{"\n"}</span>)}</pre>;
}

/** omp's hash-line edit script, its lines coloured. */
export function EditScript({ script, className = "chat-diff" }: { script: string; className?: string }) {
  return <pre className={className}>{script.split("\n").map((line, index) => <span key={index} className={ompEditLineClass(line)}>{line}{"\n"}</span>)}</pre>;
}
