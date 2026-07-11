import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Candidate } from "./workflow.ts";

export type QuizItem = {
  chosen: string;
  imagePath: string;
};

export type QuizItemPaths = {
  id: string;
  itemPath: string;
  imagePath: string;
};

const dataDirectory = path.resolve(
  process.cwd(),
  "prototypes/sentence-image-workflow/.poc-data/items"
);

export function createQuizItemPaths(): QuizItemPaths {
  const id = randomUUID();
  mkdirSync(dataDirectory, { recursive: true });

  return {
    id,
    itemPath: path.join(dataDirectory, `${id}.json`),
    imagePath: path.join(dataDirectory, `${id}.png`),
  };
}

export function saveQuizItem(input: {
  chosen: Candidate;
  imagePath: string;
  itemPath: string;
}): QuizItem {
  const item: QuizItem = {
    chosen: input.chosen.sentence,
    imagePath: input.imagePath,
  };

  writeFileSync(input.itemPath, `${JSON.stringify(item, null, 2)}\n`);
  return item;
}
