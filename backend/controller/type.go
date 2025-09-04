package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

func GetTypes(c *gin.Context) {
	var types []entity.Type
	if err := configs.DB().Find(&types).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch types"})
		return
	}
	c.JSON(http.StatusOK, types)
}
