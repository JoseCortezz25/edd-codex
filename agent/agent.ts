import { defineAgent } from "eve";
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default defineAgent({
  model: openai('gpt-5.6-luna'),
  reasoning: 'low',
  compaction: {
    thresholdPercent: 0.75,
  },
});
