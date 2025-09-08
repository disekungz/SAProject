package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

type PetitionInput struct {
	Detail      string `json:"Detail"`
	Inmate_ID   uint   `json:"Inmate_ID"`
	Staff_ID    uint   `json:"Staff_ID"`
	Status_ID   uint   `json:"Status_ID"`
	Type_ID     uint   `json:"Type_ID"`
}

func GetPetitions(c *gin.Context) {
	var items []entity.Petition
	if err := configs.DB().
		Preload("Inmate").
		Preload("Staff").
		Preload("Status").
		Preload("Type").
		Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch petitions"})
		return
	}
	c.JSON(http.StatusOK, items)
}

func CreatePetition(c *gin.Context) {
	var input PetitionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item := entity.Petition{
		Detail:      input.Detail,
		Inmate_ID:   &input.Inmate_ID,
		Staff_ID:    &input.Staff_ID,
		Status_ID:   &input.Status_ID,
		Type_cum_ID: &input.Type_ID,
	}

	configs.DB().Create(&item)
	c.JSON(http.StatusCreated, item)
}

func UpdatePetition(c *gin.Context) {
	id := c.Param("id")
	var item entity.Petition
	if err := configs.DB().First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}

	var input PetitionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item.Detail = input.Detail
	item.Inmate_ID = &input.Inmate_ID
	item.Staff_ID = &input.Staff_ID
	item.Status_ID = &input.Status_ID
	item.Type_cum_ID = &input.Type_ID

	configs.DB().Save(&item)
	c.JSON(http.StatusOK, item)
}

func DeletePetition(c *gin.Context) {
	id := c.Param("id")
	configs.DB().Delete(&entity.Petition{}, id)
	c.Status(http.StatusNoContent)
}

// API สำหรับ dropdown
func GetStaff(c *gin.Context) {
	var staffs []entity.Staff
	configs.DB().Find(&staffs)
	c.JSON(http.StatusOK, staffs)
}

func GetTypeCums(c *gin.Context) {
	var types []entity.Type_cum
	configs.DB().Find(&types)
	c.JSON(http.StatusOK, types)
}

