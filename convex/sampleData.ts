import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Sample vocabulary words for testing
const sampleWords = [
  {
    word: "eloquent",
    definition: "Fluent or persuasive in speaking or writing",
    pronunciation: "EL-uh-kwuhnt",
    partOfSpeech: "adjective",
    difficulty: "intermediate" as const,
    examples: [
      "The speaker gave an eloquent presentation that moved the audience to tears.",
      "Her eloquent writing style made the complex topic easy to understand."
    ],
    synonyms: ["articulate", "fluent", "persuasive", "expressive"],
    antonyms: ["inarticulate", "tongue-tied"],
    category: "communication"
  },
  {
    word: "serendipity",
    definition: "The occurrence of events by chance in a happy or beneficial way",
    pronunciation: "ser-uhn-DIP-i-tee",
    partOfSpeech: "noun",
    difficulty: "advanced" as const,
    examples: [
      "It was pure serendipity that led her to discover the hidden café.",
      "The scientific breakthrough was a result of serendipity rather than planned research."
    ],
    synonyms: ["chance", "fortune", "luck"],
    category: "general"
  },
  {
    word: "ubiquitous",
    definition: "Present, appearing, or found everywhere",
    pronunciation: "yoo-BIK-wi-tuhs",
    partOfSpeech: "adjective",
    difficulty: "advanced" as const,
    examples: [
      "Smartphones have become ubiquitous in modern society.",
      "The ubiquitous presence of social media affects how we communicate."
    ],
    synonyms: ["omnipresent", "pervasive", "widespread"],
    antonyms: ["rare", "scarce"],
    category: "academic"
  },
  {
    word: "resilient",
    definition: "Able to withstand or recover quickly from difficult conditions",
    pronunciation: "ri-ZIL-yuhnt",
    partOfSpeech: "adjective",
    difficulty: "intermediate" as const,
    examples: [
      "The resilient community rebuilt after the natural disaster.",
      "Children are often more resilient than adults when facing change."
    ],
    synonyms: ["tough", "strong", "adaptable", "flexible"],
    antonyms: ["fragile", "brittle"],
    category: "psychology"
  },
  {
    word: "ephemeral",
    definition: "Lasting for a very short time",
    pronunciation: "ih-FEM-er-uhl",
    partOfSpeech: "adjective",
    difficulty: "advanced" as const,
    examples: [
      "The beauty of cherry blossoms is ephemeral, lasting only a few weeks.",
      "Social media posts often have an ephemeral quality, quickly forgotten."
    ],
    synonyms: ["temporary", "fleeting", "transient", "brief"],
    antonyms: ["permanent", "lasting", "enduring"],
    category: "academic"
  },
  {
    word: "pragmatic",
    definition: "Dealing with things sensibly and realistically in a practical way",
    pronunciation: "prag-MAT-ik",
    partOfSpeech: "adjective",
    difficulty: "intermediate" as const,
    examples: [
      "She took a pragmatic approach to solving the budget crisis.",
      "His pragmatic nature helped him succeed in business."
    ],
    synonyms: ["practical", "realistic", "sensible", "down-to-earth"],
    antonyms: ["idealistic", "impractical"],
    category: "business"
  },
  {
    word: "catalyst",
    definition: "A person or thing that precipitates an event or change",
    pronunciation: "KAT-l-ist",
    partOfSpeech: "noun",
    difficulty: "intermediate" as const,
    examples: [
      "The new CEO was a catalyst for positive change in the company.",
      "The protest served as a catalyst for social reform."
    ],
    synonyms: ["trigger", "stimulus", "agent", "spark"],
    category: "science"
  },
  {
    word: "meticulous",
    definition: "Showing great attention to detail; very careful and precise",
    pronunciation: "muh-TIK-yuh-luhs",
    partOfSpeech: "adjective",
    difficulty: "intermediate" as const,
    examples: [
      "The surgeon was meticulous in her preparation for the operation.",
      "His meticulous research led to groundbreaking discoveries."
    ],
    synonyms: ["careful", "thorough", "precise", "detailed"],
    antonyms: ["careless", "sloppy", "hasty"],
    category: "academic"
  },
  {
    word: "innovation",
    definition: "The action or process of innovating; a new method, idea, or product",
    pronunciation: "in-uh-VEY-shuhn",
    partOfSpeech: "noun",
    difficulty: "beginner" as const,
    examples: [
      "The company is known for its innovation in renewable energy.",
      "Technological innovation has transformed how we work and communicate."
    ],
    synonyms: ["invention", "creativity", "novelty", "breakthrough"],
    category: "business"
  },
  {
    word: "collaborate",
    definition: "Work jointly on an activity, especially to produce or create something",
    pronunciation: "kuh-LAB-uh-reyt",
    partOfSpeech: "verb",
    difficulty: "beginner" as const,
    examples: [
      "The two companies decided to collaborate on the new project.",
      "Students were asked to collaborate on their research papers."
    ],
    synonyms: ["cooperate", "work together", "team up", "partner"],
    antonyms: ["compete", "oppose"],
    category: "business"
  }
];

export const populateSampleWords = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if words already exist
    const existingWords = await ctx.db.query("words").collect();
    if (existingWords.length > 0) {
      return { message: "Sample words already exist", count: existingWords.length };
    }

    // Add sample words
    const wordIds = [];
    for (const wordData of sampleWords) {
      const wordId = await ctx.db.insert("words", wordData);
      wordIds.push(wordId);
    }

    return { message: "Sample words added successfully", count: wordIds.length };
  },
});
