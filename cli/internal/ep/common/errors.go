package common

import "fmt"

const (
	ExitSuccess         = 0
	ExitGeneralError    = 1
	ExitAuthError       = 2
	ExitConnectionError = 3
)

// ExitError is an error with a specific exit code.
type ExitError struct {
	Code    int
	Message string
	Err     error
}

func (e *ExitError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
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
