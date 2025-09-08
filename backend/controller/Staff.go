package controller

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// StaffInput - Struct สำหรับรับข้อมูล JSON จาก Frontend
type StaffInput struct {
	StaffID   uint   `json:"StaffID"`
	Email     string `json:"Email"`
	Username  string `json:"Username"`
	Password  string `json:"Password"`
	FirstName string `json:"FirstName" binding:"required"`
	LastName  string `json:"LastName" binding:"required"`
	Birthday  string `json:"Birthday" binding:"required"` // ISO 8601
	Status    string `json:"Status" binding:"required"`
	Address   string `json:"Address"`
	AdminID   *uint  `json:"AdminID"`
	Gender_ID *uint  `json:"Gender_ID" binding:"required"`
	RankID    *uint  `json:"RankID"`
}

// GetStaffs - ดึงข้อมูลเจ้าหน้าที่ทั้งหมด
func GetStaffs(c *gin.Context) {
	var staffs []entity.Staff
	if err := configs.DB().Find(&staffs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch staffs"})
		return
	}
	c.JSON(http.StatusOK, staffs)
}

// GetStaffByID - ดึงข้อมูลเจ้าหน้าที่คนเดียวตาม ID (preload ความสัมพันธ์)
func GetStaffByID(c *gin.Context) {
	id := c.Param("id")
	var staff entity.Staff
	if err := configs.DB().
		Preload("Gender").
		Preload("Admin").
		Preload("Rank").
		First(&staff, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Staff not found"})
		return
	}
	c.JSON(http.StatusOK, staff)
}

// CreateStaff - สร้างเจ้าหน้าที่ใหม่
func CreateStaff(c *gin.Context) {
	var staff entity.Staff
	if err := c.ShouldBindJSON(&staff); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(staff.Password), 10)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Error while hashing password"})
		return
	}
	staff.Password = string(hashedPassword)

	if err := configs.DB().Create(&staff).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, staff)
}

// UpdateStaff - อัปเดตข้อมูลเจ้าหน้าที่
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

	// รองรับรูปแบบ ISO 8601 เช่น "2006-01-02T15:04:05Z07:00"
	birthday, err := time.Parse("2006-01-02T15:04:05Z07:00", input.Birthday)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Birthday format, use ISO 8601 format"})
		return
	}

	updateData := entity.Staff{
		Email:     input.Email,
		Username:  input.Username,
		Password:  input.Password,
		FirstName: input.FirstName,
		LastName:  input.LastName,
		Birthday:  birthday,
		Status:    input.Status,
		Address:   input.Address,
		Gender_ID: input.Gender_ID,
		RankID:    input.RankID,
	}

	if err := configs.DB().Model(&staff).Updates(updateData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update staff"})
		return
	}

	configs.DB().Preload("Gender").Preload("Admin").Preload("Rank").First(&staff, id)
	c.JSON(http.StatusOK, staff)
}

// DeleteStaff - ลบเจ้าหน้าที่
// ถ้ายังมีการอ้างอิงในตาราง requestings:
//   - ถ้าไม่ส่ง ?force=1 จะคืน 400 พร้อม refCount
//   - ถ้าส่ง ?force=1 จะอัปเดต requestings.staff_id = NULL แล้วค่อยลบ
func DeleteStaff(c *gin.Context) {
	// แปลง id เป็นตัวเลข
	sid64, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid staff id"})
		return
	}
	sid := uint(sid64)

	db := configs.DB()

	// มี staff จริงไหม
	var exists int64
	if err := db.Model(&entity.Staff{}).Where("staff_id = ?", sid).Count(&exists).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check staff"})
		return
	}
	if exists == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Staff not found"})
		return
	}

	// นับ dependency ใน requestings
	var dep int64
	if err := db.Model(&entity.Requesting{}).Where("staff_id = ?", sid).Count(&dep).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check dependencies"})
		return
	}

	force := c.Query("force") == "1" || strings.ToLower(c.Query("force")) == "true"
	if dep > 0 && !force {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":    "ไม่สามารถลบเจ้าหน้าที่ได้ เนื่องจากมีคำขอเบิกที่อ้างอิงถึงเจ้าหน้าที่คนนี้",
			"refCount": dep,
		})
		return
	}

	// ทำงานแบบ transaction
	if err := db.Transaction(func(tx *gorm.DB) error {
		if dep > 0 && force {
			// พยายามเคลียร์ FK ให้เป็น NULL ก่อน
			if err := tx.Model(&entity.Requesting{}).
				Where("staff_id = ?", sid).
				Update("staff_id", nil).Error; err != nil {
				return err
			}
		}
		// ลบ staff
		if err := tx.Delete(&entity.Staff{}, sid).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete staff: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Staff deleted successfully"})
}
