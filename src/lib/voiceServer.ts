import { VOICE_FORK_MODELS } from "../../shared/voice.ts";

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
 * start on: the saved model if the server lists it, else this fork's own, else the first
 * speech-to-text id (transcription); Tidy keeps a listed saved model, else None.
 */
export function voiceModelChoices(ids: readonly string[], saved: { transcribe: string; polish: string | null }): VoiceModelChoices {
  const speech = ids.filter((id) => SPEECH_MODEL.test(id));
  const other = ids.filter((id) => !SPEECH_MODEL.test(id));
  const listed = (id: string) => ids.includes(id);
  const transcribe = [saved.transcribe, VOICE_FORK_MODELS.transcribe_model].find(listed) ?? speech[0] ?? ids[0] ?? "";
  // Tidy stays off unless a model the server lists is already saved
  const polish = saved.polish !== null && listed(saved.polish) ? saved.polish : "";
  return { speech, other, transcribe, polish };
}

/** the host of a server URL for display, the URL itself when it does not parse */
export function voiceHost(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}
