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
		auth := c.GetHeader("Authorization")
		if strings.HasPrefix(auth, "Bearer ") {
			tokenStr := strings.TrimPrefix(auth, "Bearer ")
			claims := jwt.MapClaims{}
			tkn, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
				return configs.JWTSecret(), nil
			})
			if err == nil && tkn.Valid {
				// --- ส่วนที่แก้ไข ---
				// ดึงค่าต่างๆ จาก claims แล้ว Set เข้าไปใน Context
				if mid, ok := claims["mid"].(float64); ok {
					c.Set("memberID", uint(mid))
				}
				if rankId, ok := claims["rankId"].(float64); ok {
					c.Set("rankId", uint(rankId))
				}
				if citizenId, ok := claims["citizenId"].(string); ok {
					c.Set("citizenId", citizenId)
				}
				// --- สิ้นสุดส่วนที่แก้ไข ---
			}
		}
		c.Next()
	}
}

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// เปลี่ยน key ที่ตรวจสอบเป็น "memberID" ให้ตรงกับที่ Set ไว้
		if _, ok := c.Get("memberID"); !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Next()
	}
}
