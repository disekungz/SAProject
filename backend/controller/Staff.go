package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

/* =========================
 * DTO
 * =======================*/
// ตรงกับ frontend
type StaffInput struct {
	StaffID   *uint  `json:"StaffID"` // optional: ใช้ตอน create ถ้ามี
	Email     string `json:"Email"`
	FirstName string `json:"FirstName" binding:"required"`
	LastName  string `json:"LastName" binding:"required"`
	Birthday  string `json:"Birthday" binding:"required"` // ISO8601 หรือ YYYY-MM-DD
	Status    string `json:"Status" binding:"required"`   // "ทำงานอยู่"/"ไม่ได้ทำงาน"
	Address   string `json:"Address"`
	Gender_ID *uint  `json:"Gender_ID" binding:"required"`
}

/* =========================
 * Helpers
 * =======================*/
func parseBirthdayFlexible(s string) (time.Time, error) {
	// ลอง RFC3339 ก่อน เช่น "2006-01-02T15:04:05Z07:00"
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	// รองรับ "YYYY-MM-DD"
	return time.Parse("2006-01-02", s)
}

/* =========================
 * Handlers
 * =======================*/

// GET /api/staffs
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

// GET /api/staffs/:id
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

// POST /api/staffs
func CreateStaff(c *gin.Context) {
	var input StaffInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	birthday, err := parseBirthdayFlexible(input.Birthday)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Birthday format, use ISO 8601 (RFC3339) or YYYY-MM-DD"})
		return
	}

	// ✅ ถ้ามี StaffID ที่ส่งมาจาก frontend ให้ตรวจว่าเป็นเลข 3 หลัก และไม่ซ้ำ
	if input.StaffID != nil {
		if *input.StaffID < 100 || *input.StaffID > 999 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "StaffID ต้องเป็นเลข 3 หลักระหว่าง 100-999"})
			return
		}
		var cnt int64
		if err := configs.DB().Model(&entity.Staff{}).
			Where("staff_id = ?", *input.StaffID).Count(&cnt).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check StaffID"})
			return
		}
		if cnt > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "รหัสเจ้าหน้าที่ซ้ำ กรุณาลองใหม่"})
			return
		}
	}

	staff := entity.Staff{
		Email:     input.Email,
		FirstName: input.FirstName,
		LastName:  input.LastName,
		Birthday:  birthday,
		Status:    input.Status,
		Address:   input.Address,
		Gender_ID: input.Gender_ID,
	}
	// ใช้รหัส 3 หลักที่ส่งมา (ถ้ามี)
	if input.StaffID != nil {
		staff.StaffID = *input.StaffID
	}

	if err := configs.DB().Create(&staff).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	configs.DB().Preload("Gender").First(&staff, staff.StaffID)
	c.JSON(http.StatusCreated, staff)
}

// PUT /api/staffs/:id
func UpdateStaff(c *gin.Context) {
	id := c.Param("id")

	var current entity.Staff
	if err := configs.DB().First(&current, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Staff not found"})
		return
	}

	var input StaffInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	birthday, err := parseBirthdayFlexible(input.Birthday)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Birthday format, use ISO 8601 (RFC3339) or YYYY-MM-DD"})
		return
	}

	update := map[string]interface{}{
		"Email":     input.Email,
		"FirstName": input.FirstName,
		"LastName":  input.LastName,
		"Birthday":  birthday,
		"Status":    input.Status,
		"Address":   input.Address,
		"Gender_ID": input.Gender_ID,
		// ไม่แตะ Username/Password/AdminID
	}

	if err := configs.DB().Model(&current).Updates(update).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update staff"})
		return
	}

	configs.DB().Preload("Gender").First(&current, id)
	c.JSON(http.StatusOK, current)
}

// DELETE /api/staffs/:id
func DeleteStaff(c *gin.Context) {
	id := c.Param("id")

	// กันลบถ้ามีการอ้างอิง
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
