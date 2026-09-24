import { defineAgent } from "eve";
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { randomUUID } from "node:crypto";

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

export default defineAgent({
  model: opencodeGo.chatModel('glm-5.3-flash'),
  modelContextWindowTokens: 1_000_000,
  reasoning: 'low',
  compaction: {
    thresholdPercent: 0.75,
  },
});
