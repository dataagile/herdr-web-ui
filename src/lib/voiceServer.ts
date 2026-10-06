import { VOICE_DEFAULTS, VOICE_FORK_MODELS, type VoiceConfigUpdate, type VoiceStatus } from "../../shared/voice.ts";

/** ids a transcription endpoint is likely to serve: listed first, under "Speech-to-text" */
const SPEECH_MODEL = /whisper|transcri|speech|stt/i;

export interface VoiceModelChoices {
  speech: string[];
  other: string[];
  /** the transcription model to preselect */
  transcribe: string;
  /** the Tidy model to preselect; "" is None (Tidy off) */
  polish: string;
}

/**
 * What the two model selects offer after a successful "Test and list models", and what they
 * start on. Transcription: the field's current value if the server lists it, else the saved
 * one, else this fork's own, else the first speech-to-text id. Tidy: the current choice if
 * listed (None stays None), else the saved model if listed, else None.
 */
export function voiceModelChoices(
  ids: readonly string[],
  current: { transcribe: string; polish: string },
  saved: { transcribe: string; polish: string | null },
): VoiceModelChoices {
  const speech = ids.filter((id) => SPEECH_MODEL.test(id));
  const other = ids.filter((id) => !SPEECH_MODEL.test(id));
  const listed = (id: string) => ids.includes(id);
  const transcribe = [current.transcribe, saved.transcribe, VOICE_FORK_MODELS.transcribe_model].find(listed) ?? speech[0] ?? ids[0] ?? "";
  const polish = current.polish === "" ? "" : listed(current.polish) ? current.polish : saved.polish !== null && listed(saved.polish) ? saved.polish : "";
  return { speech, other, transcribe, polish };
}

/** The card's fields. `url` is empty for OpenAI's own server, `polish` empty for Tidy off. */
export interface VoiceFields { url: string; key: string; transcribe: string; polish: string; language: string }

/** The fields as the server's status says it holds them: what "unchanged" means for a save. */
export function voiceFieldsOf(status: VoiceStatus): VoiceFields {
  return {
    url: status.base_url === VOICE_DEFAULTS.base_url ? "" : status.base_url,
    key: "",
    transcribe: status.transcribe_model,
    polish: status.polish_enabled ? status.polish_model : "",
    language: status.language ?? "",
  };
}

/**
 * The PUT /api/voice/config of Save: only what the user changed. An unchanged URL is never sent
 * (an env or older stored one would be refused or re-pinned), nor a model that is only the
 * status's default, so a key-only or language-only save leaves the rest as it was.
 */
export function voiceSaveBody(status: VoiceStatus, fields: VoiceFields): VoiceConfigUpdate {
  const was = voiceFieldsOf(status);
  const body: VoiceConfigUpdate = {};
  if (fields.key.trim()) body.api_key = fields.key.trim();
  if (fields.url.trim() !== was.url) body.base_url = fields.url.trim() || null;
  if (fields.transcribe.trim() !== was.transcribe) body.transcribe_model = fields.transcribe.trim() || null;
  if (fields.polish.trim() !== was.polish) {
    if (fields.polish.trim()) { body.polish_model = fields.polish.trim(); body.polish_enabled = true; } else body.polish_enabled = false;
  }
  if (fields.language !== was.language) body.language = fields.language || null;
  return body;
}

/** the host of a server URL for display, the URL itself when it does not parse */
export function voiceHost(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}
