import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getGlobalLogger } from "../src/lib/globalLogger";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const hintAndExplanationSchema = z.object({
  hint: z.string().describe("A short hint for the question."),
  explanation: z
    .string()
    .describe(
      "An explanation of the answer, why it fits, and simple guidance."
    ),
});

const GEMINI_MODEL = "gemini-3.1-pro-preview";
const logger = getGlobalLogger();

// TODO: Make the learner locale configurable.
const systemInstructionPart = {
  role: `
### Role
You are an expert English linguist specialized in creating high-quality vocabulary flashcards for learners.
`.trim(),
  hint: `- hint: A simple definition or synonym under 12 words. Do not include the answer.`,
  explanation: `- explanation: total 10-70w; Specify scenario suitability(exclude situation description); differentiation - Contrast at least 2 synonyms (nuance/tone/intensity).`,
  contextAwareness: `Context Awareness: If a context/situation is provided (e.g., "advising a friend", "making a suggestion in a meeting"), use it consistently across all generated content`,
};

const regenerateHintAndExplanationSystemInstruction = `
${systemInstructionPart.role}

### Task
1. ${systemInstructionPart.contextAwareness}
2. **Generate both hint and explanation**:
   ${systemInstructionPart.hint}
   ${systemInstructionPart.explanation}
`.trim();

const requireInputs = (question: string, answer: string) => {
  if (!question.trim()) {
    throw new Error("Please enter the question.");
  }
  if (!answer.trim()) {
    throw new Error("Please enter the answer.");
  }
};

const requireApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return apiKey;
};

const getAiClient = () => {
  const apiKey = requireApiKey();
  return new GoogleGenAI({ apiKey });
};

/**
 * One-shot regeneration of both hint and explanation
 * Uses the unified system instruction for consistency
 */
export const regenerateHintAndExplanation = action({
  args: {
    question: v.string(),
    answer: v.string(),
    context: v.optional(v.string()),
  },
  returns: v.object({
    hint: v.string(),
    explanation: v.string(),
  }),
  handler: async (_ctx, args) => {
    const question = args.question.trim();
    const answer = args.answer.trim();
    const context = args.context?.trim();
    const runId =
      "ai:regenerateHintAndExplanation:" +
      Math.random().toString(36).slice(2, 8);

    requireInputs(question, answer);

    logger.info(runId, {
      stage: "start",
      model: GEMINI_MODEL,
      questionLength: question.length,
      answerLength: answer.length,
      hasContext: !!context,
    });

    // Build prompt with context awareness
    const prompt = [
      "You help me refine flashcard hints and explanations.",
      `Question text (includes a blank as ___): "${question}"`,
      `Correct answer to fit the blank: "${answer}"`,
    ];

    if (context) {
      prompt.push(`Context/Situation: "${context}"`);
    }

    const promptStr = prompt.join("\n");

    logger.info(runId, {
      stage: "prompt_built",
      promptPreview: promptStr.slice(0, 120),
    });

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: promptStr,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: zodToJsonSchema(hintAndExplanationSchema),
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        systemInstruction: regenerateHintAndExplanationSystemInstruction,
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    const result = hintAndExplanationSchema.parse(JSON.parse(response.text));

    logger.info(runId, {
      stage: "parsed",
      hintPreview: result.hint.slice(0, 60),
      explanationPreview: result.explanation.slice(0, 80),
    });

    return result;
  },
});
