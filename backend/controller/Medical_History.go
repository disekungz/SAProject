package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

// --- Medical History Handlers ---

// GET /api/medical_histories
func GetMedicalHistories(c *gin.Context) {
	var medicalHistories []entity.Medical_History
	// Preload ดึง Relation มาพร้อมกัน
	if err := configs.DB().
		Preload("Prisoner").
		Preload("Doctor").
		Preload("Staff").
		Find(&medicalHistories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medical histories"})
		return
	}
	c.JSON(http.StatusOK, medicalHistories)
}

// POST /api/medical_histories
func CreateMedicalHistory(c *gin.Context) {
	var medicalHistory entity.Medical_History
	if err := c.ShouldBindJSON(&medicalHistory); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := configs.DB().Create(&medicalHistory).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create medical history"})
		return
	}
	c.JSON(http.StatusCreated, medicalHistory)
}

// PUT /api/medical_histories/:id
func UpdateMedicalHistory(c *gin.Context) {
	id := c.Param("id")
	var medicalHistory entity.Medical_History

	// ค้นหา record ที่มีอยู่
	if err := configs.DB().First(&medicalHistory, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medical history not found"})
		return
	}

	// Bind JSON ที่ส่งมาเข้ากับ struct
	if err := c.ShouldBindJSON(&medicalHistory); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// บันทึกข้อมูลที่อัปเดต
	if err := configs.DB().Save(&medicalHistory).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update medical history"})
		return
	}

	c.JSON(http.StatusOK, medicalHistory)
}

// DELETE /api/medical_histories/:id
func DeleteMedicalHistory(c *gin.Context) {
	id := c.Param("id")
	if err := configs.DB().Delete(&entity.Medical_History{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete medical history"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Medical history deleted successfully"})
}
