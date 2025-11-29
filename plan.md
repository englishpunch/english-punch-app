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
- [x] Test: Unauthenticated users are auto-signed in anonymously and land on the run tab by default.
- [x] Test: Activity tab shows recent review logs (rating, question, time) fetched for the user.
- [x] Test: Profile button opens a full-screen drawer with profile info.
- [x] Test: Plans tab lets me create and delete 샌드백 from the list view.
- [x] Test: Inside a 샌드백 on Plans tab, I can add/edit/delete cards.
- [x] Test: Editing a card resets its FSRS scheduling fields to initial values.
 - [x] Test: Profile drawer allows entering email/password and triggers sign in.
- [x] Test: Card creation and editing happen on a dedicated page separate from the Plans list.
- [x] Test: Convex TanStack Query client is initialized once and shared across web and Tauri builds.
- [x] Test: Data fetching routes are split per page (Run, Activity, Plans, Profile) and each uses `useQuery` from Convex.
- [x] Test: Netlify build succeeds with Convex client configured from environment (no Tauri-only APIs used).
- [ ] Test: Tauri build succeeds with the same Convex query hooks (no Netlify-only APIs used).
- [ ] Test: Mock data mode activates only when search param `mock=true` is present; otherwise live Convex data loads.
