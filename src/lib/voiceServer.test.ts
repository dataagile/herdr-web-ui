import { describe, expect, it } from "bun:test";
import type { VoiceStatus } from "../../shared/voice.ts";
import { voiceFieldsOf, voiceHost, voiceModelChoices, voicePartition, voiceSaveBody } from "./voiceServer.ts";

const IDS = ["gemma4-12b", "gpt-6-luna", "whisper-ptbr", "whisper-ptbr-simples", "my-stt"];
const was = (over: Partial<VoiceStatus> = {}): VoiceStatus => ({
  configured: true, source: "file", base_url: "https://api.openai.com/v1", transcribe_model: "gpt-transcribe", polish_model: "gpt-6-luna",
  polish_enabled: true, language: null, error: null, key_stored: true, ...over,
});

describe("voiceModelChoices", () => {
  it("lists speech-to-text ids apart and keeps the field's value when the server has it", () => {
    const choices = voiceModelChoices(IDS, { transcribe: "whisper-ptbr", polish: "gpt-6-luna" }, { transcribe: "my-stt", polish: "gemma4-12b" });
    expect(choices).toEqual({ speech: ["whisper-ptbr", "whisper-ptbr-simples", "my-stt"], other: ["gemma4-12b", "gpt-6-luna"], transcribe: "whisper-ptbr", polish: "gpt-6-luna" });
  });

  it("falls back to the saved model, then the fork's, then the first speech id; Tidy to the saved one, then None", () => {
    expect(voiceModelChoices(IDS, { transcribe: "x", polish: "y" }, { transcribe: "my-stt", polish: "gemma4-12b" })).toMatchObject({ transcribe: "my-stt", polish: "gemma4-12b" });
    expect(voiceModelChoices(IDS, { transcribe: "gpt-transcribe", polish: "q" }, { transcribe: "gpt-transcribe", polish: "gpt-6-luna-x" })).toMatchObject({ transcribe: "whisper-ptbr-simples", polish: "" });
    expect(voiceModelChoices(["a", "x-whisper", "b"], { transcribe: "t", polish: "" }, { transcribe: "t", polish: null })).toMatchObject({ transcribe: "x-whisper", polish: "" });
    expect(voiceModelChoices(["a", "b"], { transcribe: "t", polish: "" }, { transcribe: "t", polish: null })).toMatchObject({ transcribe: "a", polish: "" });
  });

  it("keeps a Tidy None the user chose even when a model is saved", () => {
    expect(voiceModelChoices(IDS, { transcribe: "whisper-ptbr", polish: "" }, { transcribe: "whisper-ptbr", polish: "gemma4-12b" }).polish).toBe("");
  });
});

describe("voiceSaveBody", () => {
  it("sends nothing the user did not change: an env base_url and a language-only save", () => {
    const status = was({ base_url: "http://10.0.0.5:4000/v1", transcribe_model: "whisper-ptbr", polish_enabled: false });
    const fields = voiceFieldsOf(status);
    expect(voiceSaveBody(status, { ...fields, language: "pt" })).toEqual({ language: "pt" });
  });

  it("sends nothing about the server for a legacy stored base_url either", () => {
    const status = was({ base_url: "http://legacy.example.com/v1" });
    expect(voiceSaveBody(status, { ...voiceFieldsOf(status), language: "ko" })).toEqual({ language: "ko" });
  });

  it("a key-only save pins no model and no base_url", () => {
    const status = was({ configured: false });
    expect(voiceSaveBody(status, { ...voiceFieldsOf(status), key: " sk-new " })).toEqual({ api_key: "sk-new" });
  });

  it("sends a changed URL, models and Tidy; None turns Tidy off; an emptied URL resets", () => {
    const status = was({ base_url: "http://10.0.0.5:4000/v1" });
    const fields = voiceFieldsOf(status);
    expect(voiceSaveBody(status, { ...fields, url: "", transcribe: "whisper-ptbr", polish: "gemma4-12b" })).toEqual({
      base_url: null, transcribe_model: "whisper-ptbr", polish_model: "gemma4-12b", polish_enabled: true,
    });
    expect(voiceSaveBody(status, { ...fields, polish: "" })).toEqual({ polish_enabled: false });
  });
});

describe("a refused saved URL", () => {
  const refused = was({ configured: false, base_url: "http://public.example.com/v1", error: "refused" });
  it("starts the URL field empty and always sends base_url with the typed key", () => {
    expect(voiceFieldsOf(refused).url).toBe("");
    expect(voiceSaveBody(refused, { ...voiceFieldsOf(refused), key: "sk-k" })).toMatchObject({ api_key: "sk-k", base_url: null });
    expect(voiceSaveBody(refused, { ...voiceFieldsOf(refused), key: "sk-k", url: "https://x.example/v1" })).toMatchObject({ api_key: "sk-k", base_url: "https://x.example/v1" });
  });
});

describe("voicePartition", () => {
  it("splits speech-to-text ids from the rest", () => {
    expect(voicePartition(IDS)).toEqual({ speech: ["whisper-ptbr", "whisper-ptbr-simples", "my-stt"], other: ["gemma4-12b", "gpt-6-luna"] });
  });
});

describe("voiceHost", () => {
  it("names the host and port", () => {
    expect(voiceHost("http://100.1.2.3:4000/v1")).toBe("100.1.2.3:4000");
    expect(voiceHost("not a url")).toBe("not a url");
  });
});
