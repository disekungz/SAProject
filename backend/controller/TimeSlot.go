package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

// GET /api/timeslots
func GetTimeSlots(c *gin.Context) {
	var timeslots []entity.TimeSlot
	if err := configs.DB().Find(&timeslots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch timeslots"})
		return
	}
	c.JSON(http.StatusOK, timeslots)
}
