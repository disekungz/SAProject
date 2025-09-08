package controller

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

func GetMember(c *gin.Context) {
	var members []entity.Member
	if err := configs.DB().
		Preload("Rank").
		Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch members"})
		return
	}
	c.JSON(http.StatusOK, members)
}

type rankInput struct {
	RankID int `json:"rankId" binding:"required"`
}

// PUT /api/members/:id/rank  { "rankId": 2 }
func UpdateMemberRank(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid member id"})
		return
	}
	var in rankInput
	if err := c.ShouldBindJSON(&in); err != nil || in.RankID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rankId"})
		return
	}

	db := configs.DB()
	var m entity.Member
	if err := db.First(&m, "m_id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		return
	}

	if err := db.Model(&m).Update("rank_id", in.RankID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update rank"})
		return
	}

	db.Preload("Rank").First(&m, "m_id = ?", id)
	c.JSON(http.StatusOK, m)
}

// PATCH /api/members/:id  { "rankId": 3 }  // เผื่อฟรอนต์เรียกแบบนี้
func UpdateMember(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid member id"})
		return
	}
	var in struct {
		RankID *int `json:"rankId"`
		// อนาคตอยากแก้ฟิลด์อื่นเพิ่มได้
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	db := configs.DB()
	var m entity.Member
	if err := db.First(&m, "m_id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		return
	}

	updates := map[string]any{}
	if in.RankID != nil {
		updates["rank_id"] = *in.RankID
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no updatable fields"})
		return
	}

	if err := db.Model(&m).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update member"})
		return
	}
	db.Preload("Rank").First(&m, "m_id = ?", id)
	c.JSON(http.StatusOK, m)
}

// DELETE /api/member/:id
func DeleteMemberById(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid member id"})
		return
	}
	tx := configs.DB().Exec("DELETE FROM members WHERE m_id = ?", id)
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete member"})
		return
	}
	if tx.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "id not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted successful"})
}
