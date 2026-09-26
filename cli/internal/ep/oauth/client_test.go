package oauth

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"testing/synctest"
	"time"
)

type transport func(*http.Request) (*http.Response, error)

func (f transport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func response(status int, body string) (*http.Response, error) {
	return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body))}, nil
}

const tokenBody = `{"access_token":"secret-access","refresh_token":"secret-refresh","expires_in":3600,"scope":"cli:access","token_type":"Bearer"}`

func TestPollingRespectsPendingAndSlowDown(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		client := NewClient(Issuer, Resource)
		start := time.Now()
		calls := 0
		client.HTTP.Transport = transport(func(r *http.Request) (*http.Response, error) {
			calls++
			if err := r.ParseForm(); err != nil {
				t.Fatal(err)
			}
			if r.Form.Get("device_code") != "secret-device" || r.Form.Get("grant_type") != DeviceGrant || r.Form.Get("client_id") != ClientID || r.Form.Get("resource") != Resource {
				t.Fatal("incorrect token binding")
			}
			switch calls {
			case 1:
				if time.Since(start) != 5*time.Second {
					t.Fatal("polled before initial interval")
				}
				return response(400, `{"error":"authorization_pending"}`)
			case 2:
				if time.Since(start) != 10*time.Second {
					t.Fatal("incorrect pending interval")
				}
				return response(400, `{"error":"slow_down"}`)
			default:
				if time.Since(start) != 20*time.Second {
					t.Fatal("did not add five seconds on slow_down")
				}
				return response(200, tokenBody)
			}
		})
		tokens, err := client.Poll(context.Background(), &Device{DeviceCode: "secret-device", Interval: 5, ExpiresIn: 60})
		if err != nil || tokens.AccessToken != "secret-access" || calls != 3 {
			t.Fatalf("unexpected result: %v, calls=%d", err, calls)
		}
	})
}

func TestPollingTerminalErrorsAndExpiry(t *testing.T) {
	for _, code := range []string{"access_denied", "expired_token", "invalid_grant", "unknown-secret-error"} {
		t.Run(code, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				client := NewClient(Issuer, Resource)
				calls := 0
				client.HTTP.Transport = transport(func(_ *http.Request) (*http.Response, error) {
					calls++
					return response(400, fmt.Sprintf(`{"error":%q}`, code))
				})
				_, err := client.Poll(context.Background(), &Device{Interval: 1, ExpiresIn: 60})
				want := code
				if code == "unknown-secret-error" {
					want = "request_failed"
				}
				if !errors.Is(err, Error(want)) || calls != 1 {
					t.Fatalf("terminal error: %v, calls=%d", err, calls)
				}
			})
		})
	}
	synctest.Test(t, func(t *testing.T) {
		client := NewClient(Issuer, Resource)
		client.HTTP.Transport = transport(func(_ *http.Request) (*http.Response, error) {
			return response(400, `{"error":"authorization_pending"}`)
		})
		_, err := client.Poll(context.Background(), &Device{Interval: 5, ExpiresIn: 12})
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("expiry: %v", err)
		}
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		_, err = client.Poll(ctx, &Device{Interval: 5, ExpiresIn: 60})
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("cancellation: %v", err)
		}
	})
}

func TestDeviceValidationAndRefresh(t *testing.T) {
	client := NewClient(Issuer, Resource)
	client.HTTP.Transport = transport(func(_ *http.Request) (*http.Response, error) {
		return response(200, `{"device_code":"secret","user_code":"ABCD-EFGH","verification_uri":"https://evil.example/device","expires_in":900}`)
	})
	if _, err := client.Start(context.Background()); !errors.Is(err, Error("invalid_response")) {
		t.Fatalf("accepted untrusted verification URL: %v", err)
	}
	client.HTTP.Transport = transport(func(r *http.Request) (*http.Response, error) {
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if r.Form.Get("refresh_token") != "secret-refresh" || r.Form.Get("grant_type") != "refresh_token" {
			t.Fatal("incorrect refresh request")
		}
		return response(200, tokenBody)
	})
	if _, err := client.Refresh(context.Background(), "secret-refresh"); err != nil {
		t.Fatal(err)
	}
	client.HTTP.Transport = transport(func(_ *http.Request) (*http.Response, error) {
		return response(200, `{"access_token":"sensitive-marker"}`)
	})
	if _, err := client.Refresh(context.Background(), "secret-refresh"); !errors.Is(err, Error("invalid_response")) {
		t.Fatalf("accepted incomplete tokens: %v", err)
	}
}
