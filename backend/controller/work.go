package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

// GetWorks - ดึงข้อมูลงานทั้งหมด
func GetWorks(c *gin.Context) {
	var works []entity.Work
	if err := configs.DB().Find(&works).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch works"})
		return
	}
	c.JSON(http.StatusOK, works)
}