package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

const (
	defaultConvexURL = "https://strong-otter-914.convex.cloud"
	configFileName   = "config"
	configFileType   = "yaml"
	appDirName       = "english-punch"
)

// Config holds the application configuration.
type Config struct {
	ConvexURL    string `mapstructure:"convex_url"`
	DefaultBagID string `mapstructure:"default_bag_id"`
}

// Load reads configuration from file, environment, and defaults.
// configDir overrides the default config directory if non-empty.
func Load(configDir string) (*Config, error) {
	v := viper.New()

	v.SetDefault("convex_url", defaultConvexURL)
	v.SetDefault("default_bag_id", "")

	v.SetEnvPrefix("EP")
	v.AutomaticEnv()

	dir := configDir
	if dir == "" {
		dir = DefaultConfigDir()
	}
	v.SetConfigName(configFileName)
	v.SetConfigType(configFileType)
	v.AddConfigPath(dir)

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			if !os.IsNotExist(err) {
				return nil, err
			}
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// Save writes the given config to configDir/config.yaml. Creates the
// directory if it does not exist. Existing unknown keys in the file are
// not preserved — only fields known to Config are written.
func Save(configDir string, cfg *Config) error {
	dir := configDir
	if dir == "" {
		dir = DefaultConfigDir()
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}

	v := viper.New()
	v.Set("convex_url", cfg.ConvexURL)
	v.Set("default_bag_id", cfg.DefaultBagID)

	configFile := filepath.Join(dir, configFileName+"."+configFileType)
	if err := v.WriteConfigAs(configFile); err != nil {
		return fmt.Errorf("write config file: %w", err)
	}
	return nil
}

// DefaultConfigDir returns ~/.config/english-punch.
func DefaultConfigDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", appDirName)
}
