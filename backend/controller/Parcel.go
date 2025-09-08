package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

// ดึง mid จาก context (มาจาก JWT ที่ middleware ใส่ให้)
// รองรับได้หลายชนิด; ถ้าไม่มี auth ให้ fallback เป็น 1 (เหมือนเดิมที่ฮาร์ดโค้ดไว้)
func midFromContextInt(c *gin.Context) int {
	if v, ok := c.Get("mid"); ok {
		switch t := v.(type) {
		case int:
			return t
		case uint:
			return int(t)
		case int64:
			return int(t)
		case uint64:
			return int(t)
		case float64:
			return int(t)
		}
	}
	return 1
}

func GetParcels(c *gin.Context) {
	var parcels []entity.Parcel
	if err := configs.DB().Find(&parcels).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch parcels"})
		return
	}
	c.JSON(http.StatusOK, parcels)
}

func CreateParcel(c *gin.Context) {
	var input struct {
		ParcelName string `json:"parcelName"`
		Quantity   int    `json:"quantity"`
		Type_ID    uint   `json:"type_ID"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existing entity.Parcel
	if err := configs.DB().Where("parcel_name = ?", input.ParcelName).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Parcel already exists"})
		return
	}

	parcel := entity.Parcel{
		ParcelName: input.ParcelName,
		Quantity:   input.Quantity,
		Type_ID:    input.Type_ID,
		Status:     calculateStatus(input.Quantity),
	}
	if err := configs.DB().Create(&parcel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Create parcel failed"})
		return
	}

	// Log: เพิ่มใหม่ (OperatorID=4)
	mid := midFromContextInt(c)
	_ = configs.DB().Create(&entity.Operation{
		DateTime:     time.Now(),
		PID:          parcel.PID,
		OldQuantity:  0,
		NewQuantity:  parcel.Quantity,
		ChangeAmount: parcel.Quantity,
		OperatorID:   4,
		MID:          mid, // ← ใช้ MID จาก JWT
	}).Error

	c.JSON(http.StatusCreated, parcel)
}

func UpdateParcel(c *gin.Context) {
	id, err := atoiParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var parcel entity.Parcel
	if err := configs.DB().First(&parcel, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parcel not found"})
		return
	}

	var input struct {
		ParcelName string `json:"parcelName"`
		Quantity   int    `json:"quantity"`
		Type_ID    uint   `json:"type_ID"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	oldQty := parcel.Quantity
	oldName := parcel.ParcelName
	oldType := parcel.Type_ID

	parcel.ParcelName = input.ParcelName
	parcel.Quantity = input.Quantity
	parcel.Type_ID = input.Type_ID
	parcel.Status = calculateStatus(input.Quantity)

	if err := configs.DB().Save(&parcel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Save failed"})
		return
	}

	// Log: แก้ไข (OperatorID=3)
	mid := midFromContextInt(c)
	_ = configs.DB().Create(&entity.Operation{
		DateTime:      time.Now(),
		PID:           parcel.PID,
		OldQuantity:   oldQty,
		NewQuantity:   parcel.Quantity,
		ChangeAmount:  input.Quantity - oldQty,
		OperatorID:    3,
		MID:           mid, // ← ใช้ MID จาก JWT
		OldParcelName: oldName,
		NewParcelName: parcel.ParcelName,
		OldTypeID:     ptrInt(int(oldType)),
		NewTypeID:     ptrInt(int(parcel.Type_ID)),
	}).Error

	c.JSON(http.StatusOK, parcel)
}

func AddParcel(c *gin.Context) {
	id, err := atoiParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var parcel entity.Parcel
	if err := configs.DB().First(&parcel, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parcel not found"})
		return
	}

	var body struct {
		Amount int `json:"amount"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "amount must be > 0"})
		return
	}

	oldQty := parcel.Quantity
	parcel.Quantity += body.Amount
	parcel.Status = calculateStatus(parcel.Quantity)
	if err := configs.DB().Save(&parcel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Save failed"})
		return
	}

	// Log: เพิ่ม (OperatorID=1)
	mid := midFromContextInt(c)
	_ = configs.DB().Create(&entity.Operation{
		DateTime:     time.Now(),
		PID:          parcel.PID,
		OldQuantity:  oldQty,
		NewQuantity:  parcel.Quantity,
		ChangeAmount: body.Amount,
		OperatorID:   1,
		MID:          mid, // ← ใช้ MID จาก JWT
	}).Error

	c.JSON(http.StatusOK, parcel)
}

func ReduceParcel(c *gin.Context) {
	id, err := atoiParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var parcel entity.Parcel
	if err := configs.DB().First(&parcel, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Parcel not found"})
		return
	}

	var body struct {
		Amount int `json:"amount"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "amount must be > 0"})
		return
	}

	oldQty := parcel.Quantity
	if body.Amount > parcel.Quantity {
		parcel.Quantity = 0
	} else {
		parcel.Quantity -= body.Amount
	}
	parcel.Status = calculateStatus(parcel.Quantity)
	if err := configs.DB().Save(&parcel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Save failed"})
		return
	}

	// Log: เบิก (OperatorID=2)
	mid := midFromContextInt(c)
	_ = configs.DB().Create(&entity.Operation{
		DateTime:     time.Now(),
		PID:          parcel.PID,
		OldQuantity:  oldQty,
		NewQuantity:  parcel.Quantity,
		ChangeAmount: -body.Amount,
		OperatorID:   2,
		MID:          mid, // ← ใช้ MID จาก JWT
	}).Error

	c.JSON(http.StatusOK, parcel)
}

func calculateStatus(qty int) string {
	if qty == 0 {
		return "หมดแล้ว"
	} else if qty <= 20 {
		return "ใกล้หมด"
	}
	return "คงเหลือ"
}

func ptrInt(i int) *int { return &i }

func atoiParam(s string) (int, error) {
	return strconv.Atoi(s)
}
