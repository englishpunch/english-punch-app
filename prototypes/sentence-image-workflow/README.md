# Sentence → Image → Recall prototype

**Question:** Does a sentence-first learning loop feel useful when ChatGPT
offers several complete rewrites, the learner chooses one, and a text-free
image cues recall—without extracting a target expression or changing English
Punch?

This is throwaway logic/UI code. It keeps active workflow state in memory, then
writes each chosen quiz item to `.poc-data/items/<id>.json` and
`.poc-data/items/<id>.png`. The directory is ignored by Git.

Run it from the repository root:

```bash
pnpm run prototype:sentence-image
```

The prototype opens a visible, persistent Chrome session at ChatGPT. Complete
any Cloudflare check or login in that window, then return to the terminal. The
sentence you enter is sent to ChatGPT for evaluation and image generation.

Sentence evaluation switches ChatGPT to `Extra High` intelligence and returns
four natural alternatives at CEFR B1, B2, C1, and C2 levels. Image generation
switches back to `Instant`, requests a text-free 2D illustration, and saves the
original authenticated image download rather than a page screenshot.

Each saved JSON item contains only the chosen sentence and the generated image
path. The original sentence and evaluation stay in the live terminal workflow
but are not persisted.

The browser automation intentionally uses the existing `playwright-cli`
installation instead of adding Playwright as a project dependency. The UI
selectors are exploratory and may need to change as ChatGPT evolves.

Delete or absorb this prototype after deciding whether the whole-sentence
image cue is useful.
