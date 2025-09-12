package entity

import "time"

type Adjustment struct {
	AID      int       `gorm:"column:a_id;primaryKey" json:"Adjustment_ID"`
	OldScore int       `gorm:"column:old_score;not null" json:"OldScore"`
	NewScore int       `gorm:"column:new_score;not null" json:"NewScore"`
	Date     time.Time `gorm:"column:date;not null" json:"Date"`
	Remarks  *string   `gorm:"column:remarks;type:text" json:"Remarks"`

	// FK -> ScoreBehavior
	SID           *uint         `gorm:"column:sid"`
	ScoreBehavior ScoreBehavior `gorm:"foreignKey:SID;references:SID" json:"ScoreBehavior"`

	// FK -> Prisoner
	Prisoner_ID uint     `gorm:"column:prisoner_id;not null" json:"Prisoner_ID"`
	Prisoner    Prisoner `gorm:"foreignKey:Prisoner_ID;references:Prisoner_ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"Prisoner"`

	// FK -> Member (สำคัญ: column ต้องเป็น m_id)
	MID    *int   `gorm:"column:m_id" json:"MID"`
	Member Member `gorm:"foreignKey:MID;references:MID" json:"Member"`
}

// ถ้าชื่อตารางเป็น "adjustments" อยู่แล้ว ไม่ต้องใส่ก็ได้
// func (Adjustment) TableName() string { return "adjustments" }
