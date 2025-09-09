package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

// StaffInput - รับจาก Frontend (ตัด Username/Password/AdminID ออก)
type StaffInput struct {
	StaffID   uint   `json:"StaffID"`
	Email     string `json:"Email"`
	FirstName string `json:"FirstName" binding:"required"`
	LastName  string `json:"LastName" binding:"required"`
	Birthday  string `json:"Birthday" binding:"required"` // รับเป็น string เพื่อแปลงเป็น time.Time
	Status    string `json:"Status" binding:"required"`
	Address   string `json:"Address"`
	Gender_ID *uint  `json:"Gender_ID" binding:"required"`
}

// --- Staff Handlers ---

// GetStaffs - ดึงข้อมูลเจ้าหน้าที่ทั้งหมด
func GetStaffs(c *gin.Context) {
	var staffs []entity.Staff
	if err := configs.DB().Find(&staffs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch staffs"})
		return
	}
	c.JSON(http.StatusOK, staffs)
}

// GetStaffByID - ดึงข้อมูลเจ้าหน้าที่คนเดียวตาม ID (ตัด Admin ออก)
func GetStaffByID(c *gin.Context) {
	id := c.Param("id")
	var staff entity.Staff
	if err := configs.DB().
		Preload("Gender").
		Preload("Rank").
		First(&staff, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Staff not found"})
		return
	}
	c.JSON(http.StatusOK, staff)
}

// parseBirthday - helper รองรับ RFC3339 เป็นหลัก
func parseBirthdayStaff(s string) (time.Time, error) {
	// ลอง RFC3339 ก่อน เช่น "2006-01-02T15:04:05Z07:00"
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	// เผื่อกรณีส่งมาเป็น "YYYY-MM-DD"
	return time.Parse("2006-01-02", s)
}

// CreateStaff - สร้างเจ้าหน้าที่ใหม่ (ไม่รับ Username/Password/AdminID)
func CreateStaff(c *gin.Context) {
	var input StaffInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	birthday, err := parseBirthdayStaff(input.Birthday)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Birthday format, use ISO 8601 (RFC3339) or YYYY-MM-DD"})
		return
	}

	staff := entity.Staff{
		Email:     input.Email,
		FirstName: input.FirstName,
		LastName:  input.LastName,
		Birthday:  birthday,
		Status:    input.Status,
		Address:   input.Address,
		Gender_ID: input.Gender_ID,
		// ไม่ตั้งค่า Username / Password / AdminID
	}

	if err := configs.DB().Create(&staff).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, staff)
}

// UpdateStaff - อัปเดตข้อมูลเจ้าหน้าที่ (ไม่ยุ่งกับ Username/Password/AdminID)
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

	birthday, err := parseBirthday(input.Birthday)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Birthday format, use ISO 8601 (RFC3339) or YYYY-MM-DD"})
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
		// ไม่อัปเดต Username / Password / AdminID
	}

	if err := configs.DB().Model(&staff).Updates(updateData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update staff"})
		return
	}

	configs.DB().Preload("Gender").Preload("Rank").First(&staff, id)
	c.JSON(http.StatusOK, staff)
}

// DeleteStaff - ลบข้อมูลเจ้าหน้าที่
func DeleteStaff(c *gin.Context) {
	id := c.Param("id")

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
