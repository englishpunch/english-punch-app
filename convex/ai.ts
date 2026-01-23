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

const GEMINI_MODEL = "gemini-3-pro-preview";
const logger = getGlobalLogger();

// TODO: South Korean 을 인자로 빼기
const systemInstructionPart = {
  role: `
### Role
You are an expert English linguist specialized in creating high-quality vocabulary flashcards for learners.
`.trim(),
  question: `- question: fill-in-the-blank example consisting of 1-2 sentences with a blank (___) for the target word/phrase.
  - Constraints
    1. Context Clues: The blank (___) must be the only logical conclusion based on the preceding text.
    2. Vocabulary: Keep language simple and accessible (CEFR B1-B2 level).
    3. Diversity: Vary the speaker's persona significantly (e.g., a frustrated mechanic, a hopeful student, a strict grandmother).`,
  hint: `- hint: A simple definition or synonym under 12 words. Do not include the answer.`,
  explanation: `- explanation: total 10-70w; Specify scenario suitability(exclude situation description); differentiation - Contrast at least 2 synonyms (nuance/tone/intensity).`,
  finalAnswer: `- finalAnswer: Only if you changed the input form, provide the updated form here.`,
  contextAwareness: `Context Awareness: If a context/situation is provided (e.g., "친구에게 조언하는 상황", "회의에서 제안하는 말투"), use it consistently across all generated content`,
};

/**
 * System Instruction for the AI model.
 */
const generateAllSystemInstruction = `
${systemInstructionPart.role}

### Task
1. Inflection Rule: If changing the tense or number makes the sentence significantly more natural, update the form (e.g., "apply" -> "applied").
2. ${systemInstructionPart.contextAwareness}
3. **Generate Content**:
   ${systemInstructionPart.question}
   ${systemInstructionPart.hint}
   ${systemInstructionPart.explanation}
   ${systemInstructionPart.finalAnswer}
`.trim();

const regenerateHintAndExplanationSystemInstruction = `
${systemInstructionPart.role}

### Task
1. ${systemInstructionPart.contextAwareness}
2. **Generate both hint and explanation**:
   ${systemInstructionPart.hint}
   ${systemInstructionPart.explanation}
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

    requireApiKey();

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

    const ai = getAiClient();

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: zodToJsonSchema(cardSchema),
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        systemInstruction: generateAllSystemInstruction,
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

    const cardResponse = cardSchema.parse(JSON.parse(response.text));

    // Sanitize finalAnswer to handle string "null" or "undefined"
    const card = {
      ...cardResponse,
      finalAnswer:
        cardResponse.finalAnswer === "null" ||
        cardResponse.finalAnswer === "undefined" ||
        cardResponse.finalAnswer === ""
          ? undefined
          : cardResponse.finalAnswer,
    };

    logger.info(runId, {
      stage: "card parsed",
      questionPreview: card.question.slice(0, 60),
      hintPreview: card.hint.slice(0, 40),
      finalAnswerApplied: card.finalAnswer,
    });

    return card;
  },
});

const requireInputs = (question: string, answer: string) => {
  if (!question.trim()) {
    throw new Error("질문을 입력해주세요.");
  }
  if (!answer.trim()) {
    throw new Error("정답을 입력해주세요.");
  }
};

const requireApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
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
 * Multi-expression generation: Input (Korean or English) → English expression candidates
 */
const expressionCandidatesSchema = z.object({
  expressions: z
    .array(z.string())
    .describe(
      "Array of 3 natural English expressions/phrases that convey the input meaning"
    ),
});

const expressionCandidatesSystemInstruction = `
You are an expert English linguist helping learners find natural English expressions.
Your task is to generate exactly 3 natural, idiomatic English expressions or phrases.
Vary the formality and style. Focus on expressions that would be useful in real conversation or writing.
`.trim();

export const generateExpressionCandidates = action({
  args: {
    input: v.string(),
    context: v.optional(v.string()),
  },
  returns: v.object({
    expressions: v.array(v.string()),
  }),
  handler: async (_ctx, args) => {
    const input = args.input.trim();
    const context = args.context?.trim();
    const runId =
      "ai:generateExpressionCandidates:" +
      Math.random().toString(36).slice(2, 8);

    if (!input) {
      throw new Error("표현을 입력해주세요.");
    }

    requireApiKey();

    logger.info(runId, {
      stage: "start",
      model: GEMINI_MODEL,
      inputLength: input.length,
      hasContext: !!context,
    });

    const prompt = [`Expression/intent: "${input}"`];

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
        responseJsonSchema: zodToJsonSchema(expressionCandidatesSchema),
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        systemInstruction: expressionCandidatesSystemInstruction,
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
