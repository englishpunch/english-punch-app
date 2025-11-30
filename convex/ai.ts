import { action } from "./_generated/server";
import { v } from "convex/values";

const GEMINI_MODEL = "gemini-3-pro-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const buildPrompt = (answer: string): string => {
  const trimmed = answer.trim();
  return [
    "You help Korean learners create English flashcards.",
    `Correct answer: "${trimmed}".`,
    "Return ONLY strict JSON with keys question, hint, explanation. No code fences or prose.",
    "Question: 20-30 English words, natural sentences, include a single blank written as ___, never reveal the answer.",
    "Hint: short, easy English under 12 words; do not include the answer.",
    "Explanation: 30-50 simple English words; may include the answer plainly; define meaning and how it fits the blank.",
    "Output JSON example: {\"question\":\"...___...\",\"hint\":\"...\",\"explanation\":\"...\"}"
  ].join("\n");
};

const extractDraft = (text: string) => {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini 응답을 파싱하지 못했습니다.");

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  const question = parsed.question;
  const hint = parsed.hint;
  const explanation = parsed.explanation;

  if (
    typeof question !== "string" ||
    typeof hint !== "string" ||
    typeof explanation !== "string"
  ) {
    throw new Error("Gemini 응답 형식이 올바르지 않습니다.");
  }

  return { question, hint, explanation };
};

export const generateCardDraft = action({
  args: { answer: v.string() },
  returns: v.object({
    question: v.string(),
    hint: v.string(),
    explanation: v.string(),
  }),
  handler: async (_ctx, args) => {
    const answer = args.answer.trim();
    if (!answer) {
      throw new Error("정답을 입력해주세요.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }

    const prompt = buildPrompt(answer);

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.6,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 256,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini 요청 실패: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!textResponse) {
      throw new Error("Gemini 응답에서 내용을 찾을 수 없습니다.");
    }

    return extractDraft(textResponse);
  },
});
