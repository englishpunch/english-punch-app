import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import {
  closeBrowser,
  ensureChatGptReady,
  evaluateSentence,
  generateCueImage,
} from "./chatgpt.ts";
import { createQuizItemPaths, saveQuizItem } from "./storage.ts";
import { initialState, transition, type WorkflowState } from "./workflow.ts";

const bold = "\u001B[1m";
const dim = "\u001B[2m";
const reset = "\u001B[0m";
const input = createInterface({ input: stdin, output: stdout });

function render(state: WorkflowState, notice?: string): void {
  console.clear();
  console.log(`${bold}PROTOTYPE — Sentence → Image → Recall${reset}`);
  console.log(
    `${dim}No target expression. No database. Scratch image only.${reset}\n`
  );
  console.log(`${bold}step${reset}: ${state.step}`);

  if ("original" in state) {
    console.log(`${bold}original${reset}: ${state.original}`);
  }
  if ("evaluation" in state) {
    console.log(`\n${bold}Grammar and Vocabulary Evaluation${reset}\n`);
    console.log(state.evaluation.summary);
    for (const point of state.evaluation.points) {
      console.log(`\n${bold}"${point.excerpt}"${reset}: ${point.explanation}`);
    }
  }
  if ("chosen" in state) {
    console.log(`${bold}chosen${reset}: ${state.chosen.sentence}`);
  }
  if ("imagePath" in state) {
    console.log(`${bold}image${reset}: ${state.imagePath}`);
  }
  if ("itemPath" in state) {
    console.log(`${bold}item${reset}: ${state.itemPath}`);
  }
  if (state.step === "revealed") {
    console.log(`${bold}your recall${reset}: ${state.recall}`);
    console.log(
      `${bold}exact match${reset}: ${state.recall === state.chosen.sentence ? "yes" : "no"}`
    );
  }
  if (notice) {
    console.log(`\n${notice}`);
  }
}

async function pause(message: string): Promise<void> {
  await input.question(`\n${message} `);
}

function openImage(path: string): void {
  spawnSync("open", [path], { stdio: "ignore" });
}

async function main(): Promise<void> {
  let state: WorkflowState = initialState;

  while (true) {
    render(state);

    if (state.step === "writing") {
      const sentence = await input.question(
        `\n${bold}Write one sentence${reset} ([q] quit): `
      );
      if (sentence.trim().toLowerCase() === "q") {
        break;
      }

      state = transition(state, { type: "submit-sentence", sentence });
      render(state, "Opening ChatGPT for evaluation…");

      try {
        await ensureChatGptReady(pause);
        const evaluation = evaluateSentence(sentence.trim());
        state = transition(state, { type: "receive-evaluation", evaluation });
      } catch (error) {
        render(state, `${bold}Automation stopped:${reset} ${String(error)}`);
        await pause("Press Enter to start over.");
        state = transition(state, { type: "restart" });
      }
      continue;
    }

    if (state.step === "choosing") {
      console.log(`\n${bold}Natural Alternatives (B1–C2)${reset}`);
      console.log(
        state.evaluation.candidates
          .map(
            (candidate, index) =>
              `${bold}[${index + 1}]${reset} ${candidate.style} (${candidate.level}): "${candidate.sentence}"`
          )
          .join("\n")
      );
      const choice = await input.question(`\nChoose 1–4 ([q] quit): `);
      if (choice.trim().toLowerCase() === "q") {
        break;
      }
      const index = Number(choice) - 1;

      try {
        const chosen = state.evaluation.candidates[index];
        if (!chosen) {
          throw new Error("Choose sentence 1, 2, 3, or 4.");
        }
        state = transition(state, { type: "choose", index });
        render(state, "Asking ChatGPT to generate a text-free image…");
        const paths = createQuizItemPaths();
        const imagePath = generateCueImage(chosen.sentence, paths.imagePath);
        saveQuizItem({
          chosen,
          imagePath,
          itemPath: paths.itemPath,
        });
        state = transition(state, {
          type: "receive-image",
          imagePath,
          itemPath: paths.itemPath,
        });
      } catch (error) {
        render(state, `${bold}Automation stopped:${reset} ${String(error)}`);
        await pause("Press Enter to start over.");
        state = transition(state, { type: "restart" });
      }
      continue;
    }

    if (state.step === "image-ready") {
      const imagePath = state.imagePath;
      const action = await input.question(
        `\n${bold}[v]${reset} view cue  ${bold}[r]${reset} recall quiz  ${bold}[n]${reset} new sentence  ${bold}[q]${reset} quit: `
      );
      if (action === "q") {
        break;
      }
      if (action === "n") {
        state = transition(state, { type: "restart" });
      }
      if (action === "v") {
        openImage(imagePath);
      }
      if (action === "r") {
        openImage(imagePath);
        state = transition(state, { type: "start-quiz" });
      }
      continue;
    }

    if (state.step === "recalling") {
      const recall = await input.question(`\nType the complete sentence: `);
      state = transition(state, { type: "submit-recall", recall });
      continue;
    }

    if (state.step === "revealed") {
      const imagePath = state.imagePath;
      const action = await input.question(
        `\n${bold}[n]${reset} new sentence  ${bold}[v]${reset} view cue  ${bold}[q]${reset} quit: `
      );
      if (action === "q") {
        break;
      }
      if (action === "n") {
        state = transition(state, { type: "restart" });
      }
      if (action === "v") {
        openImage(imagePath);
      }
      continue;
    }
  }
}

try {
  await main();
} finally {
  input.close();
  closeBrowser();
}
