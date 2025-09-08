package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
	"gorm.io/gorm"
)

// helper: ดึง mid จาก context (มาจาก middleware.AuthOptional)
func midFromContext(c *gin.Context) *uint {
	if v, ok := c.Get("mid"); ok {
		if vv, ok2 := v.(uint); ok2 {
			return &vv
		}
		// บางเคส jwt lib คืน float64
		if f, ok2 := v.(float64); ok2 {
			u := uint(f)
			return &u
		}
	}
	return nil
}

// --- Adjustment (log การแก้ไขคะแนน) ---
func CreateAdjustment(c *gin.Context) {
	var input struct {
		Prisoner_ID uint   `json:"prisoner_id"`
		Inmate_ID   string `json:"inmate_id"` // optional: เพื่อความสะดวก frontend
		OldScore    int    `json:"oldScore"`  // จะไม่ใช้ค่านี้ (คำนวณจากฐานข้อมูลแทน)
		NewScore    int    `json:"newScore"`
		MID         *uint  `json:"mid"` // optional: ถ้าไม่ส่ง จะ fallback จาก context
		Remarks     string `json:"remarks"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Prisoner_ID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid prisoner id"})
		return
	}

	db := configs.DB()

	// ตรวจว่ามี prisoner จริงไหม
	var prisoner entity.Prisoner
	if err := db.First(&prisoner, input.Prisoner_ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "prisoner not found"})
		return
	}

	// เลือก mid: ถ้า client ไม่ส่งมา → อ่านจาก context
	mid := input.MID
	if mid == nil {
		mid = midFromContext(c)
	}

	// ทำงานแบบ atomic
	err := db.Transaction(func(tx *gorm.DB) error {
		// หา/สร้าง score behavior
		var sb entity.ScoreBehavior
		res := tx.Where("prisoner_id = ?", input.Prisoner_ID).First(&sb)

		var oldScore int
		if res.Error != nil {
			if res.Error == gorm.ErrRecordNotFound {
				// ยังไม่มี → old=0 แล้วสร้างใหม่ด้วยคะแนนใหม่
				oldScore = 0
				sb = entity.ScoreBehavior{
					Prisoner_ID: input.Prisoner_ID,
					Score:       input.NewScore,
				}
				if err := tx.Create(&sb).Error; err != nil {
					return err
				}
			} else {
				return res.Error
			}
		} else {
			// มีแล้ว → จด oldScore และอัปเดตเป็น NewScore
			oldScore = sb.Score
			sb.Score = input.NewScore
			if err := tx.Save(&sb).Error; err != nil {
				return err
			}
		}

		// บันทึก adjustment (remarks อนุญาตให้ว่าง)
		var remarksPtr *string
		if input.Remarks != "" {
			r := input.Remarks
			remarksPtr = &r
		}

		adj := entity.Adjustment{
			OldScore:    oldScore, // ใช้ค่าจากฐานข้อมูล
			NewScore:    input.NewScore,
			Prisoner_ID: input.Prisoner_ID,
			SID:         &sb.SID,
			MID:         mid, // อาจเป็น nil ได้ ถ้าไม่มีทั้ง payload และ context
			Date:        time.Now(),
			Remarks:     remarksPtr,
		}
		if err := tx.Create(&adj).Error; err != nil {
			return err
		}

		// ส่งผลลัพธ์กลับผ่าน context (ใช้หลัง Transaction)
		c.Set("adj_result", adj)
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create adjustment: " + err.Error()})
		return
	}

	// อ่านผลที่ set ไว้ตอน transaction
	if v, ok := c.Get("adj_result"); ok {
		if adj, ok2 := v.(entity.Adjustment); ok2 {
			c.JSON(http.StatusCreated, adj)
			return
		}
	}
	c.JSON(http.StatusCreated, gin.H{"status": "ok"})
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
			a.a_id        AS AID,
			a.old_score   AS OldScore,
			a.new_score   AS NewScore,
			a.date        AS Date,
			a.remarks     AS Remarks,
			a.prisoner_id AS Prisoner_ID,
			p.inmate_id   AS Inmate_ID,
			m.first_name  AS MemberFirst,
			m.last_name   AS MemberLast
		FROM adjustments a
		LEFT JOIN prisoners p ON p.prisoner_id = a.prisoner_id
		LEFT JOIN members   m ON m.m_id       = a.m_id
		ORDER BY a.date DESC, a.a_id DESC
	`).Scan(&rows).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch adjustments: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, rows)
}
