import { defineAgent } from "eve";
import { createAgentModel } from "#lib/ai-provider";

export default defineAgent({
  model: createAgentModel(),
  modelContextWindowTokens: 1_000_000,
  reasoning: 'low',
  compaction: {
    thresholdPercent: 0.75,
  },
});
