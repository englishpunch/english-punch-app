---
date: 2026-04-11
author: claude
status: draft
topic: `ep skill install` — embed the Claude Code skill in the ep binary and install it on demand
---

# `ep skill install`

## Overview

Ship the English Punch Claude Code skill **inside** the `ep` Go
binary using `//go:embed`, and expose three subcommands
(`install`, `uninstall`, `status`) that manage its location at
`~/.claude/skills/english-punch/`. The Homebrew formula stays
well-behaved — it only puts `ep` on `$PATH` and prints a one-line
`caveats` string telling the user to run `ep skill install`.

**No version tracking.** The binary always carries whatever skill
content shipped in its source tree. Users who want the latest
content run `ep skill install --force` after upgrading `ep`.
Simpler mental model, fewer moving parts, no drift tests.

## Motivation

- The primary consumer of `ep` is a Claude Code skill driving an
  English-learning loop (see
  `thoughts/plans/2026-04-11-cli-llm-as-caller.md`). The skill
  needs to live somewhere Claude Code can read it:
  `~/.claude/skills/<name>/SKILL.md`.
- Shipping the skill as a loose file in the Homebrew formula's
  `share/` directory and expecting the user to symlink is fragile
  and platform-specific. Writing directly to `~/.claude/` from the
  formula is unconventional — Homebrew formulas are expected to
  stay inside `$HOMEBREW_PREFIX` and not touch user home
  directories.
- Embedding the skill content in the Go binary with `//go:embed`
  gives us a single self-contained artifact that works for
  `brew install`, `go install`, tarball, and manual builds with
  **zero** distribution plumbing. The user runs `ep skill install`
  once, opt-in, and can cleanly `ep skill uninstall` later.
- Skipping version tracking keeps the semantic model minimal:
  "the skill is either present at `<target>/SKILL.md` or it is
  not". The binary is the source of truth; re-running
  `install --force` is the upgrade path.

## Scope

### In scope

- New Go package `cli/internal/ep/skill` with an `embed.FS`
  rooted at `cli/internal/ep/skill/content/`
- Three CLI subcommands: `ep skill install` / `uninstall` /
  `status`
- Target directory resolution (default
  `~/.claude/skills/english-punch/`, override with `--target`)
- Three new error tokens following `docs/cli-llm-as-caller.md`
- Standard `--json` output on all three subcommands
- A minimal `SKILL.md` stub — enough content to compile and
  install, not the full English-learning loop (that is separate
  content-design work)
- Help-text-lint-passing command tree

### Out of scope

- **Version tracking.** No `VERSION` file, no `EmbeddedVersion`
  constant, no drift test. Users who want the latest content run
  `install --force`.
- **Upgrade protection.** `install --force` clobbers user edits
  without backup. Documented in `Long` help so nobody is
  surprised.
- The full skill content — v1 ships a stub that explains the
  skill exists and points at `ep cards create`. The loop logic
  itself is a follow-up content iteration.
- Atomic install (no rollback on partial write). v1 writes files
  in sequence; a crash mid-write leaves a half-installed tree.
  `ep skill install --force` cleans it up.
- Linux / Windows target path resolution. macOS `~/.claude/`
  only in v1. Future extension: detect `XDG_CONFIG_HOME` /
  `%APPDATA%`.
- Updating the `echoja/homebrew-tap` formula's `caveats` string.
  That is a separate-repo change; this plan flags it under
  "Follow-up".

---

## Directory layout

```
cli/
└── internal/
    └── ep/
        ├── skill/
        │   ├── content/
        │   │   └── SKILL.md      # minimal stub
        │   ├── embed.go          # //go:embed content/** + FS accessor
        │   ├── install.go        # Install() and helpers
        │   ├── uninstall.go      # Uninstall() and helpers
        │   ├── status.go         # Status() and helpers
        │   └── skill_test.go     # unit tests using t.TempDir() as target
        └── cmd/
            ├── skill.go          # newSkillCmd() + three leaf commands
            └── skill_test.go     # flag-validation tests
```

### Why a dedicated `skill/` package

Not every command needs its own package — `auth`, `bags`, and
`cards` live in `internal/ep/cmd`. But `skill/` has a non-trivial
blob of embedded content, pure filesystem logic, and no Convex
dependency. Separating it keeps the command layer thin (just
flag wiring + output formatting) and isolates the
platform-specific bits for future Linux / Windows work.

---

## Embedding

`cli/internal/ep/skill/embed.go`:

```go
package skill

import "embed"

//go:embed content
var content embed.FS

// Content returns the embedded skill filesystem rooted at the
// "content/" directory. Callers use fs.WalkDir and fs.ReadFile
// through this accessor.
func Content() embed.FS { return content }
```

The `//go:embed content` directive pulls in the whole `content/`
subtree at build time. `go build` rejects the directive if any
referenced path is missing, so `SKILL.md` must always exist
alongside `embed.go`.

---

## Subcommand surfaces

### `ep skill install`

- **Args**: none
- **Flags**:
  - `--target <path>` — default
    `~/.claude/skills/english-punch/`
  - `--force` — overwrite an existing `SKILL.md` (clobbers user
    edits)
- **Behavior**:
  1. Resolve `--target` (expand `~`, default to
     `$HOME/.claude/skills/english-punch`).
  2. If `<target>/SKILL.md` already exists and `--force` is not
     set → return
     `SKILL_ALREADY_INSTALLED: <path> already contains SKILL.md — pass --force to overwrite`.
  3. Ensure the target directory exists (`os.MkdirAll`, 0o755).
  4. Walk the embedded filesystem and copy each file to the
     corresponding path under `--target`. File mode 0o644 for
     regular files.
- **Human output**:
  `Installed english-punch skill to ~/.claude/skills/english-punch/`
- **`--json` output**:
  `{"ok": true, "path": "...", "filesWritten": 1}`
- **Tokens**: `SKILL_ALREADY_INSTALLED`, `SKILL_WRITE_FAILED`

### `ep skill uninstall`

- **Args**: none
- **Flags**:
  - `--target <path>` — default as above
  - `--force` — remove the directory even if it is missing
    (returns success with `filesRemoved: 0`)
- **Behavior**:
  1. Resolve `--target`.
  2. If `<target>/SKILL.md` does not exist → return
     `SKILL_NOT_INSTALLED: nothing at <path>` unless `--force`.
  3. Delete the target directory recursively (`os.RemoveAll`).
- **Human output**:
  `Uninstalled english-punch skill from ~/.claude/skills/english-punch/`
- **`--json` output**:
  `{"ok": true, "path": "...", "filesRemoved": <n>}`
- **Tokens**: `SKILL_NOT_INSTALLED`, `SKILL_WRITE_FAILED`

### `ep skill status`

- **Args**: none
- **Flags**: `--target <path>`
- **Behavior**: read-only. Returns whether `SKILL.md` is present
  at the target path.
- **Human output** (two possible lines):
  - `installed at ~/.claude/skills/english-punch/`
  - `not installed (run 'ep skill install')`
- **`--json` output**:
  ```json
  {
    "installed": true,
    "path": "~/.claude/skills/english-punch"
  }
  ```
- **Tokens**: `SKILL_WRITE_FAILED` covers the rare case where
  `os.Stat` returns a non-`NotExist` error (permission denied
  reading the parent). "Not installed" is a valid state, not an
  error.

---

## Error tokens to add

Three new tokens in `cli/internal/ep/common/errors.go`, registered
in `CanonicalTokens`, and exercised by real call sites in
`cmd/skill.go` (so the existing `TestErrorTokens_Lint` validates
them at test time):

| Token                    | When                                             |
|---|---|
| `SKILL_ALREADY_INSTALLED` | Install when `SKILL.md` exists without `--force` |
| `SKILL_NOT_INSTALLED`     | Uninstall when target has no `SKILL.md` and no `--force` |
| `SKILL_WRITE_FAILED`      | Any filesystem error (write, read, remove, stat) |

`SKILL_WRITE_FAILED` is deliberately broad — distinguishing read
from write at the token level would give the skill no extra
branching power, because the user-facing remediation is the same
("fix filesystem permissions").

---

## Target path resolution

Implemented in `skill/install.go` as a shared helper:

```go
func resolveTarget(flagValue string) (string, error) {
    if flagValue != "" {
        return expandHome(flagValue)
    }
    home, err := os.UserHomeDir()
    if err != nil {
        return "", fmt.Errorf("resolve home: %w", err)
    }
    return filepath.Join(home, ".claude", "skills", "english-punch"), nil
}
```

`expandHome` replaces a leading `~/` with the user's home
directory. macOS only for v1 — Linux and Windows will work
coincidentally (`os.UserHomeDir` is cross-platform) but the path
convention `~/.claude/skills/` may not match how Claude Code
locates skills on those platforms. Flagged in open questions.

---

## Testing

### Unit tests (`skill/skill_test.go`)

1. `TestInstall_Fresh` — empty temp dir, install, verify
   `SKILL.md` exists and matches the embedded content byte-for-
   byte.
2. `TestInstall_AlreadyInstalled` — install twice without
   `--force`; second call returns `SKILL_ALREADY_INSTALLED`.
3. `TestInstall_Force` — pre-populate target with a stale
   `SKILL.md`, install with `force=true`, verify file overwritten.
4. `TestUninstall_Installed` — install, uninstall, verify
   directory gone.
5. `TestUninstall_NotInstalled` — uninstall empty temp dir,
   expect `SKILL_NOT_INSTALLED`.
6. `TestUninstall_Force` — uninstall empty temp dir with
   `force=true`, expect success and `filesRemoved: 0`.
7. `TestStatus_NotInstalled` — verify `installed: false`.
8. `TestStatus_Installed` — install, verify `installed: true`.

All tests use `t.TempDir()` as `--target` — no real
`~/.claude/` writes during `go test`.

### Command-layer tests (`cmd/skill_test.go`)

Three flag-validation tests following the `cards_test.go`
pattern: `--target` propagated correctly, unknown flag rejected,
`install` + `uninstall` + `status` each parse flags without error
on the happy path.

### Existing guardrails

- `TestCommands_HaveCompleteHelp` catches missing `Long` /
  `Example` / flag `Usage` on the new subcommands.
- `TestErrorTokens_Lint` validates every `NewTokenError` call in
  `cmd/skill.go` against `CanonicalTokens`.
- `TestErrorTokens_ConstRegistryDrift` catches a token defined
  in the const block but absent from `CanonicalTokens`.

---

## Minimal `SKILL.md` stub

For v1 the embedded content is just enough to prove the pipeline
works:

```markdown
---
name: english-punch
description: English learning loop powered by the ep CLI
---

# English Punch skill

This skill drives an English-learning conversation using the
`ep` CLI. It is a work in progress — the loop logic will be
added in a follow-up content iteration.

## Commands it uses

- `ep cards create <answer> --question ... --hint ... --explanation ...`
  to record a new flashcard.
- `ep review start` / `reveal` / `rate` (planned) for the
  spaced-repetition loop.
```

Full skill content (the actual English-learning loop prompt) is
a separate work stream. This plan unblocks it by landing the
install pipeline.

---

## Homebrew caveats (follow-up, separate repo)

Update the ep formula in `echoja/homebrew-tap` to include:

```ruby
def caveats
  <<~EOS
    To enable the English Punch Claude Code skill:
      ep skill install

    To overwrite later (clobbers local edits):
      ep skill install --force
  EOS
end
```

**Not done in this plan** — the formula lives in a different
repo. Flagged here so it is not forgotten.

---

## Files touched

### New

- `cli/internal/ep/skill/embed.go`
- `cli/internal/ep/skill/install.go`
- `cli/internal/ep/skill/uninstall.go`
- `cli/internal/ep/skill/status.go`
- `cli/internal/ep/skill/skill_test.go`
- `cli/internal/ep/skill/content/SKILL.md`
- `cli/internal/ep/cmd/skill.go`
- `cli/internal/ep/cmd/skill_test.go`

### Modified

- `cli/internal/ep/common/errors.go` — three new tokens
- `cli/internal/ep/cmd/root.go` — register `newSkillCmd()`

---

## Gates

- `cd cli && go vet ./... && go test ./... && go build ./...`
- `cd cli && ~/go/bin/golangci-lint run` → **0 issues**
- `TestErrorTokens_Lint` / `TestErrorTokens_ConstRegistryDrift`
  pass with the new tokens
- `TestCommands_HaveCompleteHelp` picks up `ep skill`,
  `ep skill install`, `ep skill uninstall`, `ep skill status`

---

## Implementation order

1. **Stub content**: create
   `cli/internal/ep/skill/content/SKILL.md`.
2. **Embed**: create `embed.go` with the `//go:embed content`
   directive and `Content()` accessor.
3. **Core logic**: `install.go`, `uninstall.go`, `status.go` as
   plain functions taking a target path and the `embed.FS`.
4. **Tokens**: add the three new tokens to
   `common/errors.go` (const block + `CanonicalTokens`).
5. **Command layer**: `cmd/skill.go` with
   `newSkillCmd() / newSkillInstallCmd() / newSkillUninstallCmd() / newSkillStatusCmd()`. Each command wires flags
   through to the `skill` package and handles `--json` via
   `HandleOKOutput` (install / uninstall) or `HandleOutput`
   (status).
6. **Register**: add `newSkillCmd()` in `root.go`.
7. **Tests**: `skill/skill_test.go` (eight cases above) and
   `cmd/skill_test.go` (three flag tests).
8. **Gates**: `go vet && go test && go build && golangci-lint
   run`.
9. **Smoke tests** (from the built binary):
   - `ep skill status --target /tmp/ep-skill-test` → "not
     installed"
   - `ep skill install --target /tmp/ep-skill-test` → files
     written
   - `ep skill status --target /tmp/ep-skill-test` → installed
   - `ep skill install --target /tmp/ep-skill-test` → should
     return `SKILL_ALREADY_INSTALLED`
   - `ep skill install --target /tmp/ep-skill-test --force` →
     success
   - `ep skill uninstall --target /tmp/ep-skill-test` → removed
10. **Commit + push**.

---

## Open questions

1. **Linux / Windows target path**: `~/.claude/skills/` is the
   macOS convention. Does Claude Code use the same path on
   other platforms? If not, v1 ships macOS-only and returns a
   `SKILL_UNSUPPORTED_PLATFORM` token elsewhere. Needs
   verification before shipping on those platforms.
2. **User customization protection**: if the user edits the
   installed `SKILL.md` by hand and then runs `install
   --force`, we clobber their edits silently. v1 says "sorry,
   --force is a clobber" and documents it in `Long`. Revisit if
   users report losing edits.
3. **Atomic install**: write to a temp dir and rename? Overkill
   for v1 (one file, ~1 KB). Revisit if the skill grows large
   enough that a partial install becomes likely.
4. **`SKILL.md` content**: the stub is deliberately minimal.
   Writing the actual English-learning loop prompt is a
   separate content-design work stream — the pipeline needs to
   exist first so we have somewhere to put the content.
