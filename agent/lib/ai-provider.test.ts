import { describe, expect, it } from "vitest";
import {
  AiProvider,
  OpenAiModel,
  OpenCodeModel,
  createAgentModel,
  isTextOnlyModel,
  resolveProvider,
  selectedModelId,
} from "./ai-provider";

describe("resolveProvider", () => {
  it("defaults to opencode when AI_PROVIDER is unset", () => {
    expect(resolveProvider({})).toBe(AiProvider.OpenCode);
  });

  it("reads openai and opencode case-insensitively and trimmed", () => {
    expect(resolveProvider({ AI_PROVIDER: "openai" })).toBe(AiProvider.OpenAi);
    expect(resolveProvider({ AI_PROVIDER: "  OpenCode " })).toBe(
      AiProvider.OpenCode,
    );
  });

  it("throws on an unknown provider", () => {
    expect(() => resolveProvider({ AI_PROVIDER: "anthropic" })).toThrow(
      /Unknown AI_PROVIDER "anthropic"/,
    );
  });
});

describe("selectedModelId", () => {
  it("returns the hardcoded model for each provider", () => {
    expect(selectedModelId(AiProvider.OpenAi)).toBe(OpenAiModel.Gpt56Luna);
    expect(selectedModelId(AiProvider.OpenCode)).toBe(OpenCodeModel.Glm53Flash);
  });
});

describe("isTextOnlyModel", () => {
  it("flags glm-5.3-flash as text-only", () => {
    expect(isTextOnlyModel(OpenCodeModel.Glm53Flash)).toBe(true);
  });

  it("treats the multimodal GPT families as not text-only", () => {
    expect(isTextOnlyModel(OpenAiModel.Gpt56Luna)).toBe(false);
    expect(isTextOnlyModel(OpenAiModel.Gpt6Astra)).toBe(false);
  });
});

describe("createAgentModel", () => {
  it("builds the OpenCode model without needing an OpenAI key", () => {
    const model = createAgentModel({ OPENCODE_GO_API_KEY: "test-key" });
    expect(model).toBeDefined();
  });

  it("builds the OpenAI model when selected", () => {
    const model = createAgentModel({
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "test-key",
    });
    expect(model).toBeDefined();
  });

  it("fails loudly when the selected provider's key is missing", () => {
    expect(() => createAgentModel({ AI_PROVIDER: "openai" })).toThrow(
      /OPENAI_API_KEY is required/,
    );
    expect(() => createAgentModel({})).toThrow(
      /OPENCODE_GO_API_KEY is required/,
    );
  });
});
