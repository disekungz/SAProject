package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

// Payload ที่จะรับจาก Frontend
type VisitationInput struct {
	Visit_Date       string `json:"Visit_Date"`
	TimeSlot_ID      uint   `json:"TimeSlot_ID"`
	Inmate_ID        uint   `json:"Inmate_ID"`
	Relationship_ID  uint   `json:"Relationship_ID"`
	Staff_ID         uint   `json:"Staff_ID"`
	Status_ID        uint   `json:"Status_ID"`
	VisitorFirstName string `json:"VisitorFirstName"`
	VisitorLastName  string `json:"VisitorLastName"`
	VisitorCitizenID string `json:"VisitorCitizenID"`
}

// -------------------- GET --------------------
func GetVisitations(c *gin.Context) {
	var items []entity.Visitation
	configs.DB().
		Preload("Inmate").
		Preload("Visitor").
		Preload("Staff").
		Preload("Status").
		Preload("Relationship").
		Preload("TimeSlot").
		Order("created_at desc").
		Find(&items)

	c.JSON(http.StatusOK, items)
}

// -------------------- POST --------------------
func CreateVisitation(c *gin.Context) {
	var input VisitationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	tx := configs.DB().Begin()

	// หรือตรวจสอบผู้เยี่ยมชมจาก Citizen_ID
	var visitor entity.Visitor
	visitorData := entity.Visitor{
		FirstName:  input.VisitorFirstName,
		LastName:   input.VisitorLastName,
		Citizen_ID: input.VisitorCitizenID,
	}
	if err := tx.Where(entity.Visitor{Citizen_ID: input.VisitorCitizenID}).
		FirstOrCreate(&visitor, visitorData).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to handle visitor data"})
		return
	}

	// ตรวจสอบการจองซ้ำซ้อน
	var existingVisit entity.Visitation
	if err := tx.Where("visit_date = ? AND time_slot_id = ?", input.Visit_Date, input.TimeSlot_ID).
		First(&existingVisit).Error; err == nil {
		tx.Rollback()
		c.JSON(http.StatusConflict, gin.H{"error": "Time slot already booked"})
		return
	}

	// บันทึกการเยี่ยมใหม่
	item := entity.Visitation{
		Visit_Date:      input.Visit_Date,
		TimeSlot_ID:     &input.TimeSlot_ID,
		Staff_ID:        &input.Staff_ID,
		Status_ID:       &input.Status_ID,
		Relationship_ID: &input.Relationship_ID,
		Visitor_ID:      &visitor.ID,
		Inmate_ID:       &input.Inmate_ID,
	}
	if err := tx.Create(&item).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create visitation"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusCreated, item)
}

// -------------------- PUT --------------------
func UpdateVisitation(c *gin.Context) {
	id := c.Param("id")
	var item entity.Visitation
	if err := configs.DB().First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visitation not found"})
		return
	}

	var input VisitationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	tx := configs.DB().Begin()

	// อัปเดต Visitor
	var visitor entity.Visitor
	visitorData := entity.Visitor{
		FirstName:  input.VisitorFirstName,
		LastName:   input.VisitorLastName,
		Citizen_ID: input.VisitorCitizenID,
	}
	if err := tx.Where(entity.Visitor{Citizen_ID: input.VisitorCitizenID}).
		FirstOrCreate(&visitor, visitorData).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to handle visitor data"})
		return
	}

	// ตรวจสอบการจองซ้ำ ยกเว้นตัวเอง
	var existingVisit entity.Visitation
	if err := tx.Where("id <> ? AND visit_date = ? AND time_slot_id = ?", id, input.Visit_Date, input.TimeSlot_ID).
		First(&existingVisit).Error; err == nil {
		tx.Rollback()
		c.JSON(http.StatusConflict, gin.H{"error": "Time slot already booked"})
		return
	}

	// อัปเดตข้อมูล
	item.Visit_Date = input.Visit_Date
	item.TimeSlot_ID = &input.TimeSlot_ID
	item.Inmate_ID = &input.Inmate_ID
	item.Staff_ID = &input.Staff_ID
	item.Status_ID = &input.Status_ID
	item.Relationship_ID = &input.Relationship_ID
	item.Visitor_ID = &visitor.ID

	if err := tx.Save(&item).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update visitation"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusOK, item)
}

// -------------------- DELETE --------------------
func DeleteVisitation(c *gin.Context) {
	id := c.Param("id")
	if err := configs.DB().Delete(&entity.Visitation{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete visitation"})
		return
	}
	c.Status(http.StatusNoContent)
}
