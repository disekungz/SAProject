package controller

import (
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

// RequestingInput - Struct for receiving JSON from Frontend (for creating/editing main data)
type RequestingInput struct {
	Requesting_NO  string `json:"Requesting_NO"`
	PID            *uint  `json:"PID" binding:"required"`
	Amount_Request uint   `json:"Amount_Request" binding:"required,min=1"`
	Request_Date   string `json:"Request_Date" binding:"required"`
	Staff_ID       *uint  `json:"Staff_ID" binding:"required"`
}

// StatusUpdateInput - Struct for receiving JSON (for updating status only)
type StatusUpdateInput struct {
	Status_ID *uint `json:"Status_ID" binding:"required"`
}

// GetRequestings - Fetches all requesting records
func GetRequestings(c *gin.Context) {
	var requestings []entity.Requesting
	if err := configs.DB().
		Preload("Parcel").
		Preload("Staff").
		Preload("Status").
		Find(&requestings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, requestings)
}

// GetNextRequestNo - Generates the next request number (XXXX/YYYY)
func GetNextRequestNo(c *gin.Context) {
	var latestRequesting entity.Requesting
	loc, _ := time.LoadLocation("Asia/Bangkok")
	currentYear := time.Now().In(loc).Year() + 543

	err := configs.DB().
		Where("SUBSTRING(requesting_no, 6, 4) = ?", fmt.Sprintf("%d", currentYear)).
		Order("requesting_no desc").
		First(&latestRequesting).Error

	var nextSeqNum = 1
	if err == nil {
		parts := strings.Split(latestRequesting.Requesting_NO, "/")
		if len(parts) == 2 {
			seqStr := parts[0]
			currentNum, _ := strconv.Atoi(seqStr)
			nextSeqNum = currentNum + 1
		}
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query latest request number"})
		return
	}

	newRequestNo := fmt.Sprintf("%04d/%d", nextSeqNum, currentYear)
	c.JSON(http.StatusOK, gin.H{"request_no": newRequestNo})
}

// CreateRequesting - Creates a new requesting record
func CreateRequesting(c *gin.Context) {
    // เปลี่ยนมาใช้ RequestingInput struct ที่มีทุกฟิลด์ที่จำเป็น
    var input RequestingInput 

    // Bind JSON
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
        return
    }

    // แปลง string date จาก input เป็น time.Time
    requestDate, err := time.Parse("2006-01-02", input.Request_Date)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Request_Date format, use YYYY-MM-DD"})
        return
    }

    // Generate Requesting_NO automatically
    loc, _ := time.LoadLocation("Asia/Bangkok")
    var latest entity.Requesting
    currentYear := time.Now().In(loc).Year() + 543
    err = configs.DB().
        Where("SUBSTRING(requesting_no, 6, 4) = ?", fmt.Sprintf("%d", currentYear)).
        Order("requesting_no desc").
        First(&latest).Error

    nextSeqNum := 1
    if err == nil {
        parts := strings.Split(latest.Requesting_NO, "/")
        if len(parts) == 2 {
            currentNum, _ := strconv.Atoi(parts[0])
            nextSeqNum = currentNum + 1
        }
    } else if err != gorm.ErrRecordNotFound {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query latest request number"})
        return
    }
    newRequestNo := fmt.Sprintf("%04d/%d", nextSeqNum, currentYear)

    statusID := uint(1) // default status

    requesting := entity.Requesting{
        Requesting_NO:  newRequestNo,
        PID:            input.PID, // ใช้จาก input
        Amount_Request: input.Amount_Request, // ใช้จาก input
        Request_Date:   requestDate, // ใช้วันที่ที่แปลงแล้ว
        StaffID:        input.Staff_ID, // ใช้จาก input
        Status_ID:      &statusID,
    }

    if err := configs.DB().Create(&requesting).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create requesting: " + err.Error()})
        return
    }

    // preload associations
    configs.DB().Preload("Parcel").Preload("Staff").Preload("Status").First(&requesting, requesting.Requesting_ID)

    c.JSON(http.StatusCreated, requesting)
}
// UpdateRequesting - Updates the main data of a requesting record (excluding status)
func UpdateRequesting(c *gin.Context) {
	id := c.Param("id")
	var requesting entity.Requesting
	if err := configs.DB().First(&requesting, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Requesting not found"})
		return
	}

	var input RequestingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	requestDate, err := time.Parse("2006-01-02", input.Request_Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Request_Date format, use YYYY-MM-DD"})
		return
	}

	updateData := map[string]interface{}{
		"PID":            input.PID,
		"Amount_Request": input.Amount_Request,
		"Request_Date":   requestDate,
		"Staff_ID":       input.Staff_ID,
	}

	if err := configs.DB().Model(&requesting).Updates(updateData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update requesting: " + err.Error()})
		return
	}

	configs.DB().Preload("Parcel").Preload("Staff").Preload("Status").First(&requesting, id)
	c.JSON(http.StatusOK, requesting)
}

// UpdateRequestingStatus - Updates only the status of a requesting record
func UpdateRequestingStatus(c *gin.Context) {
	id := c.Param("id")
	var requesting entity.Requesting
	if err := configs.DB().First(&requesting, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Requesting not found"})
		return
	}

	var input StatusUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format: " + err.Error()})
		return
	}

	var status entity.Status
	if err := configs.DB().First(&status, *input.Status_ID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Status ID"})
		return
	}

	if err := configs.DB().Model(&requesting).Update("status_id", input.Status_ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update requesting status"})
		return
	}

	configs.DB().Preload("Parcel").Preload("Staff").Preload("Status").First(&requesting, id)
	c.JSON(http.StatusOK, requesting)
}

// DeleteRequesting - Deletes a requesting record
func DeleteRequesting(c *gin.Context) {
	id := c.Param("id")
	// Use GORM's delete method with the primary key
	if err := configs.DB().Delete(&entity.Requesting{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete requesting"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Requesting deleted successfully"})
}
