package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoad_Defaults(t *testing.T) {
	// Use a temp dir with no config file — should return defaults
	dir := t.TempDir()
	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load error: %v", err)
	}
	if cfg.ConvexURL != "https://strong-otter-914.convex.cloud" {
		t.Errorf("ConvexURL = %q, want default", cfg.ConvexURL)
	}
}

func TestLoad_ConfigFile(t *testing.T) {
	dir := t.TempDir()
	content := []byte("convex_url: https://custom.convex.cloud\n")
	if err := os.WriteFile(filepath.Join(dir, "config.yaml"), content, 0644); err != nil {
		t.Fatal(err)
	}

	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load error: %v", err)
	}
	if cfg.ConvexURL != "https://custom.convex.cloud" {
		t.Errorf("ConvexURL = %q, want custom URL", cfg.ConvexURL)
	}
}

func TestLoad_EnvOverride(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("EP_CONVEX_URL", "https://env.convex.cloud")

	cfg, err := Load(dir)
	if err != nil {
		t.Fatalf("Load error: %v", err)
	}
	if cfg.ConvexURL != "https://env.convex.cloud" {
		t.Errorf("ConvexURL = %q, want env override", cfg.ConvexURL)
	}
}

func TestDefaultConfigDir(t *testing.T) {
	dir := DefaultConfigDir()
	home, _ := os.UserHomeDir()
	want := filepath.Join(home, ".config", "english-punch")
	if dir != want {
		t.Errorf("DefaultConfigDir = %q, want %q", dir, want)
	}
}
