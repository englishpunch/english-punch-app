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

func TestCardsCreateOptionalFields(t *testing.T) {
	for _, tc := range []struct {
		name              string
		flags             []string
		hint, explanation string
	}{
		{name: "omitted"},
		{name: "empty", flags: []string{"--hint", "", "--explanation", ""}},
		{name: "whitespace", flags: []string{"--hint", " \t ", "--explanation", "\n "}},
		{name: "hint only", flags: []string{"--hint", " clue "}, hint: "clue"},
		{name: "explanation only", flags: []string{"--explanation", " note "}, explanation: "note"},
		{name: "both", flags: []string{"--hint", " clue ", "--explanation", " note "}, hint: "clue", explanation: "note"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resetCardsCommandTestState()
			t.Cleanup(resetCardsCommandTestState)
			calls := 0
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
				if r.URL.Path != "/api/mutation" || req.Path != "learning:createCard" {
					t.Errorf("unexpected request: %s %+v", r.URL.Path, req)
				}
				for key, want := range map[string]string{"bagId": "bag-1", "userId": "user-1", "answer": "curriculum", "question": "교육과정", "hint": tc.hint, "explanation": tc.explanation} {
					if got, ok := req.Args[key]; !ok || got != want {
						t.Errorf("%s = %q (present %v), want %q", key, got, ok, want)
					}
				}
				if err := json.NewEncoder(w).Encode(map[string]any{"value": "card-1"}); err != nil {
					t.Error(err)
				}
			}))
			defer server.Close()
			cardsAuthenticatedClientFunc = func(context.Context) (*convex.Client, *convex.User, error) {
				return convex.NewClient(server.URL), &convex.User{ID: "user-1"}, nil
			}
			jsonFlag = common.JSONFlag{Used: true, Fields: []string{"ok", "cardId", "hint", "explanation"}}
			output := captureStdout(t, func() {
				args := append([]string{" curriculum ", "--question", " 교육과정 ", "--bag", "bag-1"}, tc.flags...)
				if err := runCardsCreate(args); err != nil {
					t.Fatal(err)
				}
			})
			var got struct {
				OK          bool   `json:"ok"`
				CardID      string `json:"cardId"`
				Hint        string `json:"hint"`
				Explanation string `json:"explanation"`
			}
			if err := json.Unmarshal([]byte(output), &got); err != nil {
				t.Fatal(err)
			}
			if calls != 1 || !got.OK || got.CardID != "card-1" || got.Hint != tc.hint || got.Explanation != tc.explanation {
				t.Fatalf("calls=%d output=%s", calls, output)
			}
		})
	}
}

func TestBagsCreate(t *testing.T) {
	for _, tc := range []struct {
		name     string
		args     []string
		fields   []string
		json     bool
		response string
		token    string
		calls    int
	}{
		{name: "success JSON", args: []string{" TOEFL Speaking "}, json: true, fields: []string{"ok", "bagId", "name"}, response: `{"value":"bag-1"}`, calls: 1},
		{name: "success text", args: []string{"TOEFL Speaking"}, response: `{"value":"bag-1"}`, calls: 1},
		{name: "discovery", json: true},
		{name: "missing name", token: common.TokenMissingRequiredField},
		{name: "blank name", args: []string{" \t "}, token: common.TokenMissingRequiredField},
		{name: "too many names", args: []string{"one", "two"}, token: common.TokenInvalidArgument},
		{name: "invalid output field", args: []string{"TOEFL Speaking"}, json: true, fields: []string{"missing"}, token: common.TokenInvalidArgument},
		{name: "server rejection", args: []string{"TOEFL Speaking"}, response: `{"errorMessage":"Bag rejected"}`, token: common.TokenConvexAPIError, calls: 1},
		{name: "malformed response", args: []string{"TOEFL Speaking"}, response: `{"value":{}}`, token: common.TokenConvexAPIError, calls: 1},
		{name: "empty ID", args: []string{"TOEFL Speaking"}, response: `{"value":""}`, token: common.TokenConvexAPIError, calls: 1},
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
				if r.URL.Path != "/api/mutation" || req.Path != "learning:createBag" || req.Args["name"] != "TOEFL Speaking" {
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
			output := captureStdout(t, func() { err = runCardsCommand(newBagsCreateCmd(), tc.args) })
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
				if output != "Created bag bag-1: TOEFL Speaking\n" {
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

func TestBagsCreateAuthError(t *testing.T) {
	jsonFlag = common.JSONFlag{}
	t.Cleanup(func() { bagsAuthenticatedClientFunc = authenticatedClient })
	want := common.NewAuthTokenError(common.TokenNotLoggedIn, "login required", nil)
	bagsAuthenticatedClientFunc = func(context.Context) (*convex.Client, *convex.User, error) { return nil, nil, want }
	if err := runCardsCommand(newBagsCreateCmd(), []string{"test"}); err != want {
		t.Fatalf("error=%v, want %v", err, want)
	}
}
