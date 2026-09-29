import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { wrapLanguageModel, type LanguageModel } from "ai";
import { randomUUID } from "node:crypto";
import { textOnlyPromptMiddleware } from "#lib/text-only-prompt";

/**
 * Factory for the agent's language model.
 *
 * The provider is chosen at runtime by the `AI_PROVIDER` env var; the model id
 * for each provider is fixed in code (the enums below). Adding `createAgentModel`
 * to `defineAgent` keeps `agent.ts` free of provider wiring.
 */

/** Providers selectable through `AI_PROVIDER`. */
export enum AiProvider {
  OpenAi = "openai",
  OpenCode = "opencode",
}

/**
 * OpenAI native catalog — GPT-5.6 and GPT-6 families (source: models.dev).
 * These call OpenAI directly and require `OPENAI_API_KEY`.
 */
export enum OpenAiModel {
  Gpt56Luna = "gpt-5.6-luna",
  Gpt56Sol = "gpt-5.6-sol",
  Gpt56Terra = "gpt-5.6-terra",
  Gpt6Luna = "gpt-6-luna",
  Gpt6Sol = "gpt-6-sol",
  Gpt6Astra = "gpt-6-astra",
  Gpt6AstraFast = "gpt-6-astra-fast",
}

/**
 * OpenCode Go (the zen "go" subscription tier) — a curated subset of the ids
 * the app uses. OpenCode Zen is an aggregator with no in-house models, so this
 * is a hand-picked list, not the full ~113-model catalog. Add ids here as
 * needed; the live tier catalog is at `https://opencode.ai/zen/go/v1/models`.
 */
export enum OpenCodeModel {
  Glm53Flash = "glm-5.3-flash",
  Glm53 = "glm-5.3",
  DeepseekV41Flash = "deepseek-v4.1-flash",
  Gpt56Luna = "gpt-5.6-luna",
}

/** The hardcoded model each provider runs. Change these to switch models. */
const OPENAI_MODEL: OpenAiModel = OpenAiModel.Gpt56Luna;
const OPENCODE_MODEL: OpenCodeModel = OpenCodeModel.Glm53Flash;

/** Default provider when `AI_PROVIDER` is unset (preserves current behavior). */
const DEFAULT_PROVIDER = AiProvider.OpenCode;

/**
 * Models whose upstream rejects non-string message content, so attachments and
 * multi-part messages must be rewritten to plain text first (see
 * `text-only-prompt`). The GPT-5.6/6 families are multimodal and stay off this
 * list. `glm-5.3-flash` is text-only.
 */
const TEXT_ONLY_MODELS: ReadonlySet<string> = new Set<string>([
  OpenCodeModel.Glm53Flash,
]);

/** One session id per process, sent to OpenCode Go for request grouping. */
const sessionId = randomUUID();

export function resolveProvider(
  env: NodeJS.ProcessEnv = process.env,
): AiProvider {
  const raw = env.AI_PROVIDER?.trim().toLowerCase();
  if (!raw) return DEFAULT_PROVIDER;
  if (raw === AiProvider.OpenAi) return AiProvider.OpenAi;
  if (raw === AiProvider.OpenCode) return AiProvider.OpenCode;
  throw new Error(
    `Unknown AI_PROVIDER "${env.AI_PROVIDER}". Use "${AiProvider.OpenAi}" or "${AiProvider.OpenCode}".`,
  );
}

/** The fixed model id the given provider runs. */
export function selectedModelId(provider: AiProvider): string {
  return provider === AiProvider.OpenAi ? OPENAI_MODEL : OPENCODE_MODEL;
}

export function isTextOnlyModel(modelId: string): boolean {
  return TEXT_ONLY_MODELS.has(modelId);
}

function requireEnv(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required when AI_PROVIDER selects this provider.`,
    );
  }
  return value;
}

function createOpenAiModel(env: NodeJS.ProcessEnv) {
  const openai = createOpenAI({ apiKey: requireEnv("OPENAI_API_KEY", env) });
  // Chat Completions keeps parity with the OpenCode path so the text-only
  // middleware and tool loop behave the same across providers.
  return openai.chat(OPENAI_MODEL);
}

function createOpenCodeModel(env: NodeJS.ProcessEnv) {
  const opencodeGo = createOpenAICompatible({
    name: "opencode-go",
    baseURL: "https://opencode.ai/zen/go/v1",
    apiKey: requireEnv("OPENCODE_GO_API_KEY", env),
    headers: {
      "x-opencode-session": sessionId,
      "x-opencode-client": "edd-eve-agent",
      "user-agent": "edd-eve-agent/0.0.0",
    },
  });
  return opencodeGo.chatModel(OPENCODE_MODEL);
}

/**
 * Build the agent's model from `AI_PROVIDER`, applying the text-only middleware
 * when the selected model cannot accept multi-part content.
 */
export function createAgentModel(
  env: NodeJS.ProcessEnv = process.env,
): LanguageModel {
  const provider = resolveProvider(env);
  const model =
    provider === AiProvider.OpenAi
      ? createOpenAiModel(env)
      : createOpenCodeModel(env);

  return isTextOnlyModel(selectedModelId(provider))
    ? wrapLanguageModel({ model, middleware: textOnlyPromptMiddleware })
    : model;
}
