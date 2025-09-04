package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

func GetOperations(c *gin.Context) {
	var ops []entity.Operation
	if err := configs.DB().
		Preload("Parcel").
		Preload("Member").
		Preload("Operator").
		Find(&ops).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch operations"})
		return
	}
	c.JSON(http.StatusOK, ops)
}
