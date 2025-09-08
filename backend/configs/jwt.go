package configs

import (
	"os"
	"time"
)

var jwtSecret = []byte(getEnv("JWT_SECRET", "dev-secret-change-me"))

func getEnv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func JWTSecret() []byte { return jwtSecret }

func AccessTokenTTL() time.Duration { return 2 * time.Hour }
