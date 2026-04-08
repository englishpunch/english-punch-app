---
date: 2026-04-08
researcher: echoja
topic: Best practices for building extensible CLI programs in Go (Cobra, Viper, keychain, goreleaser)
tags: [cli, go, cobra, best-practices]
status: complete
---

# Best Practices for Building Extensible CLI Programs

> Distilled from [timescale/tiger-cli](https://github.com/timescale/tiger-cli) and general CLI design principles.

---

## 1. Clean Entry Point

Keep `main()` minimal. Delegate everything to a `run()` function that returns an error, so you can test and handle exit codes cleanly.

```go
func main() {
    if err := run(); err != nil {
        if exitErr, ok := err.(interface{ ExitCode() int }); ok {
            os.Exit(exitErr.ExitCode())
        }
        os.Exit(1)
    }
}

func run() error {
    ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
    defer cancel()
    return cmd.Execute(ctx)
}
```

**Why:** Testability. `run()` can be called from tests without `os.Exit` killing the process. Signal handling at the top ensures every command gets a cancellable context for free.

---

## 2. Builder Pattern for Commands

Each command (or command group) lives in its own file and is constructed via a `buildXxxCmd()` function. The root command registers them with `AddCommand()`.

```go
// root.go
cmd.AddCommand(buildAuthCmd())
cmd.AddCommand(buildServiceCmd())
cmd.AddCommand(buildDbCmd())

// auth.go
func buildAuthCmd() *cobra.Command {
    cmd := &cobra.Command{Use: "auth", Short: "Manage authentication"}
    cmd.AddCommand(buildLoginCmd())
    cmd.AddCommand(buildLogoutCmd())
    cmd.AddCommand(buildStatusCmd())
    return cmd
}
```

**Why:** Adding a new command = creating a new file + one `AddCommand()` line. No globals, no registration maps, no interface to implement. Each file is self-contained with its own flags, validation, and run logic.

---

## 3. Layered Architecture

Separate concerns into distinct packages:

```
cmd/tiger/main.go            # Entry point only
internal/tiger/
  cmd/                        # Command definitions (flags, UX, output formatting)
  api/                        # HTTP client (auto-generated from OpenAPI spec)
  config/                     # Config loading, credential storage
  common/                     # Shared helpers (validation, spinner, wait logic)
  analytics/                  # Telemetry (never blocks user actions)
  logging/                    # Structured logging (zap)
  mcp/                        # MCP server (AI interface)
```

**Key rule:** Commands handle UX (flags, prompts, formatting). They call into `common/` and `api/` for business logic and HTTP. Commands never make raw HTTP requests directly.

---

## 4. Three-Tier Configuration

Use Viper to layer configuration from multiple sources with clear precedence:

```
CLI flags  >  Environment variables  >  Config file  >  Defaults
```

```go
func SetupViper(configDir string) error {
    viper.SetConfigName("config")
    viper.SetConfigType("yaml")
    viper.AddConfigPath(configDir)
    viper.SetEnvPrefix("TIGER")
    viper.AutomaticEnvReplace("_")  // TIGER_SERVICE_ID -> service_id
    // ... set defaults
}
```

**Why:** Users can set-and-forget values in config, override per-session with env vars, and override per-command with flags. The `--config-dir` flag allows multiple profiles.

---

## 5. Decorator Pattern for Cross-Cutting Concerns

Apply analytics, logging, or auth checks by recursively wrapping all commands — not by scattering code into each command:

```go
func wrapCommandsWithAnalytics(cmd *cobra.Command) {
    if cmd.RunE != nil {
        originalRunE := cmd.RunE
        cmd.RunE = func(c *cobra.Command, args []string) (runErr error) {
            start := time.Now()
            defer func() {
                a.Track(fmt.Sprintf("Run %s", c.CommandPath()),
                    analytics.Property("elapsed_seconds", time.Since(start).Seconds()),
                    analytics.FlagSet(c.Flags()),
                    analytics.Error(runErr),
                )
            }()
            return originalRunE(c, args)
        }
    }
    for _, child := range cmd.Commands() {
        wrapCommandsWithAnalytics(child)
    }
}
```

**Why:** Add one call in `root.go`, and every command — including future ones — is automatically instrumented. Zero per-command boilerplate.

---

## 6. Output Format as a First-Class Citizen

Support `--output` (`json`, `yaml`, `table`) on every data-returning command. Separate status messages from data:

```go
// Status messages → stderr (for humans)
fmt.Fprintf(cmd.ErrOrStderr(), "Creating service '%s'...\n", name)

// Data → stdout (for piping)
switch format {
case "json": return util.SerializeToJSON(cmd.OutOrStdout(), data)
case "yaml": return util.SerializeToYAML(cmd.OutOrStdout(), data)
default:     return renderTable(cmd.OutOrStdout(), data)
}
```

**Why:** Machine-readable output makes your CLI composable with `jq`, scripts, and CI pipelines. Keeping status on stderr means `tiger service list -o json | jq '.[]'` works cleanly.

---

## 7. Structured Error Handling with Exit Codes

Define semantic exit codes and a custom error type:

```go
const (
    ExitSuccess             = 0
    ExitGeneralError        = 1
    ExitAuthenticationError = 2
    ExitConnectionRefused   = 3
)

type ExitError struct {
    Code int
    Err  error
}
func (e *ExitError) ExitCode() int { return e.Code }
func (e *ExitError) Error() string { return e.Err.Error() }
```

**Why:** Scripts and CI can branch on exit codes (`if tiger db test-connection; then ...`). This is especially valuable for health-check or probe commands.

---

## 8. Analytics That Never Block

Analytics should be fire-and-forget with its own timeout, using `context.Background()` so it survives command cancellation:

```go
func (a *Analytics) Track(event string, options ...Option) {
    if !a.enabled() { return }

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    resp, err := a.client.TrackEventWithResponse(ctx, body)
    if err != nil {
        logger.Debug("Failed to send analytics", zap.Error(err))
        return  // Never fail the user's operation
    }
}
```

Also respect `DO_NOT_TRACK`, `NO_TELEMETRY` environment variables, and filter sensitive data (passwords, keys) from events with an explicit ignore list.

---

## 9. Testability via Overridable Functions

Use package-level variables for functions that need to be mocked in tests:

```go
// Production default
var validateAPIKey = common.ValidateAPIKey

// In tests
func TestLogin(t *testing.T) {
    validateAPIKey = func(ctx context.Context, ...) (*api.AuthInfo, error) {
        return &api.AuthInfo{...}, nil
    }
    defer func() { validateAPIKey = common.ValidateAPIKey }()
}
```

**Why:** Avoids heavy interface hierarchies while keeping commands testable. Commands call through the variable; tests swap the implementation.

---

## 10. Shell Completion for Every Command

Always provide completion functions for arguments:

```go
cmd := &cobra.Command{
    Use:               "get [service-id]",
    ValidArgsFunction: serviceIDCompletion,  // Dynamic completions from API
}

// For commands that take no file arguments:
ValidArgsFunction: cobra.NoFileCompletions
```

**Why:** Tab completion is the difference between a CLI that feels polished and one that feels like a prototype. With Cobra, it's nearly free.

---

## 11. Convenience Config Wrapper

Bundle frequently co-occurring dependencies into a single struct:

```go
type Config struct {
    *config.Config
    Client    *api.ClientWithResponses
    ProjectID string
}

func LoadConfig(ctx context.Context) (*Config, error) {
    cfg, err := config.Load()
    client, projectID, _ := NewAPIClient(ctx, cfg)
    return &Config{Config: cfg, Client: client, ProjectID: projectID}, nil
}
```

**Why:** Almost every command needs config + API client + project ID. Loading them together eliminates repetitive boilerplate in every `RunE`.

---

## 12. Command Aliases and UX Niceties

```go
cmd := &cobra.Command{
    Use:     "service",
    Aliases: []string{"services", "svc"},   // Plural and abbreviation
}

subCmd := &cobra.Command{
    Use:     "get [service-id]",
    Aliases: []string{"describe", "show"},  // Kubectl-familiar alternatives
}
```

Other UX patterns from tiger-cli:
- **`cmd.SilenceUsage = true`** inside `RunE` — only show usage on argument errors, not on runtime failures.
- **Auto-generated names** when the user doesn't provide one (`common.GenerateServiceName()`).
- **Interactive prompts** with TTY detection fallback: if not a terminal, error with a clear message telling them to use flags.

---

## 13. Dual Interface: CLI + MCP Server

Expose the same capabilities through both a CLI and an MCP (Model Context Protocol) server:

```go
func (s *Server) registerTools(ctx context.Context) {
    s.registerServiceTools()     // Same operations as `tiger service *`
    s.registerDatabaseTools()    // Same operations as `tiger db *`
    s.registerDocsProxy(ctx)
}
```

The MCP server reuses the same `api/` and `common/` packages, just wired through MCP tool handlers instead of Cobra commands.

**Why:** AI coding assistants (Claude, Cursor, etc.) can use your CLI's capabilities programmatically. Your CLI becomes both a human tool and an AI tool with shared business logic.

---

## 14. OpenAPI-Generated API Client

Don't hand-write HTTP client code. Generate it from an OpenAPI spec:

```go
//go:generate oapi-codegen -config codegen.yaml ../../api/openapi.yaml
```

This gives you:
- Type-safe request/response structs
- `ClientWithResponses` wrapper that parses JSON automatically
- Consistent error handling via `resp.StatusCode()` and `resp.JSON4XX`

---

## 15. Secure Credential Management

```
Precedence: CLI flags → Environment variables → Keyring → Fallback file

Storage:    System keyring (macOS Keychain, Linux secret-service)
            ↓ fallback
            File with restricted permissions (0600)
```

- Never log or track credentials in analytics (use an explicit ignore list).
- Store API keys as `public:secret` combined strings.
- Cache validated credentials in-memory to avoid redundant auth checks.

---

## Summary Checklist

| Practice | Benefit |
|----------|---------|
| Clean `main()` → `run()` | Testability, clean exit codes |
| Builder functions per command | Easy to add commands, self-contained files |
| `cmd/` → `common/` → `api/` layers | Separation of concerns |
| Config: flags > env > file > defaults | Flexibility without complexity |
| Recursive command wrapping | Zero-boilerplate cross-cutting concerns |
| `--output json\|yaml\|table` | Composability with scripts and pipes |
| Semantic exit codes | Scriptable health checks and CI |
| Non-blocking analytics | Never degrade user experience |
| Overridable function vars | Lightweight testability |
| Shell completions everywhere | Polished UX |
| Dual CLI + MCP interface | Human and AI accessibility |
| Generated API client | Type safety, less maintenance |
| Keyring + fallback credentials | Security with usability |
