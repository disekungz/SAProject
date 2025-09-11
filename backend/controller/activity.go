package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
	"gorm.io/gorm"
)

// --- Structs for Input Binding ---

// For creating/updating a SCHEDULE
type activityScheduleInput struct {
	ActivityID      uint      `json:"activityId" binding:"required"`
	StaffID         uint      `json:"staffId" binding:"required"`
	MaxParticipants int       `json:"maxParticipants" binding:"required"`
	StartDate       time.Time `json:"startDate" binding:"required"`
	EndDate         time.Time `json:"endDate" binding:"required"`
	StartTime       string    `json:"startTime" binding:"required"`
	EndTime         string    `json:"endTime" binding:"required"`
}

// For creating/updating a master ACTIVITY
type activityInput struct {
	ActivityName string `json:"activityName" binding:"required"`
	Description  string `json:"description"`
	Location     string `json:"location" binding:"required"`
}

// --- Master Activity CRUD ---

// POST /activities
func CreateActivity(c *gin.Context) {
	db := configs.DB()
	var input activityInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	activity := entity.Activity{
		ActivityName: input.ActivityName,
		Description:  input.Description,
		Location:     input.Location,
	}

	if err := db.Create(&activity).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, activity)
}

// GET /activities
func GetActivities(c *gin.Context) {
	db := configs.DB()
	var activities []entity.Activity
	if err := db.Order("activity_name ASC").Find(&activities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, activities)
}

// PUT /activities/:id
func UpdateActivity(c *gin.Context) {
	db := configs.DB()
	id := c.Param("id")

	var input activityInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var activity entity.Activity
	if err := db.First(&activity, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Activity not found"})
		return
	}

	activity.ActivityName = input.ActivityName
	activity.Description = input.Description
	activity.Location = input.Location

	if err := db.Save(&activity).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, activity)
}

// DELETE /activities/:id
func DeleteActivity(c *gin.Context) {
	db := configs.DB()
	id := c.Param("id")

	// Safety check: prevent deletion if activity is in use by a schedule
	var count int64
	if err := db.Model(&entity.ActivitySchedule{}).Where("activity_id = ?", id).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking for schedules"})
		return
	}

	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("ไม่สามารถลบได้ เนื่องจากกิจกรรมนี้ถูกใช้งานใน %d ตารางเวลา", count)})
		return
	}

	if err := db.Delete(&entity.Activity{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Activity deleted successfully"})
}

// --- Activity Schedule Handlers (Refactored) ---

// GET /schedules
func GetActivitySchedules(c *gin.Context) {
	db := configs.DB()
	var schedules []entity.ActivitySchedule
	if err := db.
		Preload("Activity").
		Preload("Staff").
		Preload("Enrollment.Prisoner").
		Order("schedule_id ASC").
		Find(&schedules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, schedules)
}

// POST /schedules
func CreateActivitySchedule(c *gin.Context) {
	db := configs.DB()
	var input activityScheduleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if input.EndDate.Before(input.StartDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "EndDate must not be before StartDate"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		// Verify that dependent records exist
		if err := tx.First(&entity.Staff{}, input.StaffID).Error; err != nil {
			return fmt.Errorf("staff with id %d not found", input.StaffID)
		}
		if err := tx.First(&entity.Activity{}, input.ActivityID).Error; err != nil {
			return fmt.Errorf("activity with id %d not found", input.ActivityID)
		}

		//  ---- START: ตรวจสอบการซ้อนทับของวันและเวลา ----
		var existingSchedule entity.ActivitySchedule
		err := tx.Where(
			"activity_id = ? AND end_date >= ? AND start_date <= ? AND end_time > ? AND start_time < ?",
			input.ActivityID,
			input.StartDate,  // existing.EndDate >= new.StartDate
			input.EndDate,    // existing.StartDate <= new.EndDate
			input.StartTime,  // existing.EndTime > new.StartTime
			input.EndTime,    // existing.StartTime < new.EndTime
		).First(&existingSchedule).Error

		if err == nil {
			return fmt.Errorf("ไม่สามารถเพิ่มได้: มีช่วงเวลาของกิจกรรมนี้ซ้อนทับกันอยู่")
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		//  ---- END: ตรวจสอบการซ้อนทับ ----

		// Create the schedule
		schedule := entity.ActivitySchedule{
			StartDate:   input.StartDate,
			EndDate:     input.EndDate,
			StartTime:   input.StartTime,
			EndTime:     input.EndTime,
			Max:         input.MaxParticipants,
			StaffID:     &input.StaffID,
			Activity_ID: input.ActivityID,
		}
		if err := tx.Create(&schedule).Error; err != nil {
			return err
		}
		
		// Preload for response
		if err := tx.Preload("Activity").Preload("Staff").First(&schedule, schedule.Schedule_ID).Error; err != nil {
			return err
		}

		c.JSON(http.StatusCreated, schedule)
		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}

// PUT /schedules/:id
func UpdateActivitySchedule(c *gin.Context) {
	db := configs.DB()
	id := c.Param("id")
	var input activityScheduleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if input.EndDate.Before(input.StartDate) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "EndDate must not be before StartDate"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		var schedule entity.ActivitySchedule
		if err := tx.First(&schedule, id).Error; err != nil {
			return err // Schedule not found
		}
		
		// Verify dependencies
		if err := tx.First(&entity.Staff{}, input.StaffID).Error; err != nil {
			return fmt.Errorf("staff with id %d not found", input.StaffID)
		}
		if err := tx.First(&entity.Activity{}, input.ActivityID).Error; err != nil {
			return fmt.Errorf("activity with id %d not found", input.ActivityID)
		}

		//  ---- START: ตรวจสอบการซ้อนทับของวันและเวลา (ยกเว้น ID ของตัวเอง) ----
		var existingSchedule entity.ActivitySchedule
		err := tx.Where(
			"activity_id = ? AND end_date >= ? AND start_date <= ? AND end_time > ? AND start_time < ? AND schedule_id != ?",
			input.ActivityID,
			input.StartDate,
			input.EndDate,
			input.StartTime,
			input.EndTime,
			id, // ID ของรายการที่กำลังแก้ไข
		).First(&existingSchedule).Error

		if err == nil {
			return fmt.Errorf("ไม่สามารถแก้ไขได้: มีช่วงเวลาของกิจกรรมอื่นซ้อนทับกันอยู่")
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
        //  ---- END: ตรวจสอบการซ้อนทับ ----

		// Update Schedule fields
		schedule.StartDate = input.StartDate
		schedule.EndDate = input.EndDate
		schedule.StartTime = input.StartTime
		schedule.EndTime = input.EndTime
		schedule.Max = input.MaxParticipants
		schedule.StaffID = &input.StaffID
		schedule.Activity_ID = input.ActivityID // Update the foreign key

		if err := tx.Save(&schedule).Error; err != nil {
			return err
		}
		
		if err := tx.Preload("Activity").Preload("Staff").Preload("Enrollment.Prisoner").First(&schedule, id).Error; err != nil {
			return err
		}

		c.JSON(http.StatusOK, schedule)
		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}


// DELETE /schedules/:id
func DeleteActivitySchedule(c *gin.Context) {
	db := configs.DB()
	id := c.Param("id")
	err := db.Transaction(func(tx *gorm.DB) error {
		var scheduleToDelete entity.ActivitySchedule
		if err := tx.First(&scheduleToDelete, id).Error; err != nil {
			return err
		}
		activityID := scheduleToDelete.Activity_ID
		if err := tx.Where("schedule_id = ?", id).Delete(&entity.Enrollment{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&entity.ActivitySchedule{}, id).Error; err != nil {
			return err
		}
		var remainingSchedules int64
		if err := tx.Model(&entity.ActivitySchedule{}).Where("activity_id = ?", activityID).Count(&remainingSchedules).Error; err != nil {
			return err
		}
		if remainingSchedules == 0 {
			if err := tx.Delete(&entity.Activity{}, activityID).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Schedule and related data deleted successfully"})
}

// ... enrollmentInput and other functions
type enrollmentInput struct {
	ScheduleID uint `json:"scheduleId" binding:"required"`
	PrisonerID uint `json:"prisonerId" binding:"required"`
}

// POST /enrollments
func EnrollParticipant(c *gin.Context) {
	db := configs.DB()

	var input enrollmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		var s entity.ActivitySchedule
		if err := tx.First(&s, input.ScheduleID).Error; err != nil {
			return err
		}
		var p entity.Prisoner
		if err := tx.First(&p, input.PrisonerID).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&entity.Enrollment{}).
			Where("schedule_id = ? AND prisoner_id = ?", input.ScheduleID, input.PrisonerID).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ผู้ต้องขังถูกลงทะเบียนในรอบนี้แล้ว"})
			return nil
		}

		enrollment := entity.Enrollment{
			EnrollDate:  time.Now(),
			Status:      1,
			Schedule_ID: input.ScheduleID,
			Prisoner_ID: input.PrisonerID,
		}
		if err := tx.Create(&enrollment).Error; err != nil {
			return err
		}

		c.JSON(http.StatusCreated, enrollment)
		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}

type statusUpdateInput struct {
	Status  int    `json:"status"`
	Remarks string `json:"remarks"`
}

// PUT /enrollments/:id/status
func UpdateEnrollmentStatus(c *gin.Context) {
	db := configs.DB()
	id := c.Param("id")

	var input statusUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var enrollment entity.Enrollment
	if err := db.First(&enrollment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบทะเบียนเข้าร่วม"})
		return
	}
	enrollment.Status = input.Status
	enrollment.Remarks = input.Remarks

	if err := db.Save(&enrollment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, enrollment)
}

// DELETE /enrollments/:id
func DeleteEnrollment(c *gin.Context) {
	db := configs.DB()
	id := c.Param("id")

	if err := db.Delete(&entity.Enrollment{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Enrollment deleted"})
}
