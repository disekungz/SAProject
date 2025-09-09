package entity

import (
	"time"
)

type Medical_History struct {
	MedicalID        int        `gorm:"primaryKey"`
	Initial_symptoms string     // อาการเบื้องต้น
	Medicine         int        // ยาที่ใช้
	MedicineAmount   int        // จำนวนยา
	Doctor           string     // แพทย์ผู้ตรวจ
	Diagnosis        string     // การวินิจฉัย
	Date_Inspection  time.Time  // วันที่ตรวจ
	Next_appointment *time.Time `json:"Next_appointment"` // นัดครั้งต่อไป

	// StaffID ทำหน้าที่เป็น FK
	StaffID *uint
	Staff   Staff `gorm:"foreignKey:StaffID"`

	// Personer_ID ทำหน้าที่เป็น FK
	Prisoner_ID *uint
	Prisoner    Prisoner `gorm:"foreignKey:Prisoner_ID"`
}
