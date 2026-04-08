package config

import (
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
	ConvexURL string `mapstructure:"convex_url"`
}

// Load reads configuration from file, environment, and defaults.
// configDir overrides the default config directory if non-empty.
func Load(configDir string) (*Config, error) {
	v := viper.New()

	v.SetDefault("convex_url", defaultConvexURL)

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

// DefaultConfigDir returns ~/.config/english-punch.
func DefaultConfigDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", appDirName)
}
