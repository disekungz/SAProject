package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/entity"
)

type MedicalHistoryInput struct {
	Initial_symptoms *string `json:"Initial_symptoms"`
	Medicine         *int    `json:"Medicine"`
	MedicineAmount   *int    `json:"MedicineAmount"`
	Doctor           *string `json:"Doctor"`
	Diagnosis        *string `json:"Diagnosis"`

	// frontend ส่งจาก DatePicker.toISOString()
	Date_Inspection  *string `json:"Date_Inspection"`  // ISO-8601 string
	Next_appointment *string `json:"Next_appointment"` // ISO-8601 string หรือ null

	StaffID     *uint `json:"StaffID"`
	Prisoner_ID *uint `json:"Prisoner_ID"`
}

// parseISODate รองรับทั้ง RFC3339 (toISOString) และ "2006-01-02"
func parseISODate(s string) (time.Time, error) {
	// primary: RFC3339 (เช่น "2025-09-09T12:34:56.789Z")
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	// fallback: "YYYY-MM-DD"
	return time.Parse("2006-01-02", s)
}

// parseISODatePtr แปลง pointer string -> *time.Time
func parseISODatePtr(s *string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	t, err := parseISODate(*s)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ===================== Handlers =====================

// GET /api/medical_histories
func GetMedicalHistories(c *gin.Context) {
	var items []entity.Medical_History
	if err := configs.DB().
		Preload("Prisoner").
		Preload("Staff").
		Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medical histories"})
		return
	}
	c.JSON(http.StatusOK, items)
}

// GET /api/medical_histories/:id
func GetMedicalHistory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var mh entity.Medical_History
	if err := configs.DB().
		Preload("Prisoner").
		Preload("Staff").
		First(&mh, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medical history not found"})
		return
	}
	c.JSON(http.StatusOK, mh)
}

// POST /api/medical_histories
func CreateMedicalHistory(c *gin.Context) {
	var in MedicalHistoryInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ตรวจ field จำเป็น (ตามที่หน้าเพิ่ม require อยู่)
	if in.Prisoner_ID == nil || in.StaffID == nil || in.Date_Inspection == nil ||
		in.Initial_symptoms == nil || in.Diagnosis == nil || in.Medicine == nil || in.MedicineAmount == nil || in.Doctor == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing required fields"})
		return
	}

	dateInspection, err := parseISODate(*in.Date_Inspection)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid Date_Inspection"})
		return
	}

	nextAppt, err := parseISODatePtr(in.Next_appointment)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid Next_appointment"})
		return
	}

	mh := entity.Medical_History{
		Initial_symptoms: *in.Initial_symptoms,
		Medicine:         *in.Medicine,
		MedicineAmount:   *in.MedicineAmount,
		Doctor:           *in.Doctor,
		Diagnosis:        *in.Diagnosis,
		Date_Inspection:  dateInspection,
		Next_appointment: nextAppt,
		StaffID:          in.StaffID,
		Prisoner_ID:      in.Prisoner_ID,
	}

	if err := configs.DB().Create(&mh).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create medical history"})
		return
	}

	// preload ความสัมพันธ์เพื่อให้ frontend ใช้ได้ทันที
	if err := configs.DB().
		Preload("Prisoner").
		Preload("Staff").
		First(&mh, mh.MedicalID).Error; err != nil {
		// ถ้าโหลดไม่สำเร็จ ส่ง object ที่สร้างไปก่อน
		c.JSON(http.StatusCreated, mh)
		return
	}

	c.JSON(http.StatusCreated, mh)
}

// PUT /api/medical_histories/:id  (partial update)
func UpdateMedicalHistory(c *gin.Context) {
	idStr := c.Param("id")
	id, convErr := strconv.ParseUint(idStr, 10, 64)
	if convErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var mh entity.Medical_History
	if err := configs.DB().First(&mh, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medical history not found"})
		return
	}

	var in MedicalHistoryInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// เซ็ตเฉพาะที่ส่งมา (หลีกเลี่ยง Updates(map) เพื่อไม่งงชื่อ column)
	if in.Initial_symptoms != nil {
		mh.Initial_symptoms = *in.Initial_symptoms
	}
	if in.Medicine != nil {
		mh.Medicine = *in.Medicine
	}
	if in.MedicineAmount != nil {
		mh.MedicineAmount = *in.MedicineAmount
	}
	if in.Doctor != nil {
		mh.Doctor = *in.Doctor
	}
	if in.Diagnosis != nil {
		mh.Diagnosis = *in.Diagnosis
	}
	if in.Date_Inspection != nil {
		t, err := parseISODate(*in.Date_Inspection)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid Date_Inspection"})
			return
		}
		mh.Date_Inspection = t
	}
	if in.Next_appointment != nil {
		tp, err := parseISODatePtr(in.Next_appointment)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid Next_appointment"})
			return
		}
		mh.Next_appointment = tp // อนุญาตให้ตั้งเป็น nil ได้
	}
	if in.StaffID != nil {
		mh.StaffID = in.StaffID
	}
	if in.Prisoner_ID != nil {
		mh.Prisoner_ID = in.Prisoner_ID
	}

	if err := configs.DB().Save(&mh).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update medical history"})
		return
	}

	// preload ให้เหมือนเดิม
	if err := configs.DB().
		Preload("Prisoner").
		Preload("Staff").
		First(&mh, id).Error; err != nil {
		c.JSON(http.StatusOK, mh)
		return
	}

	c.JSON(http.StatusOK, mh)
}

// DELETE /api/medical_histories/:id
func DeleteMedicalHistory(c *gin.Context) {
	idStr := c.Param("id")
	id, convErr := strconv.ParseUint(idStr, 10, 64)
	if convErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := configs.DB().Delete(&entity.Medical_History{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete medical history"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Medical history deleted successfully"})
}
