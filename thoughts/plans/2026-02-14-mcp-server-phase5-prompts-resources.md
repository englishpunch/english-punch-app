# Phase 5: Implement MCP Prompts and Resources

## Overview

Add 3 MCP prompt templates for card generation and 1 resource documenting the card format. Prompts let Claude Code generate high-quality fill-in-the-blank cards using the same quality guidelines as the existing Gemini-powered AI in `convex/ai.ts`.

## Prerequisites

- Phase 3 complete (server scaffolding exists)
- Can be implemented in parallel with Phase 4

## Current State Analysis — Existing AI Prompt Patterns

The existing AI system in `convex/ai.ts` defines detailed quality rules we should reuse:

### From `convex/ai.ts:36-65` (system instruction parts):

```
- question: fill-in-the-blank example consisting of 1-2 sentences with a blank (___) for the target word/phrase.
  Constraints:
    1. Context Clues: The blank (___) must be the only logical conclusion based on the preceding text.
    2. Vocabulary: Keep language simple and accessible (CEFR B1-B2 level).
    3. Diversity: Vary the speaker's persona significantly (e.g., a frustrated mechanic, a hopeful student, a strict grandmother).

- hint: A simple definition or synonym under 12 words. Do not include the answer.

- explanation: total 10-70w; Specify scenario suitability (exclude situation description); differentiation - Contrast at least 2 synonyms (nuance/tone/intensity).

- finalAnswer: Only if you changed the input form, provide the updated form here.

- Context Awareness: If a context/situation is provided, use it consistently across all generated content.

- Inflection Rule: If changing the tense or number makes the sentence significantly more natural, update the form (e.g., "apply" -> "applied").
```

## Desired End State

- 3 prompts available in Claude Code for generating card content
- 1 resource providing card format documentation
- Prompts encode the same quality guidelines as `convex/ai.ts`

## What We're NOT Doing

- Calling Gemini or any AI API from the MCP server
- Auto-creating cards (prompts generate JSON that the user reviews, then uses `create-card` tool)
- Adding prompts for non-card operations

## Implementation

### File Structure

```
mcp-server/src/
  prompts/
    card-generation.ts  # 3 prompts
  resources/
    schema-info.ts      # 1 resource
```

---

### 1. `mcp-server/src/prompts/card-generation.ts` — 3 Prompts

#### Prompt: `generate-card`

**Purpose**: Generate one fill-in-the-blank card from a target word/expression.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `answer` | string | yes | Target English word or expression (e.g. "reserve", "look forward to") |
| `context` | string | no | Situational context (e.g. "at a restaurant", "giving advice") |
| `sourceWord` | string | no | Original Korean word if applicable |

**Prompt content should instruct Claude to:**
1. Create a natural sentence with `___` blank where the answer goes
2. Ensure blank is unambiguously answerable from context clues
3. Keep vocabulary at B1-B2 CEFR level
4. Vary speaker persona
5. Generate hint (under 12 words, must not contain answer)
6. Generate explanation (10-70 words, contrast 2+ synonyms with nuance/tone/intensity)
7. Apply inflection rule if needed (e.g. "apply" → "applied")
8. Output as JSON matching the card schema

**Expected output format:**
```json
{
  "question": "I'd like to ___ a table for two at 7 pm.",
  "answer": "reserve",
  "hint": "book in advance",
  "explanation": "Used when securing something ahead of time. More formal than 'book'; implies guaranteed availability. Unlike 'save' (informal) or 'hold' (temporary), 'reserve' suggests an official arrangement.",
  "context": "at a restaurant"
}
```

#### Prompt: `generate-cards-batch`

**Purpose**: Generate N cards around a topic or theme.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `topic` | string | yes | Topic or theme (e.g. "restaurant vocabulary", "business meeting phrases") |
| `count` | string | no | Number of cards (default: "5") |
| `level` | string | no | Difficulty: "beginner", "intermediate", "advanced" |

**Additional instructions:**
- Each card should teach a different word/expression
- Vary personas across cards
- Output as JSON array

#### Prompt: `improve-card`

**Purpose**: Improve an existing card's hint and explanation, and evaluate question quality.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `question` | string | yes | Current question with `___` blank |
| `answer` | string | yes | Current answer |
| `hint` | string | no | Current hint to improve |
| `explanation` | string | no | Current explanation to improve |

**Should evaluate:**
- Is the blank ambiguous (multiple valid answers)?
- Does surrounding context provide enough clues?
- Is vocabulary level appropriate for B1-B2?
- Suggest improved question if issues found

**Output format:**
```json
{
  "hint": "improved hint",
  "explanation": "improved explanation",
  "questionSuggestion": "improved question if needed, null otherwise"
}
```

---

### 2. `mcp-server/src/resources/schema-info.ts` — 1 Resource

#### Resource: `card-format`

| Field | Value |
|-------|-------|
| ID | `card-format` |
| URI | `english-punch://card-format` |
| Title | Card Data Format |
| MIME | `text/markdown` |

**Content**: Markdown document covering:
- Fill-in-the-blank card format (required/optional fields)
- Quality guidelines (from `convex/ai.ts` system instructions)
- FSRS states: 0=New, 1=Learning, 2=Review, 3=Relearning
- Review ratings: 1=Again, 2=Hard, 3=Good, 4=Easy
- Example card

---

### 3. Update `mcp-server/src/index.ts`

Add prompt and resource registration:

```typescript
import { registerCardGenerationPrompts } from "./prompts/card-generation.js";
import { registerSchemaResources } from "./resources/schema-info.js";

// After tool registration:
registerCardGenerationPrompts(server);
registerSchemaResources(server);
```

## Success Criteria

### Automated Verification:
- [ ] `pnpm --filter @english-punch/mcp-server start` starts without errors
- [ ] TypeScript compiles: `pnpm --filter @english-punch/mcp-server exec tsc --noEmit`

### Manual Verification (after Phase 6 registration):
- [ ] `/mcp` in Claude Code shows 3 prompts and 1 resource
- [ ] Using `generate-card` prompt with word "postpone" produces well-structured card JSON
- [ ] Using `generate-cards-batch` with topic "travel vocabulary" produces 5 distinct cards
- [ ] Using `improve-card` with a weak hint provides meaningful improvements

## References

- Existing AI prompts: `convex/ai.ts:36-65` (system instruction parts)
- Card schema: `convex/fsrsSchema.ts` (full field definitions)
