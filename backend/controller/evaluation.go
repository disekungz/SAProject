package controller

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
	"gorm.io/gorm"
)

type evaluationInput struct {
	Prisoner_ID    uint      `json:"prisonerId" binding:"required"`
	BID            uint      `json:"bId"        binding:"required"`
	MID            uint      `json:"mId"        binding:"required"`
	EvaluationDate time.Time `json:"evaluationDate" binding:"required"`
	Notes          string    `json:"notes"`
}

// GET /scores/:id   (id = Prisoner_ID)
func GetScoreByPrisoner(c *gin.Context) {
	db := configs.DB()

	id := c.Param("id")
	var scoreBehavior entity.ScoreBehavior
	if err := db.Where("prisoner_id = ?", id).
		Preload("Prisoner").
		First(&scoreBehavior).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลคะแนนสำหรับผู้ต้องขังรายนี้"})
		return
	}
	c.JSON(http.StatusOK, scoreBehavior)
}

// POST /evaluations
func CreateEvaluation(c *gin.Context) {
	db := configs.DB()

	var input evaluationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		// 1) หา ScoreBehavior จาก prisonerId
		var sb entity.ScoreBehavior
		if err := tx.Where("prisoner_id = ?", input.Prisoner_ID).First(&sb).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลคะแนนสำหรับผู้ต้องขังรายนี้"})
			return nil
		}

		// 2) ยืนยันว่ามี BehaviorCriterion (BID) และ Member (MID) จริง
		var bc entity.BehaviorCriterion
		if err := tx.First(&bc, input.BID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่พบเกณฑ์พฤติกรรม (BID) นี้"})
			return nil
		}
		var m entity.Member
		if err := tx.First(&m, input.MID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่พบผู้ประเมิน (MID) นี้"})
			return nil
		}

		// 3) บันทึก Evaluation
		ev := entity.BehaviorEvaluation{
			SID:            sb.SID,
			BID:            input.BID,
			MID:            input.MID,
			EvaluationDate: input.EvaluationDate,
			Notes:          input.Notes,
		}
		if err := tx.Create(&ev).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return err
		}

		// 4) โหลดความสัมพันธ์เพื่อตอบกลับ
		if err := tx.
			Preload("ScoreBehavior.Prisoner").
			Preload("Member").
			Preload("BehaviorCriterion").
			First(&ev, ev.ID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return err
		}

		c.JSON(http.StatusCreated, ev)
		return nil
	})

	if err != nil {
		// error จาก Transaction (ถ้ามี)
		if _, ok := err.(*gin.Error); !ok {
			// ส่งรายละเอียดทั่วไป
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
	}
}

// PUT /evaluations/:id
func UpdateEvaluation(c *gin.Context) {
	db := configs.DB()
	id := c.Param("id")

	var input evaluationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		var ev entity.BehaviorEvaluation
		if err := tx.First(&ev, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบ Evaluation นี้"})
			return nil
		}

		// (ออปชันนัล) ยืนยันความถูกต้องของ BID, MID
		if err := tx.First(&entity.BehaviorCriterion{}, input.BID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่พบเกณฑ์พฤติกรรม (BID) นี้"})
			return nil
		}
		if err := tx.First(&entity.Member{}, input.MID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่พบผู้ประเมิน (MID) นี้"})
			return nil
		}

		// ถ้าผู้ใช้ส่ง prisonerId มา หมายถึงต้องการเปลี่ยนผูกกับ ScoreBehavior ของผู้ต้องขังอื่น
		if input.Prisoner_ID != 0 {
			var sb entity.ScoreBehavior
			if err := tx.Where("prisoner_id = ?", input.Prisoner_ID).First(&sb).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่พบ ScoreBehavior ของผู้ต้องขังที่ระบุ"})
				return nil
			}
			ev.SID = sb.SID
		}

		ev.BID = input.BID
		ev.MID = input.MID
		ev.Notes = input.Notes
		ev.EvaluationDate = input.EvaluationDate

		if err := tx.Save(&ev).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return err
		}

		if err := tx.
			Preload("ScoreBehavior.Prisoner").
			Preload("Member").
			Preload("BehaviorCriterion").
			First(&ev, id).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return err
		}

		c.JSON(http.StatusOK, ev)
		return nil
	})

	if err != nil {
		if _, ok := err.(*gin.Error); !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
	}
}

// GET /evaluations
func GetEvaluations(c *gin.Context) {
	db := configs.DB()

	var evaluations []entity.BehaviorEvaluation
	if err := db.
		Preload("ScoreBehavior.Prisoner").
		Preload("Member").
		Preload("BehaviorCriterion").
		Order("id ASC").
		Find(&evaluations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, evaluations)
}

// DELETE /evaluations/:id
func DeleteEvaluation(c *gin.Context) {
	db := configs.DB()
	id := c.Param("id")

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&entity.BehaviorEvaluation{}, id).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return err
		}
		return nil
	}); err != nil {
		// ถ้า transaction ล้มเหลว
		if _, ok := err.(*gin.Error); !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Evaluation deleted"})
}
