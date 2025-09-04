package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

// GET /api/doctors
func GetDoctors(c *gin.Context) {
	var doctors []entity.Doctor
	if err := configs.DB().Find(&doctors).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch doctors"})
		return
	}
	c.JSON(http.StatusOK, doctors)
}
