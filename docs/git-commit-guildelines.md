## General

- Use **Korean**.

---

## Commit Message Format

Follow this structure when writing commit messages:

```
<type>(<scope>): <description>

[optional body]
```

## Commit Types

- Allowed types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `perf`
- `refactor` note: Code changes that improve structure **without changing functionality**. Do not use if functionality changes → use `fix`, `style`, or `perf` instead.

## Scope Rules

- `scope` is **mandatory** and must be wrapped in parentheses.
- If the change is confined to a single package, use the **package name** as the scope.
- For changes spanning multiple packages, use the relevant **module** or **feature name** instead.
- Examples:
  - `api-private`
  - `coupon`
  - `analytics`
  - `popup-renderer`
  - `segment-rule`

You can check available package names with the following command:

```bash
sed 's|//.*||g; s|/\*.*\*/||g' ./.vscode/codenbutter.code-workspace \
  | jq -r '.folders[] | select(has("name") and .name != "ROOT") | .name'
```
