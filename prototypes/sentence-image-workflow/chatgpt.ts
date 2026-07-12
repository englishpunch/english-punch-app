import { spawnSync } from "node:child_process";

import type { Candidate, Evaluation, FeedbackPoint } from "./workflow.ts";

const SESSION = "ep-poc";
const PLAYWRIGHT = "playwright-cli";

type Pause = (message: string) => Promise<void>;

function playwright(args: string[], raw = true): string {
  const result = spawnSync(
    PLAYWRIGHT,
    [...(raw ? ["--raw"] : []), `-s=${SESSION}`, ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, TMPDIR: "/tmp" },
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  if (result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || "Playwright failed.").trim()
    );
  }

  return result.stdout.trim();
}

function promptBoxExists(): boolean {
  try {
    return (
      playwright([
        "eval",
        "Boolean(document.querySelector('#prompt-textarea'))",
      ]) === "true"
    );
  } catch {
    return false;
  }
}

export async function ensureChatGptReady(pause: Pause): Promise<void> {
  if (!promptBoxExists()) {
    try {
      playwright(
        [
          "open",
          "https://chatgpt.com/",
          "--browser=chrome",
          "--persistent",
          "--headed",
        ],
        false
      );
    } catch (error) {
      if (!String(error).includes("already open")) {
        throw error;
      }
    }
  }

  if (!promptBoxExists()) {
    await pause(
      "Complete any Cloudflare check or ChatGPT login in the opened browser, then press Enter here."
    );
  }

  if (!promptBoxExists()) {
    throw new Error("ChatGPT is not ready: the prompt box could not be found.");
  }
}

function validateEvaluation(value: unknown): Evaluation {
  if (!value || typeof value !== "object") {
    throw new Error("ChatGPT returned invalid JSON.");
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.summary !== "string" ||
    !Array.isArray(candidate.points) ||
    !Array.isArray(candidate.candidates)
  ) {
    throw new Error("ChatGPT returned an incomplete evaluation.");
  }

  const points = candidate.points.filter((item): item is FeedbackPoint =>
    Boolean(
      item &&
      typeof item === "object" &&
      typeof (item as FeedbackPoint).excerpt === "string" &&
      typeof (item as FeedbackPoint).explanation === "string"
    )
  );

  if (points.length < 2 || points.length > 4) {
    throw new Error("ChatGPT did not return two to four feedback points.");
  }

  const candidates = candidate.candidates.filter((item): item is Candidate =>
    Boolean(
      item &&
      typeof item === "object" &&
      typeof (item as Candidate).style === "string" &&
      typeof (item as Candidate).level === "string" &&
      typeof (item as Candidate).sentence === "string"
    )
  );

  if (candidates.length !== 4) {
    throw new Error("ChatGPT did not return exactly four sentence options.");
  }

  return {
    summary: candidate.summary,
    points,
    candidates,
  };
}

export function evaluateSentence(sentence: string): Evaluation {
  const coachPrompt = `You are an expert English writing coach. Analyze the learner's intended meaning, grammar, collocations, vocabulary, register, and naturalness with care. Evaluate the writing as a complete sentence or connected thought, without selecting or teaching a target expression.

Learner sentence: ${JSON.stringify(sentence)}

Return only valid JSON with this exact shape:
{"summary":"A concise overall evaluation in one or two sentences.","points":[{"excerpt":"An exact phrase quoted from the learner's sentence.","explanation":"A specific explanation of what works or sounds unnatural, why, and one or two more natural choices."}],"candidates":[{"style":"A short descriptive label such as Direct & Natural, Focusing on the issue, Advanced & Concise, or Action-oriented.","level":"A CEFR label such as B1, B2, C1, C1/C2, or C2.","sentence":"One complete natural alternative."}]}

Quality requirements:
- Write two to four phrase-level feedback points. Quote the learner's exact wording in each excerpt.
- Give each feedback point a distinct purpose. Merge overlapping observations instead of analyzing the same phrase or ambiguity twice; for a single sentence, three substantial points are usually better than four repetitive ones.
- Diagnose the real issue precisely: grammar, collocation, ambiguity, direct translation, redundancy, technical wording, or register. Do not call a phrase incorrect when it is merely formal or less idiomatic.
- When useful, contrast the learner's phrase with natural alternatives and explain the nuance briefly.
- Recommend only expressions and collocations you are highly confident a native speaker would actually use. Do not offer a shorter preposition phrase merely because it is grammatically possible. Prefer ordinary idiomatic wording unless the context genuinely calls for technical language.
- For card-payment chip problems, prefer everyday phrases such as 'using the chip,' 'the chip wasn't working,' 'the reader couldn't read the chip,' or 'the payment wouldn't go through.' Do not recommend bare phrases like 'by chip,' 'with chip,' or technical phrases like 'chip payment function' unless the learner is writing for a technical support document.
- Produce exactly four alternatives spanning roughly B1 to C2.
- Make the four alternatives meaningfully different in style, syntax, focus, or register. At minimum include a direct natural version, a version that shifts focus or perspective, a concise advanced version, and one other context-appropriate angle such as action-oriented, conversational, professional, narrative, or empathetic.
- Choose style labels that accurately describe the specific alternative; do not mechanically reuse labels that do not fit the content.
- Keep every alternative faithful to the original event, facts, tone, and likely intended meaning. When a vague pronoun's referent is strongly implied by context, make that noun explicit in at least two alternatives; otherwise preserve the ambiguity rather than inventing a detail.
- Do not add frequency, duration, severity, or certainty that the learner did not state. Avoid words like 'repeated,' 'frequent,' 'ongoing,' 'constant,' 'serious,' or 'faulty' unless they are clearly supported by the learner's sentence.
- Higher levels should improve fluency, precision, and nuance rather than merely use longer or rarer words.
- Do not simulate advanced English with unnecessary nominalizations or technical noun phrases. The advanced concise alternative should be genuinely compact, idiomatic, and precise.
- Every candidate must be memorable and sound like something a native speaker would genuinely say or write.
- Return strictly parseable JSON. Before responding, silently verify that JSON.parse would succeed. Prefer single quotation marks around English examples inside JSON string values; if a double quotation mark appears inside a string value, escape it as \\". The excerpt value itself must contain the exact phrase without surrounding quotation marks.
- Do not use Markdown or include any text outside the JSON.`;

  const code = `async page => {
    const prompt = ${JSON.stringify(coachPrompt)};
    const intelligence = page.getByRole('button', { name: /^(Instant|Medium|High|Extra High|Pro)$/ });
    if ((await intelligence.innerText()).trim() !== 'Extra High') {
      await intelligence.click();
      await page.getByRole('menuitemradio', { name: 'Extra High' }).click();
      await page.getByRole('button', { name: 'Extra High', exact: true }).waitFor();
    }
    const messages = page.locator('[data-message-author-role="assistant"]');
    const before = await messages.count();
    const box = page.locator('#prompt-textarea');
    await box.fill(prompt);
    await page.getByTestId('send-button').click();
    await page.waitForFunction((count) => {
      const all = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
      if (all.length <= count) return false;
      const text = all.at(-1)?.textContent?.trim() ?? '';
      const fence = String.fromCharCode(96).repeat(3);
      const clean = text.trim().replace(new RegExp('^' + fence + '(?:json)?\\\\s*', 'i'), '').replace(new RegExp(fence + '$'), '').trim();
      try { JSON.parse(clean); return true; } catch { return false; }
    }, before, { timeout: 240000 });
    const text = (await messages.last().innerText()).trim();
    const fence = String.fromCharCode(96).repeat(3);
    const clean = text.trim().replace(new RegExp('^' + fence + '(?:json)?\\\\s*', 'i'), '').replace(new RegExp(fence + '$'), '').trim();
    return JSON.parse(clean);
  }`;

  const output = playwright(["run-code", code]);
  return validateEvaluation(JSON.parse(output));
}

export function generateCueImage(sentence: string, imagePath: string): string {
  const imagePrompt = `Create one memorable 2D illustration as a visual cue for recalling this complete English sentence: ${JSON.stringify(sentence)}

Use a clean contemporary editorial or storybook style: simplified shapes, expressive characters, crisp silhouettes, warm colors, and a subtle hand-drawn texture. Make it clearly illustrated, not photorealistic and not a 3D render.

Depict the event literally in one simple, intuitive scene. Include every concrete detail needed to distinguish this sentence from similar ones. Do not include any written language or readable symbols: no words, letters, numbers, X marks, checkmarks, captions, subtitles, speech bubbles, signs, labels, logos, interface text, currency marks, or watermarks. Show payment failure through visual storytelling instead, such as a dark or blank card reader screen, a confused expression, an unread chip, or a declined gesture.`;

  const code = `async page => {
    const prompt = ${JSON.stringify(imagePrompt)};
    const outputPath = ${JSON.stringify(imagePath)};
    const intelligence = page.getByRole('button', { name: /^(Instant|Medium|High|Extra High|Pro)$/ });
    if ((await intelligence.innerText()).trim() !== 'Instant') {
      await intelligence.click();
      await page.getByRole('menuitemradio', { name: /^Instant/ }).click();
      await page.getByRole('button', { name: 'Instant', exact: true }).waitFor();
    }
    const generatedImages = page.locator('img[alt^="Generated image:"]');
    const before = await generatedImages.count();
    const box = page.locator('#prompt-textarea');
    await box.fill(prompt);
    await page.getByTestId('send-button').click();
    await page.waitForFunction((count) => {
      const images = [...document.querySelectorAll('img[alt^="Generated image:"]')];
      return images.length > count && images.at(-1).naturalWidth >= 256 && images.at(-1).naturalHeight >= 256;
    }, before, { timeout: 240000 });

    const source = await generatedImages.last().evaluate(image => image.currentSrc);
    const downloadPromise = page.waitForEvent('download');
    await page.evaluate(async imageSource => {
      const response = await fetch(imageSource);
      if (!response.ok) throw new Error('Image download failed: ' + response.status);

      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'current-cue.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }, source);

    const download = await downloadPromise;
    await download.saveAs(outputPath);
    const failure = await download.failure();
    if (failure) throw new Error('Image download failed: ' + failure);
    return outputPath;
  }`;

  const output = playwright(["run-code", code]);
  return output.replace(/^"|"$/g, "");
}

export function closeBrowser(): void {
  try {
    playwright(["close"], false);
  } catch {
    // The session may already be closed.
  }
}
