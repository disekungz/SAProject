package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
	"gorm.io/gorm"
)

type activityScheduleInput struct {
	ActivityName    string    `json:"activityName" binding:"required"`
	Description     string    `json:"description"`
	Location        string    `json:"room" binding:"required"`
	
	StaffID         uint      `json:"staffId" binding:"required"`
	MaxParticipants int       `json:"maxParticipants" binding:"required"`
	StartDate       time.Time `json:"startDate" binding:"required"`
	EndDate         time.Time `json:"endDate" binding:"required"`
	StartTime       string    `json:"startTime" binding:"required"`
	EndTime         string    `json:"endTime" binding:"required"`
}

// GET /schedules (ปรับชื่อ endpoint ให้สอดคล้องกับ Frontend)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "EndDate ต้องไม่น้อยกว่า StartDate"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		
		var staff entity.Staff
		if err := tx.First(&staff, input.StaffID).Error; err != nil {
			return err // ไม่พบ Staff
		}

		// 2) หา/สร้าง Activity
		var activity entity.Activity
		if err := tx.
			Where(&entity.Activity{ActivityName: input.ActivityName, Location: input.Location}).
			Attrs(entity.Activity{Description: input.Description}).
			FirstOrCreate(&activity).Error; err != nil {
			return err
		}

		// 3) สร้างตารางเวลา
		schedule := entity.ActivitySchedule{
			StartDate:   input.StartDate,
			EndDate:     input.EndDate,
			StartTime:   input.StartTime,
			EndTime:     input.EndTime,
			Max:         input.MaxParticipants,
			StaffID:     &input.StaffID, 
			Activity_ID: activity.Activity_ID,
		}
		if err := tx.Create(&schedule).Error; err != nil {
			return err
		}

		// โหลดความสัมพันธ์เพื่อตอบกลับ
		if err := tx.Preload("Activity").Preload("Staff"). 
			First(&schedule, schedule.Schedule_ID).Error; err != nil {
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "EndDate ต้องไม่น้อยกว่า StartDate"})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		var schedule entity.ActivitySchedule
		if err := tx.First(&schedule, id).Error; err != nil {
			return err
		}

		var activity entity.Activity
		if err := tx.First(&activity, schedule.Activity_ID).Error; err != nil {
			return err
		}

		activity.ActivityName = input.ActivityName
		activity.Location = input.Location
		activity.Description = input.Description
		if err := tx.Save(&activity).Error; err != nil {
			return err
		}

		//  ตรวจ Staff ว่ามีอยู่จริง
		var staff entity.Staff
		if err := tx.First(&staff, input.StaffID).Error; err != nil {
			return err
		}

		// อัปเดต Schedule
		schedule.StartDate = input.StartDate
		schedule.EndDate = input.EndDate
		schedule.StartTime = input.StartTime
		schedule.EndTime = input.EndTime
		schedule.Max = input.MaxParticipants
		schedule.StaffID = &input.StaffID 
		if err := tx.Save(&schedule).Error; err != nil {
			return err
		}

		if err := tx.Preload("Activity").
			Preload("Staff"). 
			Preload("Enrollment.Prisoner").
			First(&schedule, id).Error; err != nil {
			return err
		}

		c.JSON(http.StatusOK, schedule)
		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}

// (ส่วนที่เหลือของ Controller เช่น Delete, Enrollments ไม่ต้องแก้ไข เพราะไม่ผูกกับ Member/Staff โดยตรง)
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
		// เช็คว่า Schedule มีอยู่จริง
		var s entity.ActivitySchedule
		if err := tx.First(&s, input.ScheduleID).Error; err != nil {
			return err
		}
		// เช็คว่า Prisoner มีอยู่จริง
		var p entity.Prisoner
		if err := tx.First(&p, input.PrisonerID).Error; err != nil {
			return err
		}
		// (ออปชันนัล) ป้องกันซ้ำ
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
			Status:      1, // 1 = Participated (ปรับตามนิยามของคุณได้)
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
		// ถ้า transaction ส่ง error กลับมา
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
