package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/echoja/english-punch-app/cli/internal/ep/common"
	"github.com/echoja/english-punch-app/cli/internal/ep/convex"
)

func TestBagsUpdate(t *testing.T) {
	for _, tc := range []struct {
		name     string
		args     []string
		fields   []string
		json     bool
		response string
		token    string
		calls    int
	}{
		{name: "success JSON", args: []string{" bag-1 ", "--name", " TOEFL Speaking "}, json: true, fields: []string{"ok", "bagId", "name"}, response: `{"value":{"bagId":"bag-1","name":"TOEFL Speaking"}}`, calls: 1},
		{name: "success text", args: []string{"bag-1", "--name", "TOEFL Speaking"}, response: `{"value":{"bagId":"bag-1","name":"TOEFL Speaking"}}`, calls: 1},
		{name: "discovery", json: true},
		{name: "missing id", token: common.TokenMissingRequiredField},
		{name: "missing name", args: []string{"bag-1"}, token: common.TokenMissingRequiredField},
		{name: "blank id", args: []string{" ", "--name", "test"}, token: common.TokenMissingRequiredField},
		{name: "blank name", args: []string{"bag-1", "--name", " \t "}, token: common.TokenMissingRequiredField},
		{name: "too many ids", args: []string{"one", "two"}, token: common.TokenInvalidArgument},
		{name: "invalid output field", args: []string{"bag-1", "--name", "TOEFL Speaking"}, json: true, fields: []string{"missing"}, token: common.TokenInvalidArgument},
		{name: "server rejection", args: []string{"bag-1", "--name", "TOEFL Speaking"}, response: `{"errorMessage":"Bag rejected"}`, token: common.TokenConvexAPIError, calls: 1},
		{name: "malformed response", args: []string{"bag-1", "--name", "TOEFL Speaking"}, response: `{"value":{}}`, token: common.TokenConvexAPIError, calls: 1},
		{name: "empty ID", args: []string{"bag-1", "--name", "TOEFL Speaking"}, response: `{"value":""}`, token: common.TokenConvexAPIError, calls: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			jsonFlag = common.JSONFlag{Used: tc.json, Fields: tc.fields}
			t.Cleanup(func() { jsonFlag = common.JSONFlag{}; bagsAuthenticatedClientFunc = authenticatedClient })
			calls, authCalls := 0, 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				var req struct {
					Path string            `json:"path"`
					Args map[string]string `json:"args"`
				}
				if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
					t.Error(err)
					return
				}
				if r.URL.Path != "/api/mutation" || req.Path != "learning:updateBag" || req.Args["name"] != "TOEFL Speaking" || req.Args["bagId"] != "bag-1" {
					t.Errorf("unexpected request: %s %+v", r.URL.Path, req)
				}
				if _, err := w.Write([]byte(tc.response)); err != nil {
					t.Error(err)
				}
			}))
			defer server.Close()
			bagsAuthenticatedClientFunc = func(context.Context) (*convex.Client, *convex.User, error) {
				authCalls++
				return convex.NewClient(server.URL), &convex.User{ID: "user-1"}, nil
			}
			var err error
			output := captureStdout(t, func() { err = runCardsCommand(newBagsUpdateCmd(), tc.args) })
			if tc.token != "" {
				var ee *common.ExitError
				if !errors.As(err, &ee) || ee.Token != tc.token {
					t.Fatalf("error=%v, want %s", err, tc.token)
				}
			} else if err != nil {
				t.Fatal(err)
			}
			if calls != tc.calls || authCalls != tc.calls {
				t.Fatalf("mutation=%d auth=%d, want %d", calls, authCalls, tc.calls)
			}
			switch tc.name {
			case "success JSON":
				var got map[string]any
				if err := json.Unmarshal([]byte(output), &got); err != nil {
					t.Fatal(err)
				}
				if got["ok"] != true || got["bagId"] != "bag-1" || got["name"] != "TOEFL Speaking" {
					t.Fatalf("output=%s", output)
				}
			case "success text":
				if output != "Updated bag bag-1: TOEFL Speaking\n" {
					t.Fatalf("output=%q", output)
				}
			case "discovery":
				for _, field := range []string{"ok", "bagId", "name"} {
					if !strings.Contains(output, field) {
						t.Errorf("missing field %s: %s", field, output)
					}
				}
			}
		})
	}
}

func TestBagsUpdateAuthError(t *testing.T) {
	jsonFlag = common.JSONFlag{}
	t.Cleanup(func() { bagsAuthenticatedClientFunc = authenticatedClient })
	want := common.NewAuthTokenError(common.TokenNotLoggedIn, "login required", nil)
	bagsAuthenticatedClientFunc = func(context.Context) (*convex.Client, *convex.User, error) { return nil, nil, want }
	if err := runCardsCommand(newBagsUpdateCmd(), []string{"bag-1", "--name", "test"}); err != want {
		t.Fatalf("error=%v, want %v", err, want)
	}
}
