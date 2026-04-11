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
well-behaved — it only puts `ep` on `$PATH` and prints a
one-line `caveats` string telling the user to run `ep skill
install`.

## Motivation

- The primary consumer of `ep` is a Claude Code skill driving an
  English-learning loop (see
  `thoughts/plans/2026-04-11-cli-llm-as-caller.md`). The skill
  needs to live somewhere Claude Code can read it:
  `~/.claude/skills/<name>/SKILL.md`.
- Shipping the skill as a loose file in the Homebrew formula's
  `share/` directory and expecting the user to symlink is fragile
  and platform-specific. Writing directly to `~/.claude/` from the
  formula is unconventional — Homebrew formulas are supposed to
  stay inside `$HOMEBREW_PREFIX` and not touch user home
  directories.
- Embedding the skill content in the Go binary with `//go:embed`
  gives us a single self-contained artifact that works for
  `brew install`, `go install`, tarball, and manual builds with
  **zero** distribution plumbing. The user runs `ep skill install`
  once, opt-in, and can cleanly `ep skill uninstall` later.
- Versioning is automatic: `ep v0.3.0` ships exactly the skill
  content that shipped with the v0.3.0 Go source tree. No drift
  between the binary and the skill.

## Scope

### In scope

- New Go package `cli/internal/ep/skill` with an `embed.FS`
  rooted at `cli/internal/ep/skill/content/`
- Three CLI subcommands: `ep skill install` / `uninstall` /
  `status`
- Target directory resolution (default
  `~/.claude/skills/english-punch/`, override with `--target`)
- Version marker file (`VERSION`) written alongside the skill so
  `status` and subsequent `install --force` upgrades can detect
  drift
- Five new error tokens following
  `docs/cli-llm-as-caller.md`
- Standard `--json` output on all three subcommands
- A minimal `SKILL.md` stub — enough content to compile and
  install, not the full English-learning loop (that is separate
  content-design work)
- Help-text-lint-passing command tree

### Out of scope

- The full skill content. This plan ships a stub that explains
  the skill exists and points at `ep cards create` / `ep review
  start` — the loop logic itself is a follow-up content
  iteration.
- Atomic install (no rollback on partial write). v1 writes files
  in sequence; a crash mid-write leaves a half-installed tree.
  `ep skill install --force` cleans it up.
- Preserving user customizations during upgrade. `--force` is a
  clobber; the `Long` help explicitly warns users.
- Linux / Windows target path resolution. macOS `~/.claude/`
  only in v1. Future extension: detect `XDG_CONFIG_HOME` /
  `%APPDATA%`.
- Updating the `echoja/homebrew-tap` formula's `caveats` string.
  That is a separate-repo change; this plan flags it under "Out
  of scope / follow-up".
- `ep skill update` as a separate verb. `install --force` covers
  the upgrade path with one less command in the surface.

---

## Directory layout

```
cli/
└── internal/
    └── ep/
        ├── skill/
        │   ├── content/
        │   │   ├── SKILL.md      # minimal stub
        │   │   └── VERSION       # "0.1.0\n" (plain text)
        │   ├── embed.go          # //go:embed content/** + FS accessor
        │   ├── version.go        # const EmbeddedVersion
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
platform-specific bits for future Linux/Windows work.

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
referenced path is missing, so the VERSION file and SKILL.md must
always exist alongside embed.go.

### Version constant

`cli/internal/ep/skill/version.go`:

```go
package skill

// EmbeddedVersion is the skill version baked into this build of
// ep. Bump it whenever anything under content/ changes so
// installed copies can detect drift via 'ep skill status'.
//
// Keep separate from the ep CLI version — bumping ep alone
// should not force users to re-run 'ep skill install' if the
// skill content did not change.
const EmbeddedVersion = "0.1.0"
```

The `VERSION` file under `content/` contains the same string and
is the "installed version marker". Two sources of truth feels
wrong, but the alternative (reading the embedded VERSION file at
startup) is more error-prone than a compile-time constant. A
unit test in `skill_test.go` asserts the two stay in sync.

---

## Subcommand surfaces

### `ep skill install`

- **Args**: none
- **Flags**:
  - `--target <path>` — default
    `~/.claude/skills/english-punch/`
  - `--force` — overwrite an existing installation even if
    version markers match or differ
- **Behavior**:
  1. Resolve `--target` (expand `~`, default to
     `$HOME/.claude/skills/english-punch`).
  2. Read the installed `VERSION` marker if present.
     - Not installed → proceed to write.
     - Same version → return
       `SKILL_ALREADY_INSTALLED: <version> already installed at <path>`
       unless `--force`.
     - Different version → return
       `SKILL_VERSION_MISMATCH: <installed> installed, <embedded> embedded — pass --force to upgrade`
       unless `--force`.
  3. Ensure the target directory exists (`os.MkdirAll`, 0o755).
  4. Walk the embedded filesystem and copy each file to the
     corresponding path under `--target`. File mode 0o644 for
     regular files.
  5. Write the `VERSION` marker with `EmbeddedVersion`.
- **Human output**:
  `Installed english-punch skill v0.1.0 to ~/.claude/skills/english-punch/`
- **--json output**:
  `{"ok": true, "path": "...", "version": "0.1.0", "filesWritten": 2}`
- **Tokens**:
  `SKILL_ALREADY_INSTALLED`, `SKILL_VERSION_MISMATCH`,
  `SKILL_WRITE_FAILED`

### `ep skill uninstall`

- **Args**: none
- **Flags**:
  - `--target <path>` — default as above
  - `--force` — remove the directory even if the VERSION marker
    is missing or unreadable
- **Behavior**:
  1. Resolve `--target`.
  2. If the directory does not exist → return
     `SKILL_NOT_INSTALLED: nothing at <path>` unless `--force`
     (in which case return success with `filesRemoved: 0`).
  3. Delete the target directory recursively (`os.RemoveAll`).
- **Human output**:
  `Uninstalled english-punch skill from ~/.claude/skills/english-punch/`
- **--json output**:
  `{"ok": true, "path": "...", "filesRemoved": <n>}`
- **Tokens**: `SKILL_NOT_INSTALLED`, `SKILL_WRITE_FAILED`
  (for `RemoveAll` failure — write semantically, same token).

### `ep skill status`

- **Args**: none
- **Flags**: `--target <path>`
- **Behavior**: read-only. No token errors; reports state
  structurally.
- **Human output** (three possible lines):
  - `installed: v0.1.0   embedded: v0.1.0   up-to-date`
  - `installed: v0.1.0   embedded: v0.2.0   outdated (run 'ep skill install --force')`
  - `not installed (run 'ep skill install')`
- **--json output**:
  ```json
  {
    "installed": true,
    "installedVersion": "v0.1.0",
    "embeddedVersion": "v0.1.0",
    "upToDate": true,
    "path": "~/.claude/skills/english-punch"
  }
  ```
  When not installed, `installed: false` and
  `installedVersion: ""`.
- **Tokens**: none (read-only query). Filesystem-level errors
  that are not "file does not exist" (e.g. permission denied
  reading the directory) return `SKILL_READ_FAILED`.

---

## Error tokens to add

Five new tokens in `cli/internal/ep/common/errors.go`, registered
in `CanonicalTokens`, and exercised by real call sites in
`cmd/skill.go` (so the existing `TestErrorTokens_Lint` validates
them at test time):

| Token                    | When                                             |
|---|---|
| `SKILL_ALREADY_INSTALLED` | Same-version install without `--force`           |
| `SKILL_VERSION_MISMATCH`  | Different-version install without `--force`     |
| `SKILL_NOT_INSTALLED`     | Uninstall with no target directory present     |
| `SKILL_WRITE_FAILED`      | Filesystem write / remove error                  |
| `SKILL_READ_FAILED`       | Filesystem read error (excluding not-found)    |

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
coincidentally (os.UserHomeDir is cross-platform) but the path
convention `~/.claude/skills/` may not match how Claude Code
locates skills on those platforms. Flagged in open questions.

---

## Testing

### Unit tests (`skill/skill_test.go`)

1. `TestInstall_Fresh` — empty temp dir, install, verify
   SKILL.md + VERSION exist, verify VERSION content matches
   `EmbeddedVersion`.
2. `TestInstall_AlreadyInstalled` — install twice without
   `--force`, second call returns `SKILL_ALREADY_INSTALLED`.
3. `TestInstall_VersionMismatch` — pre-populate target with a
   stale VERSION ("0.0.1"), install without `--force`, expect
   `SKILL_VERSION_MISMATCH`.
4. `TestInstall_Force` — pre-populate target, install with
   force=true, verify files overwritten.
5. `TestUninstall_Installed` — install, uninstall, verify dir
   gone.
6. `TestUninstall_NotInstalled` — uninstall empty temp dir,
   expect `SKILL_NOT_INSTALLED`.
7. `TestStatus_NotInstalled` — verify `installed: false`.
8. `TestStatus_UpToDate` — install, verify
   `installed: true, upToDate: true`.
9. `TestStatus_Outdated` — install, corrupt VERSION to "0.0.1",
   verify `upToDate: false`.
10. `TestEmbeddedVersionMatchesVersionFile` — reads the embedded
    `VERSION` file, compares against `EmbeddedVersion` const.
    Catches drift between the two sources of truth.

All tests use `t.TempDir()` as `--target` — no real
`~/.claude/` writes during `go test`.

### Command-layer tests (`cmd/skill_test.go`)

Three flag-validation tests following the `cards_test.go`
pattern: missing positional args (none expected), unknown flags
rejected, `--target` propagated correctly. Heavy logic already
lives under `skill/` and is covered by the package tests.

### Existing guardrails

- `TestCommands_HaveCompleteHelp` catches missing `Long` /
  `Example` / flag `Usage` on the new subcommands.
- `TestErrorTokens_Lint` validates every `NewTokenError` call in
  `cmd/skill.go` against `CanonicalTokens`.
- `TestErrorTokens_ConstRegistryDrift` catches a token defined
  in the const block but absent from `CanonicalTokens`.

---

## Minimal `SKILL.md` stub

For v1 the embedded content is just enough to prove the pipe
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

## Version

Bumped in lockstep with `cli/internal/ep/skill/version.go`
`EmbeddedVersion`.
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

    To update later (when you upgrade ep):
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
- `cli/internal/ep/skill/version.go`
- `cli/internal/ep/skill/install.go`
- `cli/internal/ep/skill/uninstall.go`
- `cli/internal/ep/skill/status.go`
- `cli/internal/ep/skill/skill_test.go`
- `cli/internal/ep/skill/content/SKILL.md`
- `cli/internal/ep/skill/content/VERSION`
- `cli/internal/ep/cmd/skill.go`
- `cli/internal/ep/cmd/skill_test.go`

### Modified

- `cli/internal/ep/common/errors.go` — five new tokens
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
   `cli/internal/ep/skill/content/SKILL.md` and
   `cli/internal/ep/skill/content/VERSION` (plain "0.1.0\n").
2. **Embed + version**: create `embed.go` and `version.go`.
3. **Core logic**: `install.go`, `uninstall.go`, `status.go` as
   plain functions taking a target path and the embed.FS.
4. **Tokens**: add the five new tokens to
   `common/errors.go` (const block + `CanonicalTokens`).
5. **Command layer**: `cmd/skill.go` with
   `newSkillCmd() / newSkillInstallCmd() / newSkillUninstallCmd() / newSkillStatusCmd()`. Each command wires flags
   through to the `skill` package and handles `--json` via
   `HandleOKOutput` (install / uninstall) or `HandleOutput`
   (status).
6. **Register**: add `newSkillCmd()` in `root.go`.
7. **Tests**: `skill/skill_test.go` (ten cases above) and
   `cmd/skill_test.go` (three flag tests).
8. **Gates**: `go vet && go test && go build && golangci-lint
   run`.
9. **Smoke tests** (from the built binary):
   - `ep skill status` on a clean machine → "not installed"
   - `ep skill install --target /tmp/ep-skill-test` → files
     written
   - `ep skill status --target /tmp/ep-skill-test` → up-to-date
   - `ep skill install --target /tmp/ep-skill-test` → should
     return `SKILL_ALREADY_INSTALLED`
   - `ep skill install --target /tmp/ep-skill-test --force` →
     success
   - `ep skill uninstall --target /tmp/ep-skill-test` → removed
10. **Commit + push**.

---

## Open questions

1. **Version strategy**: tie `EmbeddedVersion` to the ep CLI
   version or bump it independently? Recommendation: **separate
   constant**, bumped when content changes. A CLI release that
   does not touch the skill leaves users' installs untouched.
2. **Linux / Windows target path**: `~/.claude/skills/` is the
   macOS convention. Does Claude Code use the same path on
   other platforms? If not, v1 ships macOS-only and returns a
   `SKILL_UNSUPPORTED_PLATFORM` token elsewhere. Needs
   verification before shipping on those platforms.
3. **User customization protection**: if the user edits the
   installed `SKILL.md` by hand and then runs `install
   --force`, we clobber their edits silently. Should the command
   back up the old file to `SKILL.md.bak` first? v1 says no
   (keeps the code simple); document the behavior in `Long`.
4. **Atomic install**: write to a temp dir and rename? Overkill
   for v1 (two files, ~5KB total). Revisit if the skill grows
   large enough that a partial install becomes likely.
5. **SKILL.md content**: the stub is deliberately minimal.
   Writing the actual English-learning loop prompt is a
   separate content-design work stream — the pipeline needs to
   exist first so we have somewhere to put the content.
