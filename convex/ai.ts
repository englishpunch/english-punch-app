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

const hintExplanationSchema = z.object({
  hint: z.string().describe("A short hint for the question."),
  explanation: z
    .string()
    .describe(
      "An explanation of the answer, why it fits, and simple guidance."
    ),
});

const GEMINI_MODEL = "gemini-3-pro-preview";
const logger = getGlobalLogger();

const buildPrompt = (answer: string): string => {
  const trimmed = answer.trim();
  return [
    "You help me create English flashcards.",
    `User provided answer (may be base form): "${trimmed}".`,
    "You may change the answer only when all of these are true: it is a single-word base form (infinitive verb or singular noun), changing tense/number makes the sentence more natural, and the new form stays aligned with the original meaning.",
    "Never change multi-word answers or answers that are already inflected/specific; reuse them as-is.",
    "If you change the answer, set finalAnswer to the new form and write the question, hint, and explanation using that finalAnswer. Otherwise omit finalAnswer.",
    "Question: 20-30 English words, natural sentences, include one blank written as ___, never reveal the answer.",
    "Hint: short, easy English under 12 words; do not include the answer.",
    "Explanation: 30-50 simple English words; define meaning and how it fits the blank;",
  ].join("\n");
};

export const generateCardDraft = action({
  args: { answer: v.string() },

  returns: v.object({
    question: v.string(),
    hint: v.string(),
    explanation: v.string(),
    finalAnswer: v.optional(v.string()),
  }),

  handler: async (_ctx, args) => {
    const answer = args.answer.trim();
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
    });

    const prompt = buildPrompt(answer);

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

const buildHintExplanationPrompt = (question: string, answer: string): string =>
  [
    "You help me refine flashcards.",
    `Question text (includes a blank as ___): "${question.trim()}"`,
    `Correct answer to fit the blank: "${answer.trim()}"`,
    "Return only JSON. Do not include the answer directly in the hint or explanation.",
    "Hint: under 12 English words, give a nudge without revealing the answer.",
    "Explanation: 30-50 simple English words explaining the meaning and why the answer fits the blank. Avoid repeating the question verbatim.",
  ].join("\n");

export const regenerateHintAndExplanation = action({
  args: { question: v.string(), answer: v.string() },
  returns: v.object({
    hint: v.string(),
    explanation: v.string(),
  }),
  handler: async (_ctx, args) => {
    const question = args.question.trim();
    const answer = args.answer.trim();
    const runId =
      "ai:regenerateHintAndExplanation:" +
      Math.random().toString(36).slice(2, 8);

    if (!question) {
      throw new Error("질문을 입력해주세요.");
    }

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
      questionLength: question.length,
      answerLength: answer.length,
    });

    const prompt = buildHintExplanationPrompt(question, answer);

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
        responseJsonSchema: zodToJsonSchema(hintExplanationSchema),
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    if (!response.text) {
      throw new Error("Gemini 응답이 비어있습니다.");
    }

    const result = hintExplanationSchema.parse(JSON.parse(response.text));

    logger.info(runId, {
      stage: "parsed",
      hintPreview: result.hint.slice(0, 60),
      explanationPreview: result.explanation.slice(0, 80),
    });

    return result;
  },
});
