package common

import "fmt"

const (
	ExitSuccess         = 0
	ExitGeneralError    = 1
	ExitAuthError       = 2
	ExitConnectionError = 3
)

// Token* constants are the canonical error tokens emitted to stderr so
// the Claude Code skill (and shell scripts) can pattern-match without
// parsing free-form English. Add new tokens here AND in CanonicalTokens.
// The TestErrorTokens_* tests in this package enforce the registry.
//
// See docs/cli-llm-as-caller.md for the design rationale.
const (
	// Bag lifecycle
	TokenBagNotFound  = "BAG_NOT_FOUND"
	TokenNoDefaultBag = "NO_DEFAULT_BAG"

	// Auth lifecycle
	TokenNotLoggedIn        = "NOT_LOGGED_IN"
	TokenInvalidCredentials = "INVALID_CREDENTIALS"
	TokenNotATTY            = "NOT_A_TTY"
	TokenKeychainFailed     = "KEYCHAIN_FAILED"

	// Convex transport
	TokenConvexUnreachable = "CONVEX_UNREACHABLE"
	TokenConvexHTTPError   = "CONVEX_HTTP_ERROR"
	TokenConvexAPIError    = "CONVEX_API_ERROR"

	// Config IO
	TokenConfigReadFailed  = "CONFIG_READ_FAILED"
	TokenConfigWriteFailed = "CONFIG_WRITE_FAILED"
)

// CanonicalTokens is the runtime-readable set of valid error tokens,
// used by the AST linter (errortoken_lint_test.go) and by callers that
// need to validate tokens dynamically. Must stay in sync with the
// Token* constants above — the drift test enforces this.
var CanonicalTokens = map[string]struct{}{
	TokenBagNotFound:        {},
	TokenNoDefaultBag:       {},
	TokenNotLoggedIn:        {},
	TokenInvalidCredentials: {},
	TokenNotATTY:            {},
	TokenKeychainFailed:     {},
	TokenConvexUnreachable:  {},
	TokenConvexHTTPError:    {},
	TokenConvexAPIError:     {},
	TokenConfigReadFailed:   {},
	TokenConfigWriteFailed:  {},
}

// ExitError is an error with a specific exit code and an optional
// machine-parseable token. When Token is non-empty it is prefixed to the
// error message as "TOKEN: " so callers can grep on the first colon-
// separated field without parsing English.
type ExitError struct {
	Token   string
	Code    int
	Message string
	Err     error
}

func (e *ExitError) Error() string {
	prefix := ""
	if e.Token != "" {
		prefix = e.Token + ": "
	}
	if e.Err != nil {
		return fmt.Sprintf("%s%s: %v", prefix, e.Message, e.Err)
	}
	return prefix + e.Message
}

func (e *ExitError) Unwrap() error {
	return e.Err
}

func NewAuthError(msg string, err error) *ExitError {
	return &ExitError{Code: ExitAuthError, Message: msg, Err: err}
}

func NewConnectionError(msg string, err error) *ExitError {
	return &ExitError{Code: ExitConnectionError, Message: msg, Err: err}
}

// NewTokenError returns an ExitError with a token and ExitGeneralError
// exit code. Use NewAuthTokenError / NewConnectionTokenError for the
// auth and connection buckets respectively.
func NewTokenError(token, msg string, err error) *ExitError {
	return &ExitError{Token: token, Code: ExitGeneralError, Message: msg, Err: err}
}

func NewAuthTokenError(token, msg string, err error) *ExitError {
	return &ExitError{Token: token, Code: ExitAuthError, Message: msg, Err: err}
}

func NewConnectionTokenError(token, msg string, err error) *ExitError {
	return &ExitError{Token: token, Code: ExitConnectionError, Message: msg, Err: err}
}
