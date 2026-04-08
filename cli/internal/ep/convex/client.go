package convex

import (
	"bytes"
	"context"
	"encoding/json"
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
		return nil, common.NewConnectionError("convex request failed", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, common.NewConnectionError("read response", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, common.NewConnectionError(
			fmt.Sprintf("convex returned HTTP %d: %s", resp.StatusCode, string(respBody)), nil,
		)
	}

	var result response
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if result.ErrorMessage != "" {
		return nil, fmt.Errorf("convex error: %s", result.ErrorMessage)
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

// SignIn authenticates with Convex and sets the JWT token on the client.
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
		return common.NewAuthError("sign in failed", err)
	}

	var result struct {
		Tokens struct {
			Token string `json:"token"`
		} `json:"tokens"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return common.NewAuthError("parse sign in response", err)
	}

	if result.Tokens.Token == "" {
		return common.NewAuthError("authentication failed: no token received", nil)
	}

	c.Token = result.Tokens.Token
	return nil
}

// GetCurrentUser returns the currently authenticated user.
func (c *Client) GetCurrentUser(ctx context.Context) (*User, error) {
	raw, err := c.Query(ctx, "auth:loggedInUser", map[string]any{})
	if err != nil {
		return nil, common.NewAuthError("get current user", err)
	}

	var user User
	if err := json.Unmarshal(raw, &user); err != nil {
		return nil, fmt.Errorf("parse user: %w", err)
	}
	return &user, nil
}
