package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity" // <- ต้องมี (ใช้ใน UpdateScoreBehavior)
)

type ScoreBehaviorWithPrisoner struct {
	SID         *uint  `json:"SID"`         // อาจว่างถ้ายังไม่เคยมีแถวใน score_behaviors
	Prisoner_ID uint   `json:"Prisoner_ID"` // ลำดับ (PK)
	Inmate_ID   string `json:"Inmate_ID"`   // รหัสนักโทษ
	Score       int    `json:"Score"`       // ถ้าไม่มีให้ 0
	Citizen_ID  string `json:"Citizen_ID"`
	FirstName   string `json:"FirstName"`
	LastName    string `json:"LastName"`
}

func GetScoreBehaviors(c *gin.Context) {
	var results []ScoreBehaviorWithPrisoner

	err := configs.DB().Raw(`
		SELECT
			sb.s_id                     AS SID,
			p.prisoner_id               AS Prisoner_ID,
			p.inmate_id                 AS Inmate_ID,
			COALESCE(sb.score, 0)       AS Score,
			COALESCE(p.citizen_id, '')  AS Citizen_ID,
			COALESCE(p.first_name, '')  AS FirstName,
			COALESCE(p.last_name, '')   AS LastName
		FROM prisoners p
		LEFT JOIN score_behaviors sb ON sb.prisoner_id = p.prisoner_id
		-- ถ้าต้องซ่อนผู้พ้นโทษ: WHERE p.release_date IS NULL
		ORDER BY p.prisoner_id ASC, sb.s_id ASC
	`).Scan(&results).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch score behaviors: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, results)
}

func UpdateScoreBehavior(c *gin.Context) {
	id := c.Param("id")

	var scoreBehavior entity.ScoreBehavior
	if err := configs.DB().First(&scoreBehavior, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Score behavior not found"})
		return
	}

	var input struct {
		Score int `json:"score"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	scoreBehavior.Score = input.Score
	if err := configs.DB().Save(&scoreBehavior).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update score"})
		return
	}

	c.JSON(http.StatusOK, scoreBehavior)
}
