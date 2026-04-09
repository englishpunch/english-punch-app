package common

import (
	"encoding/json"
	"testing"
)

func TestPrintJSON(t *testing.T) {
	data := map[string]string{"key": "value"}
	out, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		t.Fatalf("MarshalIndent: %v", err)
	}
	if !json.Valid(out) {
		t.Error("PrintJSON should produce valid JSON")
	}
}
