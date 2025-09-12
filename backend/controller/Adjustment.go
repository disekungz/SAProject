// controller/adjustment.go (หรือไฟล์ที่มี CreateAdjustment)
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

// แก้ให้คืน *int แทน *uint และรองรับชนิดที่ middleware อาจยัดเข้ามา
func midFromContext(c *gin.Context) *int {
	if v, ok := c.Get("mid"); ok {
		switch x := v.(type) {
		case int:
			return &x
		case int32:
			i := int(x)
			return &i
		case int64:
			i := int(x)
			return &i
		case uint:
			i := int(x)
			return &i
		case uint32:
			i := int(x)
			return &i
		case uint64:
			i := int(x)
			return &i
		case float64:
			i := int(x)
			return &i
		}
	}
	return nil
}

func CreateAdjustment(c *gin.Context) {
	var input struct {
		Prisoner_ID uint   `json:"prisoner_id"`
		Inmate_ID   string `json:"inmate_id"` // optional
		OldScore    int    `json:"oldScore"`  // ignored
		NewScore    int    `json:"newScore"`
		MID         *int   `json:"mid"` // เปลี่ยนเป็น *int ให้ตรง entity
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

	// verify prisoner
	var prisoner entity.Prisoner
	if err := db.First(&prisoner, input.Prisoner_ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "prisoner not found"})
		return
	}

	// mid: payload > context
	mid := input.MID
	if mid == nil {
		mid = midFromContext(c)
	}
	// debug ช่วยไล่ปัญหา
	fmt.Printf("DEBUG CreateAdjustment mid payload=%v ctx=%v\n", input.MID, midFromContext(c))

	err := db.Transaction(func(tx *gorm.DB) error {
		var sb entity.ScoreBehavior
		res := tx.Where("prisoner_id = ?", input.Prisoner_ID).First(&sb)

		var oldScore int
		if res.Error != nil {
			if res.Error == gorm.ErrRecordNotFound {
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
			oldScore = sb.Score
			sb.Score = input.NewScore
			if err := tx.Save(&sb).Error; err != nil {
				return err
			}
		}

		var remarksPtr *string
		if input.Remarks != "" {
			r := input.Remarks
			remarksPtr = &r
		}

		adj := entity.Adjustment{
			OldScore:    oldScore,
			NewScore:    input.NewScore,
			Prisoner_ID: input.Prisoner_ID,
			SID:         &sb.SID,
			MID:         mid, // << ตรง type/column แล้ว
			Date:        time.Now(),
			Remarks:     remarksPtr,
		}
		if err := tx.Create(&adj).Error; err != nil {
			return err
		}
		c.Set("adj_result", adj)
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create adjustment: " + err.Error()})
		return
	}

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
		AID         int       `json:"AID"`
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
