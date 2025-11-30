## TODO

### Routing

- Learn TanStack Router best practices.
- Migrate navigation to file/route-based TanStack Router (currently hash-based).

### Auth

- Smooth out awkward login/logout flow.

### Data & Features

- Support bulk English entry/import.
- Generate answers in alternate tenses/forms (e.g., allow `came up with` for `come up with`).

### Naming

- Allow renaming the "sandbag" entity.
- Reconsider the "sandbag" naming entirely.

### UX/UI

- For descriptions, explain why an answer is correct without leading text like “The answer is ...”.
- Redesign Activity and Plans pages toward a table-like layout for easier scanning (cards are too busy).

### Observability

- Remove front-end logging noise in production builds.

### Operations

- Document Convex env var export: `npx convex env set GEMINI_API_KEY "<your-key>"`.
- Add a spend/usage limit control.
