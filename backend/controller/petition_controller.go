package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
	"gorm.io/gorm"
)

// PetitionInput defines the payload structure from the frontend
type PetitionInput struct {
	Detail       string `json:"Detail"`
	Date_created string `json:"Date_created"` // Received as string from frontend
	Inmate_ID    uint   `json:"Inmate_ID"`
	Staff_ID     uint   `json:"Staff_ID"`
	Status_ID    uint   `json:"Status_ID"`
	Type_cum_ID  uint   `json:"Type_cum_ID"`
}

// isStaff checks if the logged-in user is a staff member (not a relative, RankID 3)
// file: petition_controller.go
// isStaff checks if the logged-in user is a staff member
func isStaff(c *gin.Context) bool {
	rankId, exists := c.Get("rankId")
	if !exists {
		return false
	}
	// ✅ แก้ไขเป็น int ให้ตรงกับที่ Middleware ส่งมา
	if id, ok := rankId.(int); ok {
		// อนุญาตทุก Rank ID ที่ไม่ใช่ 3 (ญาติ)
		return id != 3
	}
	return false
}

// POST /petitions
func CreatePetition(c *gin.Context) {
	if !isStaff(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not authorized to perform this action."})
		return
	}

	var input PetitionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	dateCreated, err := time.Parse(time.RFC3339, input.Date_created)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format. Please use ISO 8601 (toISOString)."})
		return
	}

	petition := entity.Petition{
		Detail:       input.Detail,
		Date_created: dateCreated,
		Inmate_ID:    &input.Inmate_ID,
		Staff_ID:     &input.Staff_ID,
		Status_ID:    &input.Status_ID,
		Type_cum_ID:  &input.Type_cum_ID,
	}

	if err := configs.DB().Create(&petition).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create petition: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, petition)
}

// GET /petitions
func GetPetitions(c *gin.Context) {
	var petitions []entity.Petition
	if err := configs.DB().
		Preload("Inmate").
		Preload("Staff").
		Preload("Status").
		Preload("Type").
		Order("date_created desc").
		Find(&petitions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve petitions."})
		return
	}
	c.JSON(http.StatusOK, petitions)
}

// PUT /petitions/:id
func UpdatePetition(c *gin.Context) {
	if !isStaff(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not authorized to perform this action."})
		return
	}

	id := c.Param("id")
	var petition entity.Petition
	if err := configs.DB().First(&petition, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Petition not found."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}

	var input PetitionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	dateCreated, err := time.Parse(time.RFC3339, input.Date_created)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format. Please use ISO 8601 (toISOString)."})
		return
	}

	petition.Detail = input.Detail
	petition.Date_created = dateCreated
	petition.Inmate_ID = &input.Inmate_ID
	petition.Staff_ID = &input.Staff_ID
	petition.Status_ID = &input.Status_ID
	petition.Type_cum_ID = &input.Type_cum_ID

	if err := configs.DB().Save(&petition).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update petition: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, petition)
}

// DELETE /petitions/:id
func DeletePetition(c *gin.Context) {
	if !isStaff(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not authorized to perform this action."})
		return
	}

	id := c.Param("id")
	if err := configs.DB().Delete(&entity.Petition{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete petition."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Petition deleted successfully."})
}

// GET /typesc (Petition Types for dropdowns)
func GetTypeCums(c *gin.Context) {
	// ⭐️ แก้ไข: ต้องใช้ชื่อ struct ที่ถูกต้องตาม entity ของคุณ
	// สมมติว่าใน entity ชื่อ Type_cum หรือ PetitionTypeCum
	var types []entity.Type_cum
	if err := configs.DB().Find(&types).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve petition types."})
		return
	}
	c.JSON(http.StatusOK, types)
}
