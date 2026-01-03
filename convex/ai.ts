import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getGlobalLogger } from "../src/lib/globalLogger";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const cardSchema = z.object({
  question: z
    .string()
    .describe("The question text with a blank represented as ___."),
  hint: z.string().describe("A short hint for the question."),
  explanation: z.string().describe("An explanation of the answer."),
  finalAnswer: z
    .string()
    .optional()
    .describe(
      "Optional: the inflected/changed answer to actually use when you adjusted the base-form input. Omit when unchanged."
    ),
});

const hintAndExplanationSchema = z.object({
  hint: z.string().describe("A short hint for the question."),
  explanation: z
    .string()
    .describe(
      "An explanation of the answer, why it fits, and simple guidance."
    ),
});

const hintSchema = z.object({
  hint: z.string().describe("A short hint for the question."),
});

const explanationSchema = z.object({
  explanation: z
    .string()
    .describe(
      "An explanation of the answer, why it fits, and simple guidance."
    ),
});

const GEMINI_MODEL = "gemini-3-pro-preview";
const logger = getGlobalLogger();

/**
 * System Instruction for the AI model.
 * This should be passed to config.systemInstruction.
 */
const systemInstruction = `
### Role
You are an expert English linguist specialized in creating high-quality vocabulary flashcards for learners.

### Task & Logic
1. **Analyze Form**: Determine if the input is a single-word base form (infinitive verb or singular noun).
2. **Inflection Rule**: 
   - If (and only if) changing the tense or number makes the sentence significantly more natural, update the form (e.g., "apply" -> "applied").
   - If the input is multi-word or already specific (e.g., "went", "apple tree"), reuse them exactly as-is.
3. **Context Awareness**: If a context is provided (e.g., "친구에게 조언하는 상황", "회의에서 제안하는 말투"), use it consistently across all generated content (question, hint, explanation).
4. **Generate Content**:
   - **question**: A context-rich sentence (approx. 10-35 words). **Crucial**: Use natural yet nuanced grammar. Create specific, vivid, and non-obvious scenarios. Use a conversational, natural tone. Avoid stiff or overly academic phrasing. Use "___" for the blank.
   - **hint**: A simple definition or synonym under 12 words. Do not include the answer.
   - **explanation**: 10-50 words. Define the meaning and explain the nuance of why this specific form or tense is the most appropriate for the described scenario.
   - **finalAnswer**: Only if you changed the input form, provide the updated form here.

### Few-Shot Example 1 (Base Verb)

- Input: surpass
- question: Although the initial projections were modest, the quarterly earnings significantly ___ even the most optimistic forecasts from the board of directors.
- hint: To be better or greater than something else.
- explanation: "Surpass" means to exceed. The past tense surpassed is used here because the sentence references "initial projections," indicating a completed event in a financial report context.
- finalAnswer: surpassed
`.trim();

const buildPrompt = (answer: string, context?: string): string => {
  let prompt = `Target Word/Phrase: "${answer.trim()}"`;
  if (context && context.trim()) {
    prompt += `\nContext/Situation: "${context.trim()}"`;
  }
  return prompt;
};

export const generateCardDraft = action({
  args: { answer: v.string(), context: v.optional(v.string()) },

  returns: v.object({
    question: v.string(),
    hint: v.string(),
    explanation: v.string(),
    finalAnswer: v.optional(v.string()),
  }),

  handler: async (_ctx, args) => {
    const answer = args.answer.trim();
    const context = args.context?.trim();
    const runId =
      "ai:generateCardDraft:" + Math.random().toString(36).slice(2, 8);
    if (!answer) {
      throw new Error("정답을 입력해주세요.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }

    logger.info(runId, {
      stage: "start",
      model: GEMINI_MODEL,
      answerLength: answer.length,
      hasContext: !!context,
    });

    const prompt = buildPrompt(answer, context);

    logger.info(runId, {
      stage: "prompt_built",
      promptPreview: prompt.slice(0, 120),
    });

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: zodToJsonSchema(cardSchema),
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        systemInstruction,
      },
    });

    logger.info(runId, {
      stage: "response_received",
      text: response.text,
      usage: response.usageMetadata,
    });

    if (!response.text) {
      throw new Error("Gemini 응답이 비어있습니다.");
    }

    const card = cardSchema.parse(JSON.parse(response.text));

    logger.info(runId, {
      stage: "card parsed",
      questionPreview: card.question.slice(0, 60),
      hintPreview: card.hint.slice(0, 40),
      finalAnswerApplied: card.finalAnswer,
    });

    return card;
  },
});

const buildHintPrompt = (question: string, answer: string): string =>
  [
    "You help me refine flashcard hints.",
    `Question text (includes a blank as ___): "${question.trim()}"`,
    `Correct answer to fit the blank: "${answer.trim()}"`,
    "Hint: under 12 English words, give a nudge without revealing the answer.",
  ].join("\n");

const buildExplanationPrompt = (question: string, answer: string): string =>
  [
    "You help me refine flashcard explanations.",
    `Question text (includes a blank as ___): "${question.trim()}"`,
    `Correct answer to fit the blank: "${answer.trim()}"`,
    "Explanation: 30-50 simple English words explaining meaning and why the answer fits the blank. Avoid repeating the question verbatim.",
  ].join("\n");

const requireInputs = (question: string, answer: string) => {
  if (!question.trim()) {
    throw new Error("질문을 입력해주세요.");
  }
  if (!answer.trim()) {
    throw new Error("정답을 입력해주세요.");
  }
};

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }
  return new GoogleGenAI({ apiKey });
};

export const regenerateHint = action({
  args: { question: v.string(), answer: v.string() },
  returns: v.object({ hint: v.string() }),
  handler: async (_ctx, args) => {
    const question = args.question.trim();
    const answer = args.answer.trim();
    const runId = "ai:regenerateHint:" + Math.random().toString(36).slice(2, 8);

    requireInputs(question, answer);

    logger.info(runId, {
      stage: "start",
      model: GEMINI_MODEL,
      questionLength: question.length,
      answerLength: answer.length,
    });

    const prompt = buildHintPrompt(question, answer);

    logger.info(runId, {
      stage: "prompt_built",
      promptPreview: prompt.slice(0, 120),
    });

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: zodToJsonSchema(hintSchema),
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    if (!response.text) {
      throw new Error("Gemini 응답이 비어있습니다.");
    }

    const result = hintSchema.parse(JSON.parse(response.text));

    logger.info(runId, {
      stage: "parsed",
      hintPreview: result.hint.slice(0, 60),
    });

    return result;
  },
});

export const regenerateExplanation = action({
  args: { question: v.string(), answer: v.string() },
  returns: v.object({ explanation: v.string() }),
  handler: async (_ctx, args) => {
    const question = args.question.trim();
    const answer = args.answer.trim();
    const runId =
      "ai:regenerateExplanation:" + Math.random().toString(36).slice(2, 8);

    requireInputs(question, answer);

    logger.info(runId, {
      stage: "start",
      model: GEMINI_MODEL,
      questionLength: question.length,
      answerLength: answer.length,
    });

    const prompt = buildExplanationPrompt(question, answer);

    logger.info(runId, {
      stage: "prompt_built",
      promptPreview: prompt.slice(0, 120),
    });

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: zodToJsonSchema(explanationSchema),
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    if (!response.text) {
      throw new Error("Gemini 응답이 비어있습니다.");
    }

    const result = explanationSchema.parse(JSON.parse(response.text));

    logger.info(runId, {
      stage: "parsed",
      explanationPreview: result.explanation.slice(0, 80),
    });

    return result;
  },
});

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

    prompt.push(
      "Generate both hint (under 12 English words, give a nudge without revealing the answer) and explanation (30-50 simple English words explaining meaning and why the answer fits the blank). Ensure they align with the provided context."
    );

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
        systemInstruction,
      },
    });

    if (!response.text) {
      throw new Error("Gemini 응답이 비어있습니다.");
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

/**
 * Multi-expression generation: Korean → English expression candidates
 */
const expressionCandidatesSchema = z.object({
  expressions: z
    .array(z.string())
    .describe(
      "Array of 3 natural English expressions/phrases that convey the Korean input meaning"
    ),
});

export const generateExpressionCandidates = action({
  args: {
    koreanInput: v.string(),
    context: v.optional(v.string()),
  },
  returns: v.object({
    expressions: v.array(v.string()),
  }),
  handler: async (_ctx, args) => {
    const koreanInput = args.koreanInput.trim();
    const context = args.context?.trim();
    const runId =
      "ai:generateExpressionCandidates:" +
      Math.random().toString(36).slice(2, 8);

    if (!koreanInput) {
      throw new Error("한국어 표현을 입력해주세요.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }

    logger.info(runId, {
      stage: "start",
      model: GEMINI_MODEL,
      koreanInputLength: koreanInput.length,
      hasContext: !!context,
    });

    const prompt = [
      "You are an expert English linguist helping Korean learners find natural English expressions.",
      `Korean expression/intent: "${koreanInput}"`,
    ];

    if (context) {
      prompt.push(`Context/Situation: "${context}"`);
    }

    prompt.push(
      "Generate exactly 3 natural, idiomatic English expressions or phrases that convey this meaning. Vary the formality and style. Focus on expressions that would be useful in real conversation or writing."
    );

    const promptStr = prompt.join("\n");

    logger.info(runId, {
      stage: "prompt_built",
      promptPreview: promptStr.slice(0, 120),
    });

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: promptStr,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: zodToJsonSchema(expressionCandidatesSchema),
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    if (!response.text) {
      throw new Error("Gemini 응답이 비어있습니다.");
    }

    const result = expressionCandidatesSchema.parse(JSON.parse(response.text));

    logger.info(runId, {
      stage: "parsed",
      expressionsCount: result.expressions.length,
      expressions: result.expressions,
    });

    return result;
  },
});
