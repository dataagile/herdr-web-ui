/**
 * Voice input: the browser records a short clip, the connection server sends it to the
 * user's own OpenAI key (BYOK) and streams the text back. The key lives only on the server
 * (stateDir/voice.json, mode 0600, or HERDR_WEB_OPENAI_API_KEY); no route ever returns it.
 */

export type VoiceMode = "chat" | "terminal";

/** GET /api/voice and the answer to PUT /api/voice/config. */
export interface VoiceStatus {
  /** a key is set: the server can transcribe */
  configured: boolean;
  /** where the key comes from; an env key cannot be changed from the app */
  source: "env" | "file" | null;
  /** OpenAI-compatible API root, e.g. https://api.openai.com/v1 */
  base_url: string;
  transcribe_model: string;
  polish_model: string;
  /** false: "Tidy" is off, the server never calls chat/completions (see VoiceConfigUpdate.polish_enabled) */
  polish_enabled: boolean;
  /** ISO 639-1 code sent to the provider as `language`; null = auto-detect */
  language: string | null;
  /** a key is saved (or set by the env) even when `configured` is false because it is withheld; see `error` */
  key_stored: boolean;
  /** why a saved key is not used (a saved base_url that is no longer allowed); null when nothing is wrong */
  error: string | null;
}

/**
 * PUT /api/voice/config. A missing field is left as it is; `api_key: null` removes the key.
 * `base_url` changes only together with `api_key` while a key is saved, and never while the env
 * sets the key: a key is not sent to a server other than the one it was saved for.
 */
export interface VoiceConfigUpdate {
  api_key?: string | null;
  base_url?: string | null;
  transcribe_model?: string | null;
  polish_model?: string | null;
  /**
   * `false` turns Tidy off server-side while keeping `polish_model`; `true` or null turns it back on.
   * It is stored as `polish_enabled: false` only, so a voice.json from before this field stays valid
   * (absent = on).
   */
  polish_enabled?: boolean | null;
  /** ISO 639-1 code, or null for auto-detect */
  language?: string | null;
}

/** POST /api/voice/models. Without `api_key` the saved key is used, and only for the saved server. */
export interface VoiceModelsRequest {
  base_url?: string | null;
  api_key?: string | null;
}

export interface VoiceModelsResponse {
  models: string[];
}

/**
 * POST /api/voice/transcribe answers `application/x-ndjson`, one event per line:
 * zero or more `delta`, then `done` with the whole transcript, then (when polish was asked
 * and succeeded) `polished`. A failure after the stream started is an `error` line.
 * Failures before it started are the usual `{ error: { code, message } }` envelope.
 */
export type VoiceEvent =
  | { type: "delta"; text: string }
  | { type: "done"; text: string }
  | { type: "polished"; text: string }
  | { type: "error"; code: VoiceErrorCode; message: string };

export type VoiceErrorCode =
  | "voice_not_configured" // 409: no key on the server
  | "key_from_env" // 409: PUT tried to change the key or base_url while HERDR_WEB_OPENAI_API_KEY sets the key
  | "audio_too_large" // 413
  | "invalid_audio" // 400: no audio part, empty, or not audio/*
  | "invalid_request" // 400: bad mode / keywords / config body
  | "provider_auth" // 502: the provider refused the key (401/403)
  | "provider_error" // 502: any other provider failure
  | "models_unauthorized" // 502: GET {base}/models answered 401/403
  | "models_unreachable" // 502: network failure, timeout or another status on GET {base}/models
  | "models_unsupported"; // 502: GET {base}/models answered 404, not JSON, or no `data` array

/** multipart fields of POST /api/voice/transcribe */
export const VOICE_FORM = {
  audio: "audio",
  mode: "mode",
  /** "1" asks for a `polished` event after `done` */
  polish: "polish",
  /** JSON array of strings: terms that may appear (commands, file names, the agent) */
  keywords: "keywords",
  /** the speaker's language, an ISO 639-1 code (the UI language); English is always added for code terms */
  language: "language",
} as const;

export const VOICE_MAX_AUDIO_BYTES = 10 * 1024 * 1024;
/** the recorder stops itself here; the server does not trust it and checks bytes only */
export const VOICE_MAX_SECONDS = 120;
export const VOICE_KEYWORDS_MAX = 50;
export const VOICE_KEYWORD_MAX_CHARS = 80;

export const VOICE_DEFAULTS = {
  base_url: "https://api.openai.com/v1",
  transcribe_model: "gpt-transcribe",
  polish_model: "gpt-6-luna",
} as const;

/**
 * This fork's own server (a LiteLLM proxy) serves this transcription model; it is only the
 * preselection after "Test and list models", never a default the server applies. Tidy has
 * none: it stays off until a model is chosen.
 */
export const VOICE_FORK_MODELS = {
  transcribe_model: "whisper-ptbr-simples",
} as const;
