import { useEffect, useRef, useState } from "react";
import { VOICE_DEFAULTS, type VoiceConfigUpdate, type VoiceStatus } from "../../shared/voice.ts";
import { fetchVoiceModels, saveVoiceConfig } from "../lib/api.ts";
import { useT } from "../lib/i18n.ts";
import { VOICE_CONFIG_EVENT } from "../lib/voice.ts";
import { voiceFieldsOf, voiceHost, voiceModelChoices, voicePartition, voiceSaveBody } from "../lib/voiceServer.ts";

/** codes are ISO 639-1; names are written in their own language, as in a language picker */
const LANGUAGES = [["pt", "Português"], ["en", "English"], ["es", "Español"], ["ko", "한국어"], ["ja", "日本語"], ["zh", "中文"]] as const;

/**
 * Settings → Voice input → Transcription server. The key typed here goes to the server with a
 * save or a test and is never kept; nothing is saved until Save.
 */
export function VoiceServerCard({ voice, onSaved }: { voice: VoiceStatus | null; onSaved: (status: VoiceStatus) => void }) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [transcribeModel, setTranscribeModel] = useState("");
  const [polishModel, setPolishModel] = useState("");
  const [language, setLanguage] = useState("");
  const [models, setModels] = useState<string[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // a Test's answer counts only while the fields it was asked with are still the fields
  const testId = useRef(0);
  const [error, setError] = useState<string | null>(null);

  // the fields start from, and return to, what the server says it holds
  useEffect(() => {
    if (!voice) return;
    const fields = voiceFieldsOf(voice);
    setUrl(fields.url);
    setTranscribeModel(fields.transcribe);
    setPolishModel(fields.polish);
    setLanguage(fields.language);
    setModels(null);
  }, [voice]);

  /** the fields the list was made from changed (or a save started): it no longer describes them */
  const invalidateList = () => { testId.current += 1; setTesting(false); setModels(null); setTestError(null); };

  const test = async () => {
    const id = ++testId.current;
    setTesting(true);
    setTestError(null);
    try {
      // exactly the URL in the field: empty is OpenAI's, never the saved server (whose key it would take)
      const ids = await fetchVoiceModels({ base_url: url.trim() || VOICE_DEFAULTS.base_url, ...(key.trim() ? { api_key: key.trim() } : {}) });
      if (id !== testId.current) return;
      if (ids.length === 0) {
        // the fields stay as they are, saved model included
        setModels(null);
        setTestError(t("No models available for this key"));
        return;
      }
      if (voice) {
        const choices = voiceModelChoices(ids, { transcribe: transcribeModel, polish: polishModel }, { transcribe: voice.transcribe_model, polish: voice.polish_enabled ? voice.polish_model : null });
        setTranscribeModel(choices.transcribe);
        setPolishModel(choices.polish);
      }
      setModels(ids);
    } catch (e) {
      if (id !== testId.current) return;
      setModels(null);
      setTestError(e instanceof Error ? e.message : String(e));
    } finally { if (id === testId.current) setTesting(false); }
  };

  const send = async (update: VoiceConfigUpdate) => {
    invalidateList();
    setBusy(true);
    try {
      // the save answers the new status itself: no second request that could fail after it
      const saved = await saveVoiceConfig(update);
      setKey("");
      setError(null);
      setTestError(null);
      onSaved(saved);
      window.dispatchEvent(new Event(VOICE_CONFIG_EVENT));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const save = () => { if (voice) void send(voiceSaveBody(voice, { url, key, transcribe: transcribeModel, polish: polishModel, language })); };
  const useDefaults = () => void send({
    ...(key.trim() ? { api_key: key.trim() } : {}),
    base_url: null, transcribe_model: null, polish_model: null, polish_enabled: null, language: null,
  });

  const choices = models ? voicePartition(models) : null;
  const fromEnv = voice?.source === "env";
  const host = voice ? voiceHost(voice.base_url) : "";

  return (
    <div className="voice-group">
      <h4 className="voice-group-title">{t("Transcription server")}</h4>
      <div className="voice-group-body">
        {voice && !voice.error && (
          <p className="settings-hint voice-status">
            {!voice.configured
              ? t("No key saved: the browser's speech recognition is used")
              : fromEnv
                ? t("OpenAI key set by HERDR_WEB_OPENAI_API_KEY")
                : t("Saved on this PC: {host} · {model} · tidy {tidy}", { host, model: voice.transcribe_model, tidy: voice.polish_enabled ? voice.polish_model : t("off") })}
          </p>
        )}
        {voice?.error && <p className="settings-hint voice-error" role="alert">{voice.error}</p>}
        {voice && !fromEnv && (
          <form className="voice-server" onSubmit={(event) => { event.preventDefault(); save(); }}>
            <label className="voice-field"><span className="field-label">{t("Server URL")}</span>
              <input className="input" type="text" inputMode="url" value={url} placeholder={voice.error ? voice.base_url : VOICE_DEFAULTS.base_url} autoComplete="off" spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(event) => { setUrl(event.target.value); invalidateList(); }} />
            </label>
            <label className="voice-field"><span className="field-label">{t("API key")}</span>
              <input className="input" type="password" value={key} placeholder={voice.key_stored ? "••••" : "sk-..."} autoComplete="off" spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(event) => { setKey(event.target.value); invalidateList(); }} />
            </label>
            <div className="voice-test">
              <button type="button" className="btn" disabled={testing || busy} onClick={() => void test()}>{testing ? t("Testing…") : t("Test and list models")}</button>
              {models && <span className="settings-hint" role="status">{t("{count} models found", { count: models.length })}</span>}
            </div>
            {testError && <p className="settings-hint voice-error" role="alert">{testError}</p>}
            <label className="voice-field"><span className="field-label">{t("Transcription model")}</span>
              {choices ? (
                <select className="input" aria-label={t("Transcription model")} value={transcribeModel} onChange={(event) => setTranscribeModel(event.target.value)}>
                  {choices.speech.length > 0 && <optgroup label={t("Speech-to-text")}>{choices.speech.map((id) => <option key={id} value={id}>{id}</option>)}</optgroup>}
                  {choices.other.length > 0 && (choices.speech.length > 0 ? <optgroup label={t("Other models")}>{choices.other.map((id) => <option key={id} value={id}>{id}</option>)}</optgroup> : choices.other.map((id) => <option key={id} value={id}>{id}</option>))}
                </select>
              ) : (
                <input className="input" type="text" value={transcribeModel} autoComplete="off" spellCheck={false} onChange={(event) => setTranscribeModel(event.target.value)} />
              )}
            </label>
            <label className="voice-field"><span className="field-label">{t("Tidy model (optional)")}</span>
              {choices ? (
                <select className="input" aria-label={t("Tidy model (optional)")} value={polishModel} onChange={(event) => setPolishModel(event.target.value)}>
                  <option value="">{t("None (Tidy off)")}</option>
                  {models!.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
              ) : (
                <input className="input" type="text" value={polishModel} placeholder={t("Empty: Tidy off")} autoComplete="off" spellCheck={false} onChange={(event) => setPolishModel(event.target.value)} />
              )}
            </label>
            <label className="voice-field"><span className="field-label">{t("Dictation language")}</span>
              <select className="input" aria-label={t("Dictation language")} value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="">{t("Auto-detect")}</option>
                {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
            <div className="voice-actions">
              <button type="submit" className="btn btn-primary" disabled={busy || testing}>{t("Save")}</button>
              <button type="button" className="btn" disabled={busy} onClick={useDefaults}>{t("Use OpenAI defaults")}</button>
              <button type="button" className="btn btn-ghost" disabled={busy || !voice.key_stored} onClick={() => void send({ api_key: null })}>{t("Remove key")}</button>
            </div>
          </form>
        )}
        {error && <p className="settings-hint voice-error" role="alert">{error}</p>}
        <p className="settings-hint voice-privacy">
          {!voice || !voice.configured
            ? t("Without a key the browser recognizes the speech: Chrome and Edge send the audio to Google or Microsoft. Nothing is recorded until you press the mic.")
            : t("Audio is sent to {host} with your key. Nothing is recorded until you press the mic.", { host })}
        </p>
      </div>
    </div>
  );
}
