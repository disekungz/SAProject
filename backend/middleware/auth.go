package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/sa-project/configs"
)

func AuthOptional() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := strings.TrimSpace(c.GetHeader("Authorization"))
		if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
			tokenStr := strings.TrimSpace(auth[7:]) // ตัด "Bearer "
			claims := jwt.MapClaims{}
			tkn, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
				return configs.JWTSecret(), nil
			})
			if err == nil && tkn.Valid {
				// mid ใน JWT ปกติเป็น number(float64) -> แปลงเป็น int
				if v, ok := claims["mid"]; ok {
					switch x := v.(type) {
					case float64:
						c.Set("mid", int(x))      // ✅ คีย์ที่ controller ใช้
						c.Set("memberID", int(x)) // (เผื่อโค้ดเก่า)
					case int:
						c.Set("mid", x)
						c.Set("memberID", x)
					}
				}
				if v, ok := claims["rankId"].(float64); ok {
					c.Set("rankId", int(v))
				}
				if v, ok := claims["citizenId"].(string); ok {
					c.Set("citizenId", v)
				}
			}
		}
		c.Next()
	}
}

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// ยอมรับทั้ง "mid" และ "memberID" เพื่อความเข้ากันได้
		if _, ok := c.Get("mid"); !ok {
			if _, ok2 := c.Get("memberID"); !ok2 {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
				return
			}
		}
		c.Next()
	}
}
