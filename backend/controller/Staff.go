package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

// StaffInput - Struct สำหรับรับข้อมูล JSON จาก Frontend (ตัด Username/Password/AdminID ออกแล้ว)
type StaffInput struct {
	StaffID   uint   `json:"StaffID"`
	Email     string `json:"Email"`
	FirstName string `json:"FirstName" binding:"required"`
	LastName  string `json:"LastName" binding:"required"`
	Birthday  string `json:"Birthday" binding:"required"` // รับเป็น string เพื่อแปลง
	Status    string `json:"Status" binding:"required"`
	Address   string `json:"Address"`
	Gender_ID *uint  `json:"Gender_ID" binding:"required"`
}

// --- Staff Handlers ---

// GetStaffs - ดึงข้อมูลเจ้าหน้าที่ทั้งหมด (Preload เฉพาะที่จำเป็น)
func GetStaffs(c *gin.Context) {
	var staffs []entity.Staff
	if err := configs.DB().
		Preload("Gender").
		Find(&staffs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch staffs"})
		return
	}
	c.JSON(http.StatusOK, staffs)
}

// GetStaffByID - ดึงข้อมูลเจ้าหน้าที่คนเดียวตาม ID (เอา Rank ออก)
func GetStaffByID(c *gin.Context) {
	id := c.Param("id")
	var staff entity.Staff
	if err := configs.DB().
		Preload("Gender").
		First(&staff, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Staff not found"})
		return
	}
	c.JSON(http.StatusOK, staff)
}

// CreateStaff - สร้างเจ้าหน้าที่ใหม่ (ไม่รับ username/password/admin อีกต่อไป)
func CreateStaff(c *gin.Context) {
	var input StaffInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	// แปลงวันเกิดจาก ISO 8601 string -> time.Time
	birthday, err := time.Parse(time.RFC3339, input.Birthday)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Birthday format, use ISO 8601 (RFC3339)"})
		return
	}

	// map เฉพาะฟิลด์ที่ใช้จริงไปยัง entity.Staff
	staff := entity.Staff{
		Email:     input.Email,
		FirstName: input.FirstName,
		LastName:  input.LastName,
		Birthday:  birthday,
		Status:    input.Status,
		Address:   input.Address,
		Gender_ID: input.Gender_ID,
	}

	if err := configs.DB().Create(&staff).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, staff)
}

// UpdateStaff - อัปเดตข้อมูลเจ้าหน้าที่ (เอา Rank ออก)
func UpdateStaff(c *gin.Context) {
	id := c.Param("id")
	var staff entity.Staff
	if err := configs.DB().First(&staff, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Staff not found"})
		return
	}

	var input StaffInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	birthday, err := time.Parse(time.RFC3339, input.Birthday)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Birthday format, use ISO 8601 (RFC3339)"})
		return
	}

	updateData := entity.Staff{
		Email:     input.Email,
		FirstName: input.FirstName,
		LastName:  input.LastName,
		Birthday:  birthday,
		Status:    input.Status,
		Address:   input.Address,
		Gender_ID: input.Gender_ID,
	}

	if err := configs.DB().Model(&staff).Updates(updateData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update staff"})
		return
	}

	configs.DB().
		Preload("Gender").
		First(&staff, id)

	c.JSON(http.StatusOK, staff)
}

// DeleteStaff - ลบข้อมูลเจ้าหน้าที่
func DeleteStaff(c *gin.Context) {
	id := c.Param("id")

	// ตรวจความสัมพันธ์อื่น ๆ ตามเดิม
	var count int64
	configs.DB().Model(&entity.Requesting{}).Where("staff_id = ?", id).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่สามารถลบเจ้าหน้าที่ได้ เนื่องจากมีคำขอเบิกที่อ้างอิงถึงเจ้าหน้าที่คนนี้"})
		return
	}

	if err := configs.DB().Delete(&entity.Staff{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete staff"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Staff deleted successfully"})
}
