# `ep` CLI — LLM-as-Caller Design Rules

## Why this file exists

- The primary consumer of `ep` is a Claude Code skill driving an English-learning loop. A human terminal user is a welcome side-effect, not the design target.
- Every design choice must be re-weighed against: **"Can an LLM agent call this via a Bash tool and reliably parse the result?"**
- If a design choice helps humans but makes LLM consumption harder, the LLM wins.

## The five rules (non-negotiable)

### 1. `--json` on every command, always

- Every command that returns data — including confirmation-only mutations — MUST support `--json`.
- Follow the existing discovery pattern from `cli/internal/ep/common/jsonflag.go`: `--json` with no fields prints available fields; `--json f1,f2` filters.
- For mutations with no server return value, emit `{"ok": true, ...}` via `common.PrintJSONOK`.
- Default (non-`--json`) output is the fallback, not the design target.

### 2. Deterministic exit codes + pattern-matchable error tokens

- Exit codes stay in the existing `common/errors.go` buckets: `0` success, `1` general, `2` auth, `3` connection.
- Every error line written to stderr MUST start with an UPPER_SNAKE_CASE token from the canonical registry in `cli/internal/ep/common/errors.go`, followed by a colon and a human explanation.
- Examples of good tokens: `NOT_LOGGED_IN`, `NO_DEFAULT_BAG`, `BAG_NOT_FOUND`, `REVIEW_ALREADY_PENDING`, `CONTEXT_AND_QUESTION_EXCLUSIVE`.
- Never add a new token in English-prose format; add it to the `const` block and document it here.

### 3. Idempotency where feasible

- Read-only queries are idempotent by construction. No work needed.
- Mutations MUST be safe to retry after a timeout or network blip. Options:
  - Row-existence semantics (e.g., `pendingReviews` — starting a review when one exists returns the existing row instead of creating a second).
  - Client-generated idempotency keys passed to the server.
  - Natural keys (e.g., upsert-by-name).
- If a mutation cannot be made idempotent, document the reason in its command `Long` text so the skill knows to handle it with retry-caution.

### 4. Self-describing `--help`

- Every cobra command MUST set `Short`, `Long`, `Example`, and a description for every flag.
- `Example` is mandatory — show at least one realistic invocation with expected output shape.
- The skill discovers commands via `ep <verb> --help` at runtime; missing help is a broken contract.
- A Go test asserts help completeness; do not merge commands that fail it.

### 5. Minimal chrome in default output

- No ANSI colors, spinners, progress bars, animated dots, or multi-line ASCII tables in the default output path.
- One machine-parseable fact per line, or a small block of `key: value` lines for summaries.
- If color is ever added, it MUST be gated on `term.IsTerminal(int(os.Stdout.Fd()))` AND a `--color=auto|always|never` flag defaulting to `never`.
- Confirmations after mutations should be short and greppable (`Default bag set to <id>`, not `✨ Nice! Your default bag is now set to <id>! ✨`).

## What this forbids

- **Interactive prompts as the only path.** If a command ever prompts (e.g., `ep auth login` password entry), it MUST also accept the same input via flags so the skill can drive it non-interactively, and MUST fail fast with a clear token (`NOT_A_TTY`) when stdin is not a terminal and flags are missing.
- **Free-form error messages as the primary signal.** The English text after the colon is for humans; the token before the colon is the API.
- **Implicit assumptions about terminal width.** Don't wrap, don't truncate — print the full value and let the shell/tool handle display.
- **"See README" gaps in help.** If a flag's behavior is non-obvious, document it inline.
- **Emojis in output.** Stay parseable. (Global rule across the codebase, but especially here.)

## Writing a new command — checklist

Before merging a new `ep` subcommand, confirm:

- [ ] `--json` works and has a documented field list
- [ ] Every error path starts with a registered token from `common/errors.go`
- [ ] Mutation is idempotent OR the `Long` help explains why it is not
- [ ] `Short`, `Long`, `Example`, and every flag description are filled in
- [ ] Default output has no ANSI, no spinners, no progress bars, no emoji
- [ ] The help-text Go test passes (`go test ./internal/ep/cmd/...`)
- [ ] The error-token Go test passes (`go test ./internal/ep/common/...`)
- [ ] `cd cli && ~/go/bin/golangci-lint run` reports **0 issues** — this catches `errcheck` / `staticcheck` violations that plain `go vet` misses. Do not skip: CI runs `golangci-lint` and will fail the push if anything slips through.

## Creating bags and cards

```bash
# Create a new bag and return its ID without changing the default bag.
ep bags create "TOEFL Speaking" --json ok,bagId,name

# Only the answer and question are required; optional fields stay blank.
ep cards create "curriculum" --bag <bag-id> --question "교육과정" --json ok,cardId

# Explicit empty strings also save blank hints and explanations (descriptions).
ep cards create "curriculum" --bag <bag-id> --question "교육과정" --hint "" --explanation ""
```

- `ep bags create --json` discovers output fields without creating a bag or requiring login.
- Creation trims leading and trailing whitespace. Bag names, card questions, and card answers must be non-empty.
- Bag and card creation are not idempotent: the backend permits duplicates and has no idempotency key. After a timeout, inspect existing bags or cards before retrying.

## Device login and credential storage

Tracked in [#96](https://github.com/englishpunch/english-punch-app/issues/96)
and [#100](https://github.com/englishpunch/english-punch-app/issues/100).

`ep auth login` uses OAuth device authorization, following the browser approval
pattern of `gh auth login`. It prints a one-time code and `https://ep.echoja.com/device`
to stderr, then polls until approved, denied, canceled, or expired. No local callback
server, terminal input, client secret, or CLI password prompt is needed. `--web`
opens the approval page; otherwise it can be opened on another device. Check that
the code matches the terminal before approving. Login is not idempotent: each
invocation creates a new 15-minute authorization request.

```sh
# Default: OS keyring, with optional automatic browser opening.
ep auth login --web

# Explicit plaintext token storage for environments without keyring access.
ep auth login --storage file

ep auth status --json loggedIn,email,storage,credentialsFile,plaintext
ep bags list --json _id,name
```

Both backends store OAuth access and refresh tokens, never an account password.
Access tokens last one hour. Refresh tokens rotate and expire after 30 days of
inactivity; expired/revoked sessions require another device login. Refresh is
serialized across local CLI processes to prevent accidental refresh-token replay.
Do not copy a login between machines or backends: start a separate device login
for each, so each has its own refresh-token family. `auth export` is not provided.

The CLI uses `zalando/go-keyring` by default. On macOS this still invokes
`/usr/bin/security` and does not bypass Keychain sandbox restrictions. OAuth
credentials use service `english-punch-cli-oauth`, account `session`. Legacy
password entries under `english-punch-cli` are not read or migrated; sign in once
with the new device flow. Those old entries can be removed through Keychain Access.

File mode writes plaintext to `~/.config/english-punch/auth/credentials.json`,
or the corresponding location under `--config-dir`. The `auth` directory has
mode `0700`; the file has mode `0600`. Reads reject group/other-accessible files
or directories, symlinks, and malformed credentials. Writes replace the file
atomically. Other applications running as the same OS user may still read it.
File mode requires POSIX permissions and is unavailable on Windows; use its
native keyring instead.

Login persists `auth_storage` in `config.yaml`. Global `--storage` overrides it
for one command. File mode never accesses the keyring; neither backend silently
falls back to the other. A restricted environment needs file-read access and
outbound HTTPS. Refresh also requires permission to write the token and lock
files. Device flow itself does not grant filesystem or network permissions.
The current CLI pins device login to EP's production issuer and Convex backend.

`EP_TOKEN` supplies an externally managed access token and takes precedence over
stored tokens, like `GH_TOKEN`. It is not persisted or refreshed. `auth status`
reports `storage: environment`. Unset it before login/logout of saved credentials.
Never print the variable's value. For example, configure it through the calling
environment's secret mechanism, then run `ep bags list --json _id,name`.

`ep auth logout` deletes only the selected backend and retains the selection.
Other stored logins are retained; explicitly select each backend to remove it.
Logout removes local credentials, not already issued server sessions. It is
idempotent when credentials are absent.

```sh
ep auth logout --storage keyring
ep auth logout --storage file
```

`NOT_LOGGED_IN` means missing, expired, or revoked credentials. `KEYCHAIN_FAILED`
and `CREDENTIAL_STORAGE_FAILED` distinguish keyring and file errors.
`DEVICE_AUTH_DENIED`, `DEVICE_AUTH_EXPIRED`, and `DEVICE_AUTH_CANCELED` identify
terminal device-login states; other OAuth failures use `OAUTH_FAILED`.
Convex request failures retain their `CONVEX_*` tokens. Diagnostics never print
tokens or password contents. Bare `--json` discovers fields before accessing
credentials or starting a device login; explicit JSON fields produce a single
result on stdout, with device instructions on stderr.

## References

- Active migration plan: `thoughts/plans/2026-04-11-cli-llm-as-caller.md`
- Canonical token registry: `cli/internal/ep/common/errors.go`
- JSON flag helper: `cli/internal/ep/common/jsonflag.go`
- Existing commands as reference: `ep bags list` (good `--json` example), `ep auth login` (device flow)
