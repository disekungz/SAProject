package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
	"gorm.io/gorm"
)

// --- Adjustment (log การแก้ไขคะแนน) ---
func CreateAdjustment(c *gin.Context) {
	var input struct {
		Prisoner_ID uint   `json:"prisoner_id"`
		Inmate_ID   string `json:"inmate_id"` // เพื่อความสะดวกของ frontend (ไม่ต้อง map จาก Prisoner_ID อีกที)
		OldScore    int    `json:"oldScore"`
		NewScore    int    `json:"newScore"`
		MID         *uint  `json:"mid"`
		Remarks     string `json:"remarks"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ตรวจสอบว่า Prisoner_ID ถูกต้อง
	if input.Prisoner_ID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid prisoner ID"})
		return
	}

	// ตรวจสอบว่ามี prisoner นี้จริงหรือไม่
	var prisoner entity.Prisoner
	if err := configs.DB().First(&prisoner, input.Prisoner_ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Prisoner not found"})
		return
	}

	// หา ScoreBehavior ของ prisoner
	var sb entity.ScoreBehavior
	result := configs.DB().Where("prisoner_id = ?", input.Prisoner_ID).First(&sb)

	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			// ยังไม่มี → สร้างใหม่
			sb = entity.ScoreBehavior{
				Prisoner_ID: input.Prisoner_ID,
				Score:       input.NewScore,
			}
			if err := configs.DB().Create(&sb).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create score behavior"})
				return
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
			return
		}
	} else {
		// มีแล้ว → update
		sb.Score = input.NewScore
		if err := configs.DB().Save(&sb).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update score behavior"})
			return
		}
	}

	// บันทึก Adjustment
	remarks := input.Remarks
	adj := entity.Adjustment{
		OldScore:    input.OldScore,
		NewScore:    input.NewScore,
		Prisoner_ID: input.Prisoner_ID,
		SID:         &sb.SID,
		MID:         input.MID,
		Date:        time.Now(),
		Remarks:     &remarks,
	}

	if err := configs.DB().Create(&adj).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create adjustment record"})
		return
	}

	c.JSON(http.StatusCreated, adj)
}

func GetAdjustments(c *gin.Context) {
	type AdjRow struct {
		AID         uint      `json:"AID"`
		OldScore    int       `json:"OldScore"`
		NewScore    int       `json:"NewScore"`
		Date        time.Time `json:"Date"`
		Remarks     *string   `json:"Remarks"`
		Prisoner_ID uint      `json:"Prisoner_ID"`
		Inmate_ID   string    `json:"Inmate_ID"`
		MemberFirst *string   `json:"MemberFirst"`
		MemberLast  *string   `json:"MemberLast"`
	}
	var rows []AdjRow
	err := configs.DB().Raw(`
    SELECT 
      a.a_id AS AID,
      a.old_score AS OldScore,
      a.new_score AS NewScore,
      a.date AS Date,
      a.remarks AS Remarks,
      a.prisoner_id AS Prisoner_ID,
      p.inmate_id AS Inmate_ID,
      m.first_name AS MemberFirst,
      m.last_name AS MemberLast
    FROM adjustments a
    LEFT JOIN prisoners p ON p.prisoner_id = a.prisoner_id
    LEFT JOIN members m   ON m.m_id = a.m_id
    ORDER BY a.date DESC, a.a_id DESC
  `).Scan(&rows).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch adjustments: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, rows)
}
