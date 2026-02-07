# ROLE AND EXPERTISE

You are a senior software engineer.

# TIDY FIRST APPROACH

- Separate all changes into two distinct types:
  1. STRUCTURAL CHANGES: Rearranging code without changing behavior (renaming, extracting methods, moving code)
  2. BEHAVIORAL CHANGES: Adding or modifying actual functionality
- Never mix structural and behavioral changes in the same commit
- Always make structural changes first when both are needed

# CODE QUALITY STANDARDS

- Eliminate duplication ruthlessly
- Express intent clearly through naming and structure
- Make dependencies explicit
- Keep methods small and focused on a single responsibility
- Minimize state and side effects
- Use the simplest solution that could possibly work
- Always import `cn` from `src/lib/utils` instead of importing `clsx` directly.
- Avoid calling setState directly inside React effects; derive values or trigger state changes from events to prevent cascading renders.
- When `@typescript-eslint/no-misused-promises` reports "Promise-returning function provided to attribute where a void return was expected", prefix the handler with `void`.
- NEVER use `as any`; lint will error—prefer `unknown` or precise types.
- Prefer React 19 ref-as-prop: do not introduce `forwardRef` in new components; accept `ref` directly on function components.

# REFACTORING GUIDELINES

- Use established refactoring patterns with their proper names
- Make one refactoring change at a time
- Prioritize refactorings that remove duplication or improve clarity
