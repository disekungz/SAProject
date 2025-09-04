package controller

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/sa-project/configs"
    "github.com/sa-project/entity"
)
func GetVisitors(c *gin.Context) {
    var items []entity.Visitor
    configs.DB().Find(&items)
    c.JSON(http.StatusOK, items)
}