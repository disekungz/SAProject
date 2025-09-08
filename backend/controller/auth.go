package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type registerInput struct {
	Username  string `json:"username"  binding:"required"`
	Password  string `json:"password"  binding:"required,min=6"`
	Email     string `json:"email"     binding:"required"`
	RankID    *int   `json:"rankId"` // ✅ ทำให้เป็น optional
	FirstName string `json:"firstName" binding:"required"`
	LastName  string `json:"lastName"  binding:"required"`
	Birthday  string `json:"birthday"  binding:"required"` // RFC3339 หรือ YYYY-MM-DD
}

type loginInput struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func parseBirthday(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t, nil
	}
	return time.Time{}, fmt.Errorf("invalid birthday format (use RFC3339 or YYYY-MM-DD)")
}

func Register(c *gin.Context) {
	var in registerInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload: " + err.Error()})
		return
	}

	db := configs.DB()

	// normalize
	in.Username = strings.TrimSpace(in.Username)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.FirstName = strings.TrimSpace(in.FirstName)
	in.LastName = strings.TrimSpace(in.LastName)

	// unique checks
	var cnt int64
	db.Model(&entity.Member{}).Where("username = ?", in.Username).Count(&cnt)
	if cnt > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
		return
	}
	cnt = 0
	db.Model(&entity.Member{}).Where("email = ?", in.Email).Count(&cnt)
	if cnt > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
		return
	}

	// ✅ เลือก Rank เริ่มต้นเป็น "ญาติ" ถ้าไม่ส่ง rankId มา หรือส่ง 0
	var rankID int
	if in.RankID == nil || *in.RankID == 0 {
		var def entity.Rank
		// หาตามชื่อก่อน (กันกรณี id เปลี่ยน)
		if err := db.Where("rank_name = ?", "ญาติ").First(&def).Error; err != nil {
			// เผื่อ seed เป็นเลข 3 ตามที่ตั้งไว้
			if err2 := db.Where("rank_id = ?", 3).First(&def).Error; err2 != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "default rank 'ญาติ' not found; please seed ranks"})
				return
			}
		}
		rankID = def.RankID
	} else {
		rankID = *in.RankID
		// ตรวจสอบว่ามี rank นี้จริง
		var r entity.Rank
		if err := db.Where("rank_id = ?", rankID).First(&r).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("rankId %d not found", rankID)})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify rank: " + err.Error()})
			return
		}
	}

	// birthday
	bday, err := parseBirthday(in.Birthday)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot hash password: " + err.Error()})
		return
	}

	m := entity.Member{
		Username:  in.Username,
		Password:  string(hash),
		Email:     in.Email,
		RankID:    rankID, // ✅ ใช้ค่า default/หรือค่าที่ส่งมา
		FirstName: in.FirstName,
		LastName:  in.LastName,
		Birthday:  bday,
	}

	if err := db.Create(&m).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot create member: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"MID":       m.MID,
		"username":  m.Username,
		"firstName": m.FirstName,
		"lastName":  m.LastName,
		"rankId":    m.RankID,
	})
}

func Login(c *gin.Context) {
	var in loginInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	db := configs.DB()

	var m entity.Member
	if err := db.Where("username = ?", in.Username).First(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error: " + err.Error()})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(m.Password), []byte(in.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
		return
	}

	claims := jwt.MapClaims{
		"mid":      m.MID,
		"username": m.Username,
		"exp":      time.Now().Add(configs.AccessTokenTTL()).Unix(),
		"iat":      time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(configs.JWTSecret())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot sign token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": signed,
		"user": gin.H{
			"MID":       m.MID,
			"username":  m.Username,
			"firstName": m.FirstName,
			"lastName":  m.LastName,
			"rankId":    m.RankID,
		},
	})
}

func Me(c *gin.Context) {
	mid, ok := c.Get("mid")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	var m entity.Member
	if err := configs.DB().First(&m, mid).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"MID":       m.MID,
		"username":  m.Username,
		"firstName": m.FirstName,
		"lastName":  m.LastName,
		"rankId":    m.RankID,
	})
}
