package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

// --- Gender Handlers ---
func GetGenders(c *gin.Context) {
	var genders []entity.Gender
	if err := configs.DB().Find(&genders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch genders"})
		return
	}
	c.JSON(http.StatusOK, genders)
}
