package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

// --- Room Handlers ---

type RoomInput struct {
	Room_Name   string `json:"Room_Name" binding:"required"`
	Room_Status string `json:"Room_Status"`
}

// CreateRoom - สร้างห้องใหม่
func CreateRoom(c *gin.Context) {
	var input RoomInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	room := entity.Room{
		Room_Name:   input.Room_Name,
		Room_Status: "ว่าง", // กำหนดสถานะเป็น "ว่าง" อัตโนมัติ
	}

	if err := configs.DB().Create(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, room)
}

// GetRooms - ดึงข้อมูลห้องทั้งหมด
func GetRooms(c *gin.Context) {
	var rooms []entity.Room
	if err := configs.DB().Order("room_name asc").Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}
	c.JSON(http.StatusOK, rooms)
}

// UpdateRoom - อัปเดตข้อมูลห้อง
func UpdateRoom(c *gin.Context) {
	id := c.Param("id")
	var room entity.Room
	if err := configs.DB().First(&room, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	var input RoomInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	if err := configs.DB().Model(&room).Update("room_name", input.Room_Name).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room"})
		return
	}

	c.JSON(http.StatusOK, room)
}

// DeleteRoom - ลบห้อง
func DeleteRoom(c *gin.Context) {
	id := c.Param("id")

	var count int64
	configs.DB().Model(&entity.Prisoner{}).Where("room_id = ?", id).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่สามารถลบห้องได้ เนื่องจากยังมีนักโทษอยู่ในห้องนี้"})
		return
	}

	if err := configs.DB().Delete(&entity.Room{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete room"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Room deleted successfully"})
}