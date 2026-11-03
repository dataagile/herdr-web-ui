import type { SpokenLine } from "../../shared/protocol.ts";

/**
 * Read answers aloud: the chat speaks what falacomigo (a Claude Code plugin) spoke in the
 * session, with this device's own voices (Web Speech). Only lines that arrive while the chat
 * is open and on screen: the first read of a pane takes what is already there as heard, and a
 * line older than a minute (the chat stops polling while hidden) is dropped, so nothing sounds late.
 *
 * A phone lets a page speak only after a tap on it (`unlockReadAloud`); a line before that is
 * skipped by the browser, never queued.
 */

const STALE_MS = 60_000;

// per pane (paneStorageId): the newest `at` already heard
const heard = new Map<string, number>();

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

/** The lines newer than what the pane last heard; records them as heard. null on a pane's first read. */
export function newSpokenLines(key: string, lines: readonly SpokenLine[] | undefined): SpokenLine[] | null {
  const last = heard.get(key);
  const newest = Math.max(last ?? 0, ...(lines ?? []).map((line) => line.at));
  heard.set(key, newest);
  return last === undefined ? null : (lines ?? []).filter((line) => line.at > last);
}

export function readAloud(key: string, lines: readonly SpokenLine[] | undefined, enabled: boolean): void {
  const fresh = newSpokenLines(key, lines);
  const speech = synth();
  if (!fresh?.length || !enabled || !speech || document.visibilityState !== "visible") return;
  for (const line of fresh.filter((line) => Date.now() - line.at < STALE_MS)) {
    const utterance = new SpeechSynthesisUtterance(line.text);
    if (line.lang) utterance.lang = line.lang;
    speech.speak(utterance);
  }
}

/** From a user gesture: an empty utterance lets this page's later ones play (iOS Safari, Chrome on Android). */
export function unlockReadAloud(): void {
  synth()?.speak(new SpeechSynthesisUtterance(""));
}

export function stopReadAloud(): void {
  synth()?.cancel();
}
