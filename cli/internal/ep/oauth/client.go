// Package oauth implements the public-client OAuth device grant (RFC 8628).
package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const (
	Issuer      = "https://ep.echoja.com"
	Resource    = "https://ep-convex.echoja.com"
	ClientID    = "english-punch-cli"
	DeviceGrant = "urn:ietf:params:oauth:grant-type:device_code"
)

type Client struct {
	Issuer, Resource string
	HTTP             *http.Client
}

func NewClient(issuer, resource string) *Client {
	return &Client{Issuer: issuer, Resource: resource, HTTP: &http.Client{
		Timeout:       20 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
	}}
}

type Device struct {
	DeviceCode              string `json:"device_code"`
	UserCode                string `json:"user_code"`
	VerificationURI         string `json:"verification_uri"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	ExpiresIn               int    `json:"expires_in"`
	Interval                int    `json:"interval"`
}

type Tokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

// Error exposes only recognized protocol errors; never server bodies or tokens.
type Error string

func (e Error) Error() string { return string(e) }

func (c *Client) post(ctx context.Context, path string, form url.Values, target any) error {
	form.Set("client_id", ClientID)
	form.Set("resource", c.Resource)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.Issuer+path, strings.NewReader(form.Encode()))
	if err != nil {
		return Error("invalid_endpoint")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		var netErr net.Error
		if errors.As(err, &netErr) && netErr.Timeout() {
			return Error("connection_timeout")
		}
		return Error("connection_failed")
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024+1))
	if err != nil || len(body) > 64*1024 {
		return Error("invalid_response")
	}
	if resp.StatusCode != http.StatusOK {
		var failure struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(body, &failure) == nil {
			switch failure.Error {
			case "authorization_pending", "slow_down", "access_denied", "expired_token", "invalid_grant", "invalid_client", "invalid_scope", "invalid_target":
				return Error(failure.Error)
			}
		}
		return Error("request_failed")
	}
	if json.Unmarshal(body, target) != nil {
		return Error("invalid_response")
	}
	return nil
}

func (c *Client) Start(ctx context.Context) (*Device, error) {
	var device Device
	if err := c.post(ctx, "/oauth/device/code", url.Values{"scope": {"cli:access"}}, &device); err != nil {
		return nil, err
	}
	// Never print or open an untrusted verification URL returned by a proxy.
	if device.DeviceCode == "" || !regexp.MustCompile(`^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$`).MatchString(device.UserCode) || device.ExpiresIn <= 0 || device.ExpiresIn > 1800 || device.Interval < 0 || device.Interval > device.ExpiresIn || device.VerificationURI != c.Issuer+"/device" {
		return nil, Error("invalid_response")
	}
	if device.Interval == 0 {
		device.Interval = 5
	}
	expected := device.VerificationURI + "?" + url.Values{"user_code": {device.UserCode}}.Encode()
	if device.VerificationURIComplete != "" && device.VerificationURIComplete != expected {
		return nil, Error("invalid_response")
	}
	device.VerificationURIComplete = expected
	return &device, nil
}

func validateTokens(tokens *Tokens) error {
	if tokens.AccessToken == "" || tokens.RefreshToken == "" || !strings.EqualFold(tokens.TokenType, "Bearer") || tokens.ExpiresIn <= 0 || tokens.ExpiresIn > 86400 || tokens.Scope != "cli:access" {
		return Error("invalid_response")
	}
	return nil
}

func (c *Client) Poll(ctx context.Context, device *Device) (*Tokens, error) {
	ctx, cancel := context.WithTimeout(ctx, time.Duration(device.ExpiresIn)*time.Second)
	defer cancel()
	interval := time.Duration(device.Interval) * time.Second
	for {
		timer := time.NewTimer(interval)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil, ctx.Err()
		case <-timer.C:
		}
		var tokens Tokens
		err := c.post(ctx, "/oauth/token", url.Values{"grant_type": {DeviceGrant}, "device_code": {device.DeviceCode}}, &tokens)
		if err == nil {
			return &tokens, validateTokens(&tokens)
		}
		switch {
		case errors.Is(err, Error("authorization_pending")):
		case errors.Is(err, Error("slow_down")):
			interval += 5 * time.Second
		case errors.Is(err, Error("connection_timeout")):
			interval *= 2
		default:
			return nil, err
		}
	}
}

func (c *Client) Refresh(ctx context.Context, refreshToken string) (*Tokens, error) {
	var tokens Tokens
	if err := c.post(ctx, "/oauth/token", url.Values{"grant_type": {"refresh_token"}, "refresh_token": {refreshToken}}, &tokens); err != nil {
		return nil, err
	}
	return &tokens, validateTokens(&tokens)
}
