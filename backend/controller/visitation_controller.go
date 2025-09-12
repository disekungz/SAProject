package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
	"gorm.io/gorm"
)

// VisitationInput defines the payload structure from the frontend
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

// -------------------- GET /visitations --------------------
func GetVisitations(c *gin.Context) {
	var items []entity.Visitation
	query := configs.DB().
		Preload("Inmate").
		Preload("Visitor").
		Preload("Staff").
		Preload("Status").
		Preload("Relationship").
		Preload("TimeSlot").
		Order("visit_date desc")

	rankId, _ := c.Get("rankId")

	// ✅ FIX: Check rankId as INT to match middleware
	if id, ok := rankId.(int); ok && id == 3 {
		citizenId, exists := c.Get("citizenId")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "Citizen ID not found in token for visitor"})
			return
		}
		userCitizenID := citizenId.(string)

		var visitor entity.Visitor
		// Find the visitor's ID from their citizen ID
		if err := configs.DB().Where("citizen_id = ?", userCitizenID).First(&visitor).Error; err != nil {
			// If no visitor record found, return an empty list
			c.JSON(http.StatusOK, []entity.Visitation{})
			return
		}

		// Filter visitations by the found visitor's ID
		if visitor.ID > 0 {
			query = query.Where("visitor_id = ?", visitor.ID)
		} else {
			c.JSON(http.StatusOK, []entity.Visitation{})
			return
		}
	}

	if err := query.Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get visitations"})
		return
	}

	c.JSON(http.StatusOK, items)
}

// -------------------- POST /visitations --------------------
func CreateVisitation(c *gin.Context) {
	var input VisitationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	visitDate, err := time.Parse("2006-01-02", input.Visit_Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format. Please use YYYY-MM-DD."})
		return
	}

	tx := configs.DB().Begin()

	// Find existing visitor or create a new one
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

	// Check for booking conflicts
	var existingVisit entity.Visitation
	err = tx.Where("visit_date = ? AND time_slot_id = ?", visitDate, input.TimeSlot_ID).First(&existingVisit).Error
	if err == nil {
		tx.Rollback()
		c.JSON(http.StatusConflict, gin.H{"error": "Time slot already booked for this date"})
		return
	}
	if err != gorm.ErrRecordNotFound {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error during booking check"})
		return
	}

	// Create the new visitation record
	item := entity.Visitation{
		Visit_Date:      visitDate,
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

// -------------------- PUT /visitations/:id --------------------
func UpdateVisitation(c *gin.Context) {
	id := c.Param("id")
	var item entity.Visitation
	if err := configs.DB().First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visitation not found"})
		return
	}

	rankId, _ := c.Get("rankId")

	// ✅ FIX: Check authorization using INT for rankId
	if id, ok := rankId.(int); ok && id == 3 {
		citizenId, _ := c.Get("citizenId")
		var visitor entity.Visitor
		configs.DB().Where("citizen_id = ?", citizenId).First(&visitor)
		if item.Visitor_ID != nil && *item.Visitor_ID != visitor.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "You are not allowed to edit this record"})
			return
		}
	}

	var input VisitationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	visitDate, err := time.Parse("2006-01-02", input.Visit_Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format. Please use YYYY-MM-DD."})
		return
	}

	tx := configs.DB().Begin()

	// Handle visitor data
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

	// Check for booking conflicts, excluding the current record
	var existingVisit entity.Visitation
	err = tx.Where("id <> ? AND visit_date = ? AND time_slot_id = ?", id, visitDate, input.TimeSlot_ID).First(&existingVisit).Error
	if err == nil {
		tx.Rollback()
		c.JSON(http.StatusConflict, gin.H{"error": "Time slot already booked for this date"})
		return
	}
	if err != gorm.ErrRecordNotFound {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error during booking check"})
		return
	}

	// Update fields
	item.Visit_Date = visitDate
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

// -------------------- DELETE /visitations/:id --------------------
func DeleteVisitation(c *gin.Context) {
	id := c.Param("id")
	var item entity.Visitation
	if err := configs.DB().First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Visitation not found"})
		return
	}

	rankId, _ := c.Get("rankId")

	// ✅ FIX: Check authorization using INT for rankId
	if id, ok := rankId.(int); ok && id == 3 {
		citizenId, _ := c.Get("citizenId")
		var visitor entity.Visitor
		configs.DB().Where("citizen_id = ?", citizenId).First(&visitor)
		if item.Visitor_ID != nil && *item.Visitor_ID != visitor.ID {
			c.JSON(http.StatusForbidden, gin.H{"error": "You are not allowed to delete this record"})
			return
		}
	}

	if err := configs.DB().Delete(&entity.Visitation{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete visitation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Visitation deleted successfully"})
}
