package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
	"gorm.io/gorm"
)

type PrisonerInput struct {
	Inmate_ID   string  `json:"Inmate_ID"`
	Citizen_ID  string  `json:"Citizen_ID" binding:"required"`
	FirstName   string  `json:"FirstName"  binding:"required"`
	LastName    string  `json:"LastName"   binding:"required"`
	Case_ID     string  `json:"Case_ID"    binding:"required"`
	Room_ID     *uint   `json:"Room_ID"    binding:"required"`
	Work_ID     *uint   `json:"Work_ID"    binding:"required"`
	Gender_ID   *uint   `json:"Gender_ID"  binding:"required"`
	Birthday    string  `json:"Birthday"   binding:"required"` // YYYY-MM-DD
	EntryDate   string  `json:"EntryDate"  binding:"required"` // YYYY-MM-DD
	ReleaseDate *string `json:"ReleaseDate"`                   // YYYY-MM-DD or null
}

// -------- Helpers --------

// อัปเดตสถานะห้องจากจำนวนผู้ต้องขังที่ยังไม่ปล่อยตัว
func updateRoomStatus(tx *gorm.DB, roomID uint) error {
	var count int64
	if err := tx.Model(&entity.Prisoner{}).
		Where("room_id = ? AND release_date IS NULL", roomID).
		Count(&count).Error; err != nil {
		return fmt.Errorf("failed to count prisoners in room: %w", err)
	}

	newStatus := "ว่าง"
	if count >= 2 { // ปรับตาม business rule ของคุณ
		newStatus = "เต็ม"
	}

	if err := tx.Model(&entity.Room{}).
		Where("room_id = ?", roomID).
		Update("room_status", newStatus).Error; err != nil {
		return fmt.Errorf("failed to update room status: %w", err)
	}
	return nil
}

// ตรวจความสอดคล้องของเพศกับห้อง (ชายต้องขึ้นต้น M, หญิงต้องขึ้นต้น F)
func validateGenderAndRoom(genderID uint, roomID uint) error {
	db := configs.DB()

	var gender entity.Gender
	if err := db.First(&gender, genderID).Error; err != nil {
		return errors.New("ไม่พบข้อมูลเพศที่ระบุ")
	}

	var room entity.Room
	if err := db.First(&room, roomID).Error; err != nil {
		return errors.New("ไม่พบข้อมูลห้องที่ระบุ")
	}

	isMale := gender.Gender_ID == 1   // ชาย
	isFemale := gender.Gender_ID == 2 // หญิง

	roomIsForMale := strings.HasPrefix(room.Room_Name, "M")
	roomIsForFemale := strings.HasPrefix(room.Room_Name, "F")

	if isMale && !roomIsForMale {
		return errors.New("นักโทษชายสามารถเข้าได้เฉพาะห้องประเภท 'M' เท่านั้น")
	}
	if isFemale && !roomIsForFemale {
		return errors.New("นักโทษหญิงสามารถเข้าได้เฉพาะห้องประเภท 'F' เท่านั้น")
	}
	return nil
}

// -------- Handlers --------

// CreatePrisoner - เพิ่มนักโทษใหม่
func CreatePrisoner(c *gin.Context) {
	var input PrisonerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	// ตรวจความสอดคล้องเพศกับห้อง
	if input.Gender_ID != nil && input.Room_ID != nil {
		if err := validateGenderAndRoom(*input.Gender_ID, *input.Room_ID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	// เช็คห้องเต็มหรือยัง (เฉพาะผู้ต้องขังที่ยังไม่ถูกปล่อย)
	if input.Room_ID != nil {
		var count int64
		configs.DB().Model(&entity.Prisoner{}).
			Where("room_id = ? AND release_date IS NULL", *input.Room_ID).
			Count(&count)
		if count >= 2 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่สามารถเพิ่มนักโทษได้ เนื่องจากห้องขังเต็มแล้ว"})
			return
		}
	}

	layout := "2006-01-02"
	birthday, err := time.Parse(layout, input.Birthday)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Birthday format, use YYYY-MM-DD"})
		return
	}
	entryDate, err := time.Parse(layout, input.EntryDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid EntryDate format, use YYYY-MM-DD"})
		return
	}
	var releaseDate *time.Time
	if input.ReleaseDate != nil && *input.ReleaseDate != "" {
		parsedDate, err := time.Parse(layout, *input.ReleaseDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ReleaseDate format, use YYYY-MM-DD"})
			return
		}
		// ไม่อนุญาตวันที่ปล่อยก่อนวันรับเข้า
		if parsedDate.Before(entryDate) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ReleaseDate ต้องไม่น้อยกว่า EntryDate"})
			return
		}
		releaseDate = &parsedDate
	}

	prisoner := entity.Prisoner{
		Inmate_ID:   input.Inmate_ID,
		Citizen_ID:  input.Citizen_ID,
		FirstName:   input.FirstName,
		LastName:    input.LastName,
		Case_ID:     input.Case_ID,
		Room_ID:     input.Room_ID,
		Work_ID:     input.Work_ID,
		Gender_ID:   input.Gender_ID,
		Birthday:    birthday,
		EntryDate:   entryDate,
		ReleaseDate: releaseDate,
	}

	tx := configs.DB().Begin()
	if err := tx.Create(&prisoner).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create prisoner: " + err.Error()})
		return
	}

	// อัปเดตสถานะห้อง
	if prisoner.Room_ID != nil {
		if err := updateRoomStatus(tx, *prisoner.Room_ID); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// สร้างคะแนนเริ่มต้น (0) สำหรับผู้ต้องขังที่เพิ่งเพิ่ม
	if err := tx.Create(&entity.ScoreBehavior{
		Prisoner_ID: prisoner.Prisoner_ID,
		Score:       0,
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create initial score: " + err.Error()})
		return
	}

	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction commit failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Prisoner created successfully",
		"prisoner": prisoner,
	})
}

// UpdatePrisoner - อัพเดตข้อมูลด้วย Prisoner_ID (PK)
func UpdatePrisoner(c *gin.Context) {
	id := c.Param("id")

	var prisoner entity.Prisoner
	if err := configs.DB().First(&prisoner, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prisoner not found"})
		return
	}
	oldRoomID := prisoner.Room_ID

	var input PrisonerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	// ตรวจความสอดคล้องเพศกับห้อง
	if input.Gender_ID != nil && input.Room_ID != nil {
		if err := validateGenderAndRoom(*input.Gender_ID, *input.Room_ID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	// เช็คห้องใหม่เต็มหรือยัง (ถ้าย้ายห้อง)
	newRoomID := input.Room_ID
	if newRoomID != nil && (oldRoomID == nil || *oldRoomID != *newRoomID) {
		var count int64
		configs.DB().Model(&entity.Prisoner{}).
			Where("room_id = ? AND release_date IS NULL", *newRoomID).
			Count(&count)
		if count >= 2 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่สามารถย้ายนักโทษได้ เนื่องจากห้องขังปลายทางเต็มแล้ว"})
			return
		}
	}

	layout := "2006-01-02"
	birthday, err := time.Parse(layout, input.Birthday)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Birthday format, use YYYY-MM-DD"})
		return
	}
	entryDate, err := time.Parse(layout, input.EntryDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid EntryDate format, use YYYY-MM-DD"})
		return
	}
	var releaseDate *time.Time
	if input.ReleaseDate != nil && *input.ReleaseDate != "" {
		parsedDate, err := time.Parse(layout, *input.ReleaseDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ReleaseDate format, use YYYY-MM-DD"})
			return
		}
		if parsedDate.Before(entryDate) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ReleaseDate ต้องไม่น้อยกว่า EntryDate"})
			return
		}
		releaseDate = &parsedDate
	}

	updateData := entity.Prisoner{
		Citizen_ID:  input.Citizen_ID,
		FirstName:   input.FirstName,
		LastName:    input.LastName,
		Case_ID:     input.Case_ID,
		Room_ID:     input.Room_ID,
		Work_ID:     input.Work_ID,
		Gender_ID:   input.Gender_ID,
		Birthday:    birthday,
		EntryDate:   entryDate,
		ReleaseDate: releaseDate,
	}

	tx := configs.DB().Begin()
	if err := tx.Model(&prisoner).Updates(updateData).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update prisoner"})
		return
	}

	// อัปเดตสถานะห้องเก่า/ใหม่ ถ้ามีการย้าย
	if oldRoomID != nil && (newRoomID == nil || *oldRoomID != *newRoomID) {
		if err := updateRoomStatus(tx, *oldRoomID); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update old room status: " + err.Error()})
			return
		}
	}
	if newRoomID != nil {
		if err := updateRoomStatus(tx, *newRoomID); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update new room status: " + err.Error()})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	configs.DB().Preload("Gender").Preload("Room").Preload("Work").First(&prisoner, id)
	c.JSON(http.StatusOK, prisoner)
}

// DeletePrisoner - ลบข้อมูลด้วย Prisoner_ID (PK)
func DeletePrisoner(c *gin.Context) {
	id := c.Param("id")

	var prisoner entity.Prisoner
	if err := configs.DB().First(&prisoner, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prisoner not found"})
		return
	}
	roomIDToUpdate := prisoner.Room_ID

	tx := configs.DB().Begin()
	if err := tx.Delete(&entity.Prisoner{}, id).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete prisoner"})
		return
	}

	if roomIDToUpdate != nil {
		if err := updateRoomStatus(tx, *roomIDToUpdate); err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room status after deletion: " + err.Error()})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Prisoner deleted successfully"})
}

// GetPrisoners - ดึงนักโทษทั้งหมด
func GetPrisoners(c *gin.Context) {
	var prisoners []entity.Prisoner
	if err := configs.DB().
		Preload("Gender").
		Preload("Room").
		Preload("Work").
		Order("prisoner_id ASC").
		Find(&prisoners).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch prisoners"})
		return
	}
	c.JSON(http.StatusOK, prisoners)
}

// GetPrisonerByID - ดึงนักโทษตาม Prisoner_ID
func GetPrisonerByID(c *gin.Context) {
	id := c.Param("id")
	var prisoner entity.Prisoner
	if err := configs.DB().
		Preload("Gender").
		Preload("Room").
		Preload("Work").
		First(&prisoner, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prisoner not found"})
		return
	}
	c.JSON(http.StatusOK, prisoner)
}

// GetNextInmateID - สร้าง Inmate_ID ใหม่
func GetNextInmateID(c *gin.Context) {
	var latest entity.Prisoner
	err := configs.DB().
		Order("inmate_id DESC").
		First(&latest).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusOK, gin.H{"inmate_id": "P-0001"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query latest inmate id"})
		return
	}

	parts := strings.Split(latest.Inmate_ID, "-")
	if len(parts) != 2 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid Inmate ID format in database"})
		return
	}

	currentNum, err := strconv.Atoi(parts[1])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse Inmate ID number"})
		return
	}

	newID := fmt.Sprintf("P-%04d", currentNum+1)
	c.JSON(http.StatusOK, gin.H{"inmate_id": newID})
}

// รายการเกณฑ์พฤติกรรม
func GetBehaviorCriteria(c *gin.Context) {
	var criteria []entity.BehaviorCriterion
	if err := configs.DB().Find(&criteria).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch behavior criteria"})
		return
	}
	c.JSON(http.StatusOK, criteria)
}
