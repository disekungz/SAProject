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
	MID             uint      `json:"instructorId" binding:"required"`
	MaxParticipants int       `json:"maxParticipants" binding:"required"`
	StartDate       time.Time `json:"startDate" binding:"required"`
	EndDate         time.Time `json:"endDate" binding:"required"`
	StartTime       string    `json:"startTime" binding:"required"` // "HH:MM"
	EndTime         string    `json:"endTime" binding:"required"`   // "HH:MM"
}

// GET /activity-schedules
func GetActivitySchedules(c *gin.Context) {
	db := configs.DB()

	var schedules []entity.ActivitySchedule
	if err := db.
		Preload("Activity").
		Preload("Member").
		Preload("Enrollment.Prisoner").
		Order("schedule_id ASC").
		Find(&schedules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, schedules)
}

// POST /activity-schedules
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
		// 1) ตรวจว่ามี Member (ผู้สอน/ผู้นำกิจกรรม) จริงไหม
		var m entity.Member
		if err := tx.First(&m, input.MID).Error; err != nil {
			return err
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
			MID:         input.MID,
			Activity_ID: activity.Activity_ID,
		}
		if err := tx.Create(&schedule).Error; err != nil {
			return err
		}

		// โหลดความสัมพันธ์เพื่อตอบกลับ
		if err := tx.Preload("Activity").Preload("Member").
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

// PUT /activity-schedules/:id
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
		// โหลด schedule เดิม
		var schedule entity.ActivitySchedule
		if err := tx.First(&schedule, id).Error; err != nil {
			return err
		}

		// โหลด activity เดิม
		var activity entity.Activity
		if err := tx.First(&activity, schedule.Activity_ID).Error; err != nil {
			return err
		}

		// อัปเดต Activity
		activity.ActivityName = input.ActivityName
		activity.Location = input.Location
		activity.Description = input.Description
		if err := tx.Save(&activity).Error; err != nil {
			return err
		}

		// ตรวจ Member ว่ามีอยู่จริง
		var m entity.Member
		if err := tx.First(&m, input.MID).Error; err != nil {
			return err
		}

		// อัปเดต Schedule
		schedule.StartDate = input.StartDate
		schedule.EndDate = input.EndDate
		schedule.StartTime = input.StartTime
		schedule.EndTime = input.EndTime
		schedule.Max = input.MaxParticipants
		schedule.MID = input.MID
		if err := tx.Save(&schedule).Error; err != nil {
			return err
		}

		// preload ส่งกลับ
		if err := tx.Preload("Activity").
			Preload("Member").
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

// DELETE /activity-schedules/:id
func DeleteActivitySchedule(c *gin.Context) {
	db := configs.DB()
	id := c.Param("id")

	err := db.Transaction(func(tx *gorm.DB) error {
		// 1. ค้นหา Schedule ที่จะลบเพื่อเอา Activity_ID มาใช้ทีหลัง
		var scheduleToDelete entity.ActivitySchedule
		if err := tx.First(&scheduleToDelete, id).Error; err != nil {
			// ถ้าไม่เจอ schedule ก็จบการทำงาน
			return err
		}
		activityID := scheduleToDelete.Activity_ID

		// 2. ลบ Enrollment ทั้งหมดที่เกี่ยวข้องกับ Schedule นี้ก่อน (ถูกต้องแล้ว)
		if err := tx.Where("schedule_id = ?", id).Delete(&entity.Enrollment{}).Error; err != nil {
			return err
		}

		// 3. ลบ Schedule เอง (ถูกต้องแล้ว)
		if err := tx.Delete(&entity.ActivitySchedule{}, id).Error; err != nil {
			return err
		}

		// 4. (ส่วนที่เพิ่มเข้ามา) ตรวจสอบว่ามี Schedule อื่นยังใช้ Activity นี้อยู่หรือไม่
		var remainingSchedules int64
		if err := tx.Model(&entity.ActivitySchedule{}).Where("activity_id = ?", activityID).Count(&remainingSchedules).Error; err != nil {
			return err
		}

		// 5. (ส่วนที่เพิ่มเข้ามา) ถ้าไม่มี Schedule ไหนใช้ Activity นี้แล้ว ก็ลบ Activity ทิ้ง
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
