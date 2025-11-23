# Plan

Follow the checklist below in order. When told “go”, take the next unchecked item, make it true, then mark it checked.

- [x] Test: `docs/design-principles.md` uses Tailwind v4 defaults (e.g., `text-sm`, `rounded-md`, spacing scale) instead of hardcoded pixel values.
- [x] Test: Section-specific guidance (e.g., “Landing Screen Reference”) is removed so the document stays general-purpose.
- [x] Test: The document is shorter and focused on reusable tokens/presets rather than custom values.
- [x] Test: Guidance calls out using the existing primary palette for CTAs before adding new colors.
- [x] Test: Document allows only primary and gray palettes, and removes component-specific subsections (Buttons, Inputs & Forms).
- [x] Test: Neutrals explicitly use the Tailwind `gray` palette (not `neutral`/`slate`) throughout the guidance.
- [x] Test: Guidance references the existing custom primary palette instead of Tailwind `blue` utilities.
- [x] Test: Layout guidance states desktop is mobile centered and forbids responsive prefixes for structural changes.
- [x] Test: Feedback & Interaction States cover input/error/disabled, loading, and empty states with gray palette examples.
- [x] Test: Microcopy guidance covers action verbs, friendly tone, and helper text usage.
- [x] Test: Palette rules explicitly allow semantic feedback colors (e.g., red) alongside primary and gray.
