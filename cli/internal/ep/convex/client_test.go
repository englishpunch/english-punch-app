package convex

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClient_Query(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/query" {
			t.Errorf("path = %s, want /api/query", r.URL.Path)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Content-Type = %s", r.Header.Get("Content-Type"))
		}

		var req request
		json.NewDecoder(r.Body).Decode(&req)
		if req.Path != "test:func" {
			t.Errorf("path = %s, want test:func", req.Path)
		}

		json.NewEncoder(w).Encode(response{Value: json.RawMessage(`{"result":"ok"}`)})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	raw, err := client.Query(context.Background(), "test:func", map[string]any{"key": "val"})
	if err != nil {
		t.Fatalf("Query error: %v", err)
	}

	var result map[string]string
	json.Unmarshal(raw, &result)
	if result["result"] != "ok" {
		t.Errorf("result = %v, want ok", result)
	}
}

func TestClient_Action(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/action" {
			t.Errorf("path = %s, want /api/action", r.URL.Path)
		}
		json.NewEncoder(w).Encode(response{Value: json.RawMessage(`"done"`)})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	raw, err := client.Action(context.Background(), "test:action", nil)
	if err != nil {
		t.Fatalf("Action error: %v", err)
	}
	if string(raw) != `"done"` {
		t.Errorf("result = %s, want \"done\"", string(raw))
	}
}

func TestClient_Mutation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/mutation" {
			t.Errorf("path = %s, want /api/mutation", r.URL.Path)
		}
		json.NewEncoder(w).Encode(response{Value: json.RawMessage(`null`)})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	_, err := client.Mutation(context.Background(), "test:mut", nil)
	if err != nil {
		t.Fatalf("Mutation error: %v", err)
	}
}

func TestClient_AuthHeader(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth != "Bearer test-jwt" {
			t.Errorf("Authorization = %q, want 'Bearer test-jwt'", auth)
		}
		json.NewEncoder(w).Encode(response{Value: json.RawMessage(`null`)})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	client.Token = "test-jwt"
	_, err := client.Query(context.Background(), "test:func", nil)
	if err != nil {
		t.Fatalf("error: %v", err)
	}
}

func TestClient_SignIn(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req request
		json.NewDecoder(r.Body).Decode(&req)
		if req.Path != "auth:signIn" {
			t.Errorf("path = %s, want auth:signIn", req.Path)
		}
		json.NewEncoder(w).Encode(response{
			Value: json.RawMessage(`{"tokens":{"token":"jwt-abc123"}}`),
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	err := client.SignIn(context.Background(), "test@example.com", "pass")
	if err != nil {
		t.Fatalf("SignIn error: %v", err)
	}
	if client.Token != "jwt-abc123" {
		t.Errorf("Token = %q, want jwt-abc123", client.Token)
	}
}

func TestClient_SignIn_NoToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(response{
			Value: json.RawMessage(`{"tokens":{"token":""}}`),
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	err := client.SignIn(context.Background(), "test@example.com", "bad")
	if err == nil {
		t.Fatal("expected error for empty token")
	}
}

func TestClient_ConvexError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(response{ErrorMessage: "function not found"})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	_, err := client.Query(context.Background(), "bad:func", nil)
	if err == nil {
		t.Fatal("expected error for Convex error response")
	}
}

func TestClient_HTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal error"))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	_, err := client.Query(context.Background(), "test:func", nil)
	if err == nil {
		t.Fatal("expected error for HTTP 500")
	}
}

func TestClient_GetCurrentUser(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(response{
			Value: json.RawMessage(`{"_id":"users:abc","email":"test@example.com","name":"Test"}`),
		})
	}))
	defer server.Close()

	client := NewClient(server.URL)
	client.Token = "jwt"
	user, err := client.GetCurrentUser(context.Background())
	if err != nil {
		t.Fatalf("GetCurrentUser error: %v", err)
	}
	if user.Email != "test@example.com" {
		t.Errorf("Email = %q, want test@example.com", user.Email)
	}
	if user.ID != "users:abc" {
		t.Errorf("ID = %q, want users:abc", user.ID)
	}
}
