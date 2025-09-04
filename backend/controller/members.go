package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

// GET /members
func FindMembers(c *gin.Context) {
	var members []entity.Member
	if err := configs.DB().Raw("SELECT * FROM members").Find(&members).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, members)
}

// GET /member/:id
func FindMemberById(c *gin.Context) {
	var member entity.Member
	//
	id := c.Param("id")
	if tx := configs.DB().Preload("Histories").Preload("Histories.Sound").Where("id = ?", id).First(&member); tx.RowsAffected == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, member)
}

// DELETE /member/:id
func DeleteMemberById(c *gin.Context) {
	id := c.Param("id")
	if tx := configs.DB().Exec("DELETE FROM members WHERE id = ?", id); tx.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "id not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted succesful"})
}
