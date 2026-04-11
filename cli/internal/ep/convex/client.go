package convex

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
)

// Client communicates with the Convex HTTP API.
type Client struct {
	BaseURL    string
	HTTPClient *http.Client
	Token      string // JWT, set after SignIn
}

// NewClient creates a Convex client for the given deployment URL.
func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL:    baseURL,
		HTTPClient: http.DefaultClient,
	}
}

// User represents the logged-in user from Convex.
type User struct {
	ID    string `json:"_id"`
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

type request struct {
	Path string `json:"path"`
	Args any    `json:"args"`
}

type response struct {
	Value json.RawMessage `json:"value"`
	// Convex error fields
	ErrorMessage string `json:"errorMessage,omitempty"`
	ErrorData    any    `json:"errorData,omitempty"`
}

func (c *Client) do(ctx context.Context, endpoint, path string, args any) (json.RawMessage, error) {
	body := request{Path: path, Args: args}
	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := c.BaseURL + endpoint
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, common.NewConnectionTokenError(common.TokenConvexUnreachable, "convex request failed", err)
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, common.NewConnectionTokenError(common.TokenConvexUnreachable, "read response", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, common.NewConnectionTokenError(
			common.TokenConvexHTTPError,
			fmt.Sprintf("convex returned HTTP %d: %s", resp.StatusCode, string(respBody)),
			nil,
		)
	}

	var result response
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, common.NewConnectionTokenError(common.TokenConvexHTTPError, "unmarshal response", err)
	}

	if result.ErrorMessage != "" {
		return nil, common.NewTokenError(common.TokenConvexAPIError, result.ErrorMessage, nil)
	}

	return result.Value, nil
}

// Action calls a Convex action.
func (c *Client) Action(ctx context.Context, path string, args any) (json.RawMessage, error) {
	return c.do(ctx, "/api/action", path, args)
}

// Query calls a Convex query.
func (c *Client) Query(ctx context.Context, path string, args any) (json.RawMessage, error) {
	return c.do(ctx, "/api/query", path, args)
}

// Mutation calls a Convex mutation.
func (c *Client) Mutation(ctx context.Context, path string, args any) (json.RawMessage, error) {
	return c.do(ctx, "/api/mutation", path, args)
}

// SignIn authenticates with Convex and sets the JWT token on the
// client. Preserves underlying *common.ExitError types (so
// CONVEX_UNREACHABLE / CONVEX_HTTP_ERROR from the transport layer
// propagate as connection errors, not auth errors) and only wraps
// Convex-side rejections as INVALID_CREDENTIALS.
func (c *Client) SignIn(ctx context.Context, email, password string) error {
	args := map[string]any{
		"provider": "password",
		"params": map[string]any{
			"email":    email,
			"password": password,
			"flow":     "signIn",
		},
	}

	raw, err := c.Action(ctx, "auth:signIn", args)
	if err != nil {
		var ee *common.ExitError
		if errors.As(err, &ee) && ee.Code != common.ExitGeneralError {
			return err
		}
		return common.NewAuthTokenError(common.TokenInvalidCredentials, "sign in failed", err)
	}

	var result struct {
		Tokens struct {
			Token string `json:"token"`
		} `json:"tokens"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return common.NewAuthTokenError(common.TokenInvalidCredentials, "parse sign in response", err)
	}

	if result.Tokens.Token == "" {
		return common.NewAuthTokenError(common.TokenInvalidCredentials, "authentication failed: no token received", nil)
	}

	c.Token = result.Tokens.Token
	return nil
}

// GetCurrentUser returns the currently authenticated user. Preserves
// underlying transport errors and wraps Convex-side rejections as
// NOT_LOGGED_IN (expired or missing token).
func (c *Client) GetCurrentUser(ctx context.Context) (*User, error) {
	raw, err := c.Query(ctx, "auth:loggedInUser", map[string]any{})
	if err != nil {
		var ee *common.ExitError
		if errors.As(err, &ee) && ee.Code != common.ExitGeneralError {
			return nil, err
		}
		return nil, common.NewAuthTokenError(common.TokenNotLoggedIn, "get current user", err)
	}

	var user User
	if err := json.Unmarshal(raw, &user); err != nil {
		return nil, common.NewAuthTokenError(common.TokenNotLoggedIn, "parse user", err)
	}
	return &user, nil
}
