import { describe, expect, it } from "bun:test";
import { voiceHost, voiceModelChoices } from "./voiceServer.ts";

const IDS = ["gemma4-12b", "gpt-6-luna", "whisper-ptbr", "whisper-ptbr-simples", "my-stt"];

describe("voiceModelChoices", () => {
  it("lists speech-to-text ids apart and keeps the saved model when the server has it", () => {
    const choices = voiceModelChoices(IDS, { transcribe: "whisper-ptbr", polish: "gpt-6-luna" });
    expect(choices).toEqual({ speech: ["whisper-ptbr", "whisper-ptbr-simples", "my-stt"], other: ["gemma4-12b", "gpt-6-luna"], transcribe: "whisper-ptbr", polish: "gpt-6-luna" });
  });

  it("falls back to the fork's transcription model, then to the first speech id; Tidy to None", () => {
    expect(voiceModelChoices(IDS, { transcribe: "gpt-transcribe", polish: "gpt-6-luna-x" })).toMatchObject({ transcribe: "whisper-ptbr-simples", polish: "" });
    expect(voiceModelChoices(["a", "x-whisper", "b"], { transcribe: "gpt-transcribe", polish: "none-here" })).toMatchObject({ transcribe: "x-whisper", polish: "" });
    expect(voiceModelChoices(["a", "b"], { transcribe: "gpt-transcribe", polish: "q" })).toMatchObject({ transcribe: "a", polish: "" });
  });

  it("keeps Tidy off when it was saved off", () => {
    expect(voiceModelChoices(IDS, { transcribe: "whisper-ptbr", polish: null }).polish).toBe("");
  });
});

describe("voiceHost", () => {
  it("names the host and port", () => {
    expect(voiceHost("http://100.1.2.3:4000/v1")).toBe("100.1.2.3:4000");
    expect(voiceHost("not a url")).toBe("not a url");
  });
});
