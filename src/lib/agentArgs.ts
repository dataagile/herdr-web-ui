/**
 * An agent's extra command-line arguments, as typed in the new-session and split dialogs, and
 * the ones remembered per agent kind (a `claude` started once with `--dangerously-skip-permissions`
 * is offered that way next time).
 */

const ARGS_KEY_PREFIX = "herdr-web-ui:new-session-agent-args:";

/**
 * Splits an arguments string the way a shell would, so `--flag "two words"` is two tokens.
 * Outside quotes a backslash escapes the next character; single and double quotes group a
 * token literally; an unterminated quote keeps what was typed, so a half-typed flag is not
 * silently dropped.
 */
export function parseAgentArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let started = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quote === null) {
      if (char === "\\" && index + 1 < input.length) { current += input[index + 1]!; index += 1; started = true; continue; }
      if (char === "'" || char === '"') { quote = char; started = true; continue; }
      if (/\s/.test(char)) { if (started) { args.push(current); current = ""; started = false; } continue; }
      current += char; started = true;
    } else if (quote === '"' && char === "\\" && index + 1 < input.length) {
      // inside double quotes a backslash escapes the next character, as a shell does
      current += input[index + 1]!; index += 1;
    } else if (char === quote) {
      quote = null;
    } else {
      current += char;
    }
  }
  if (started) args.push(current);
  return args;
}

/** The arguments last used for `kind` ("" for a shell, or one never given any). */
export function rememberedAgentArgs(kind: string): string {
  if (kind === "") return "";
  try {
    return window.localStorage.getItem(ARGS_KEY_PREFIX + kind) ?? "";
  } catch {
    return "";
  }
}

/** Remembers `args` for `kind`; an empty string forgets them, so the default comes back. */
export function rememberAgentArgs(kind: string, args: string): void {
  if (kind === "") return;
  try {
    const trimmed = args.trim();
    if (trimmed === "") window.localStorage.removeItem(ARGS_KEY_PREFIX + kind);
    else window.localStorage.setItem(ARGS_KEY_PREFIX + kind, trimmed);
  } catch {
    /* private mode: the arguments simply are not remembered */
  }
}
