package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

type StatusInput struct {
	Status string `json:"Status" binding:"required"`
}

// GetStatuses - ดึงสถานะทั้งหมด
func GetStatuses(c *gin.Context) {
	var statuses []entity.Status
	if err := configs.DB().Order("status_id asc").Find(&statuses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch statuses"})
		return
	}
	c.JSON(http.StatusOK, statuses)
}

// CreateStatus - สร้างสถานะใหม่ (อาจไม่จำเป็นต้องมีใน Production)
func CreateStatus(c *gin.Context) {
	var input StatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	status := entity.Status{
		Status: input.Status,
	}

	if err := configs.DB().Create(&status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create status: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, status)
}

// UpdateStatus - อัปเดตสถานะ (อาจไม่จำเป็นต้องมีใน Production)
func UpdateStatus(c *gin.Context) {
	id := c.Param("id")
	var status entity.Status
	if err := configs.DB().First(&status, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Status not found"})
		return
	}

	var input StatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	if err := configs.DB().Model(&status).Update("status", input.Status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

// DeleteStatus - ลบสถานะ (อาจไม่จำเป็นต้องมีใน Production)
func DeleteStatus(c *gin.Context) {
	id := c.Param("id")

	var count int64
	configs.DB().Model(&entity.Requesting{}).Where("status_id = ?", id).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่สามารถลบสถานะได้ เนื่องจากมีคำขอเบิกที่ใช้สถานะนี้อยู่"})
		return
	}

	if err := configs.DB().Delete(&entity.Status{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status deleted successfully"})
}