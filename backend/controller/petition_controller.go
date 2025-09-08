// src/controller/petition_controller.go
package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

type PetitionInput struct {
	Detail       string    `json:"Detail"`
	Date_created time.Time `json:"Date_created"`
	Inmate_ID    uint      `json:"Inmate_ID"`
	Staff_ID     uint      `json:"Staff_ID"`
	Status_ID    uint      `json:"Status_ID"`
	Type_cum_ID  uint      `json:"Type_cum_ID"`
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
		Detail:       input.Detail,
		Date_created: input.Date_created,
		Inmate_ID:    &input.Inmate_ID,
		Staff_ID:     &input.Staff_ID,
		Status_ID:    &input.Status_ID,
		Type_cum_ID:  &input.Type_cum_ID,
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
	item.Date_created = input.Date_created
	item.Inmate_ID = &input.Inmate_ID
	item.Staff_ID = &input.Staff_ID
	item.Status_ID = &input.Status_ID
	item.Type_cum_ID = &input.Type_cum_ID

	configs.DB().Save(&item)
	c.JSON(http.StatusOK, item)
}

func DeletePetition(c *gin.Context) {
	id := c.Param("id")
	configs.DB().Delete(&entity.Petition{}, id)
	c.Status(http.StatusNoContent)
}

// Struct สำหรับรับข้อมูลการอัปเดตสถานะโดยเฉพาะ
type PetitionStatusUpdateInput struct {
	Status_ID uint `json:"Status_ID" binding:"required"`
}

// Function สำหรับอัปเดตสถานะของ Petition
func UpdatePetitionStatus(c *gin.Context) {
	id := c.Param("id")
	var petition entity.Petition

	// ค้นหา Petition ตาม ID ที่ส่งมา
	if err := configs.DB().First(&petition, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Petition not found"})
		return
	}

	var input PetitionStatusUpdateInput
	// รับค่า Status_ID ใหม่จาก request body
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// อัปเดตเฉพาะ Status_ID
	petition.Status_ID = &input.Status_ID

	// บันทึกการเปลี่ยนแปลงลงฐานข้อมูล
	if err := configs.DB().Save(&petition).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update petition status"})
		return
	}

	// ส่งข้อมูล Petition ที่อัปเดตแล้วกลับไป
	c.JSON(http.StatusOK, petition)
}

// API สำหรับ dropdown (หากมี)
func GetTypeCums(c *gin.Context) {
	var types []entity.Type_cum
	configs.DB().Find(&types)
	c.JSON(http.StatusOK, types)
}
