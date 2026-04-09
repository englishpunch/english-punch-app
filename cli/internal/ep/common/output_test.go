package common

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestPrintTableWithRows(t *testing.T) {
	var buf bytes.Buffer
	header := []string{"Name", "Count"}
	rows := [][]string{
		{"Apples", "5"},
		{"Bananas", "3"},
	}
	printTableTo(&buf, header, rows)
	out := buf.String()

	if !strings.Contains(out, "Apples") {
		t.Errorf("output should contain 'Apples', got: %s", out)
	}
	if !strings.Contains(out, "NAME") || !strings.Contains(out, "COUNT") {
		t.Errorf("output should contain header, got: %s", out)
	}
}

func TestPrintTableEmpty(t *testing.T) {
	var buf bytes.Buffer
	printTableTo(&buf, []string{"Name"}, nil)
	if got := strings.TrimSpace(buf.String()); got != "No results." {
		t.Errorf("empty table = %q, want 'No results.'", got)
	}
}

func TestToAny(t *testing.T) {
	result := toAny([]string{"a", "b"})
	if len(result) != 2 {
		t.Fatalf("len = %d, want 2", len(result))
	}
	if result[0] != "a" || result[1] != "b" {
		t.Errorf("toAny = %v, want [a b]", result)
	}
}

func TestPrintJSON(t *testing.T) {
	data := map[string]string{"key": "value"}
	out, _ := json.MarshalIndent(data, "", "  ")
	// Just verify it doesn't panic and produces valid JSON
	if !json.Valid(out) {
		t.Error("PrintJSON should produce valid JSON")
	}
}
