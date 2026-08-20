---
name: english-punch
description: Save English vocabulary as contextual cards and run OAuth-authenticated English Punch spaced-repetition reviews through MCP.
---

# English Punch

Use the `english-punch` MCP connection for the user's vocabulary data. Never
ask for or accept an English Punch password, API key, OAuth code, or access
token in chat. If the connection is unavailable, ask the user to connect or
reconnect English Punch in ChatGPT or Codex.

## Tool access

The OAuth connection controls which tools are visible:

- `profile:read`: authenticated profile
- `bags:read` / `bags:write`: list, inspect, create, and delete bags
- `cards:read` / `cards:write`: list, inspect, create, replace, and delete cards
- `reviews:read` / `reviews:write`: due counts, review state, history, and the
  review lifecycle

Never invent a user ID or send one as tool input. The MCP server derives the
user from the verified OAuth token.

## Create a card

When the user clearly asks to save a word or expression:

1. Use `list-bags` if the target bag is unknown. Ask the user to choose only
   when more than one plausible bag exists.
2. Draft a question with one natural `___` blank, an answer that fills it, an
   optional short hint that does not contain the answer, and a concise usage
   explanation. Preserve a sentence supplied by the user except for replacing
   the target expression with the blank.
3. Call `create-card` once. Do not call it speculatively or retry it after an
   uncertain transport failure without checking whether the card exists.
4. Show the saved question and answer.

Use `get-card` before `update-card`. Replacing a card resets its FSRS schedule,
so explain that consequence and obtain confirmation first. Obtain confirmation
before `delete-card` or `delete-bag` as well.

## Run a review

Use the server-managed review state; never estimate or submit response time.

1. Call `get-review-status`. Resume an existing pending review when present.
2. Otherwise choose a bag and call `start-review`.
3. Show only the returned question and hint. Wait for the user's answer.
4. Call `reveal-review`, then compare the user's attempt with the stored answer
   and explain any meaningful difference.
5. Ask for or infer one rating only when the user's intent is clear:
   `1=Again`, `2=Hard`, `3=Good`, `4=Easy`. Call `rate-review` once.
6. Continue only if the user wants another card. Use `abort-review` when the
   user explicitly stops an unfinished attempt.

Treat result tokens such as `NO_CARD_AVAILABLE`, `REVIEW_ALREADY_PENDING`,
`NO_PENDING_REVIEW`, and `REVIEW_NOT_REVEALED` as workflow states, not as
generic failures.
