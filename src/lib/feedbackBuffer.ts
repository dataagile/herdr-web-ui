/**
 * What the feedback's technical data is made of: a small ring of the console warnings and errors
 * and of the failed requests this tab saw, kept in memory only and masked on the way in (a
 * message through `scrubText`, a request's path through `scrubUrl`, its query values dropped).
 * `installFeedbackBuffer()` runs once from main.tsx and is a no-op the second time.
 */
import { scrubText, scrubUrl } from "./feedbackScrub.ts";

const MAX_ENTRIES = 20;
const WINDOW_MS = 5 * 60 * 1000;
const MAX_MESSAGE = 500;

export interface FailedRequest {
  method: string;
  path: string;
  /** 0 when the request never got an answer */
  status: number;
}

export interface ConsoleLine {
  level: "warning" | "error";
  message: string;
}

interface Stamped<T> { at: number; value: T }

let consoleRing: Stamped<ConsoleLine>[] = [];
let requestRing: Stamped<FailedRequest>[] = [];
let installed = false;

function keep<T>(ring: Stamped<T>[], value: T, now: number): Stamped<T>[] {
  return [...ring, { at: now, value }].slice(-MAX_ENTRIES);
}

export function recordConsole(message: string, level: ConsoleLine["level"] = "error", now = Date.now()): void {
  const masked = scrubText(message);
  consoleRing = keep(consoleRing, { level, message: masked.length > MAX_MESSAGE ? `${masked.slice(0, MAX_MESSAGE)}…` : masked }, now);
}

export function recordRequest(method: string, url: string, status: number, now = Date.now()): void {
  // the portal's own answers (this app's 404 for /api/portal/me outside the portal, the feedback POST) are not news
  if (new URL(url, "http://local").pathname.startsWith("/api/portal/")) return;
  requestRing = keep(requestRing, { method: method.toUpperCase().slice(0, 16), path: scrubUrl(url).slice(0, 512), status }, now);
}

export function recentConsole(now = Date.now()): ConsoleLine[] {
  return consoleRing.filter((entry) => entry.at >= now - WINDOW_MS).map((entry) => entry.value);
}

export function recentRequests(now = Date.now()): FailedRequest[] {
  return requestRing.filter((entry) => entry.at >= now - WINDOW_MS).map((entry) => entry.value);
}

/** for tests */
export function resetFeedbackBuffer(): void {
  consoleRing = [];
  requestRing = [];
}

function describe(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
}

export function installFeedbackBuffer(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  for (const level of ["warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      recordConsole(args.map(describe).join(" "), level === "warn" ? "warning" : "error");
      original(...args);
    };
  }
  window.addEventListener("error", (event) => recordConsole(event.error ? describe(event.error) : event.message));
  window.addEventListener("unhandledrejection", (event) => recordConsole(`UnhandledRejection: ${describe(event.reason)}`));
  const original = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const url = input instanceof Request ? input.url : String(input);
    try {
      const response = await original(input, init);
      if (!response.ok) recordRequest(method, url, response.status);
      return response;
    } catch (reason) {
      recordRequest(method, url, 0);
      throw reason;
    }
  }) as typeof window.fetch;
}
