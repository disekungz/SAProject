package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/entity"
	"github.com/sa-project/configs"
)

// GetRanks - ดึงข้อมูลตำแหน่งทั้งหมด
func GetRanks(c *gin.Context) {
	var ranks []entity.Rank
	if err := configs.DB().Find(&ranks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ranks"})
		return
	}
	c.JSON(http.StatusOK, ranks)
}
