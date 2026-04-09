package common

import (
	"errors"
	"fmt"
	"testing"
)

func TestExitError_Error(t *testing.T) {
	tests := []struct {
		name string
		err  *ExitError
		want string
	}{
		{
			name: "message only",
			err:  &ExitError{Code: ExitAuthError, Message: "not logged in"},
			want: "not logged in",
		},
		{
			name: "message with wrapped error",
			err:  &ExitError{Code: ExitConnectionError, Message: "connect failed", Err: fmt.Errorf("timeout")},
			want: "connect failed: timeout",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.err.Error(); got != tt.want {
				t.Errorf("Error() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestExitError_Unwrap(t *testing.T) {
	inner := fmt.Errorf("inner")
	err := &ExitError{Code: 1, Message: "outer", Err: inner}
	if !errors.Is(err, inner) {
		t.Error("Unwrap should expose inner error")
	}
}

func TestNewAuthError(t *testing.T) {
	err := NewAuthError("bad creds", nil)
	if err.Code != ExitAuthError {
		t.Errorf("Code = %d, want %d", err.Code, ExitAuthError)
	}
}

func TestNewConnectionError(t *testing.T) {
	err := NewConnectionError("timeout", fmt.Errorf("dial"))
	if err.Code != ExitConnectionError {
		t.Errorf("Code = %d, want %d", err.Code, ExitConnectionError)
	}
	if !errors.Is(err, fmt.Errorf("dial")) {
		// Unwrap check
		var inner error
		inner = errors.Unwrap(err)
		if inner == nil || inner.Error() != "dial" {
			t.Errorf("Unwrap = %v, want dial error", inner)
		}
	}
}
