import { defineAgent } from "eve";
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { wrapLanguageModel } from "ai";
import { randomUUID } from "node:crypto";
import { textOnlyPromptMiddleware } from "#lib/text-only-prompt";

const sessionId = randomUUID();

const opencodeGo = createOpenAICompatible({
  name: 'opencode-go',
  baseURL: 'https://opencode.ai/zen/go/v1',
  apiKey: process.env.OPENCODE_GO_API_KEY,
  headers: {
    "x-opencode-session": sessionId,
    "x-opencode-client": "edd-eve-agent",
    "user-agent": "edd-eve-agent/0.0.0",
  },
});

const chatModel = opencodeGo.chatModel('glm-5.3-flash');

// glm-5.3-flash is text-only: its upstream rejects any non-string message
// content ("Input should be a valid string"), so attachments and multi-part
// messages are rewritten to plain text first. Set to false when switching to a
// vision-capable model that accepts image/file content arrays.
const MODEL_IS_TEXT_ONLY = true;

export default defineAgent({
  model: MODEL_IS_TEXT_ONLY
    ? wrapLanguageModel({ model: chatModel, middleware: textOnlyPromptMiddleware })
    : chatModel,
  modelContextWindowTokens: 1_000_000,
  reasoning: 'low',
  compaction: {
    thresholdPercent: 0.75,
  },
});
