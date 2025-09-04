package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
	"golang.org/x/crypto/bcrypt"
)

// StaffInput - Struct สำหรับรับข้อมูล JSON จาก Frontend
// ช่วยในการจัดการ-แปลงข้อมูลก่อนบันทึกลง entity จริง
type StaffInput struct {
	StaffID   uint   `json:"StaffID"`
	Email     string `json:"Email"`
	Username  string `json:"Username"`
	Password  string `json:"Password"`
	FirstName string `json:"FirstName" binding:"required"`
	LastName  string `json:"LastName" binding:"required"`
	Birthday  string `json:"Birthday" binding:"required"` // รับเป็น string เพื่อแปลง
	Status    string `json:"Status" binding:"required"`
	Address   string `json:"Address"`
	AdminID   *uint  `json:"AdminID"`
	Gender_ID *uint  `json:"Gender_ID" binding:"required"`
	RankID    *uint  `json:"RankID"`
}

// --- Staff Handlers ---

// GetStaffs - ดึงข้อมูลเจ้าหน้าที่ทั้งหมดพร้อมข้อมูลที่เกี่ยวข้อง (Preload)
func GetStaffs(c *gin.Context) {
    var staffs []entity.Staff
    if err := configs.DB().Find(&staffs).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch staffs"})
        return
    }
    c.JSON(http.StatusOK, staffs)
}

// GetStaffByID - ดึงข้อมูลเจ้าหน้าที่คนเดียวตาม ID พร้อมข้อมูลที่เกี่ยวข้อง (Preload)
func GetStaffByID(c *gin.Context) {
	id := c.Param("id")
	var staff entity.Staff
	if err := configs.DB().Preload("Gender").Preload("Admin").Preload("Rank").First(&staff, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Staff not found"})
		return
	}
	c.JSON(http.StatusOK, staff)
}

// CreateStaff - สร้างเจ้าหน้าที่ใหม่
func CreateStaff(c *gin.Context) {
	var staff entity.Staff

	// --- นี่คือส่วนที่สำคัญที่สุด ---
	// Bind JSON ที่ส่งมาเข้ากับ struct staff
	// ถ้ามี Error ให้ส่ง error นั้นกลับไปเลย
	if err := c.ShouldBindJSON(&staff); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// --- การจัดการรหัสผ่าน (สำคัญต่อความปลอดภัย) ---
	// เข้ารหัสผ่านที่ได้รับมาก่อนบันทึกลง DB
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(staff.Password), 10)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Error while hashing password"})
		return
	}
	staff.Password = string(hashedPassword)


	// สร้างข้อมูล Staff ในฐานข้อมูล
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

	birthday, err := time.Parse("2006-01-02T15:04:05Z07:00", input.Birthday)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Birthday format, use ISO 8601 format"})
		return
	}

	// สร้าง object ใหม่สำหรับอัปเดตข้อมูล
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

	// ดึงข้อมูลล่าสุดหลังอัปเดตเพื่อส่งกลับ
	configs.DB().Preload("Gender").Preload("Admin").Preload("Rank").First(&staff, id)
	c.JSON(http.StatusOK, staff)
}

// DeleteStaff - ลบข้อมูลเจ้าหน้าที่
func DeleteStaff(c *gin.Context) {
	id := c.Param("id")

	// เพิ่มการตรวจสอบ: ห้ามลบเจ้าหน้าที่ถ้ามีคำขอเบิกที่อ้างอิงถึงอยู่
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