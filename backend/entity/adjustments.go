package entity

import (
	"time"
)

type Adjustment struct {
	AID      int       `gorm:"primaryKey" json:"Adjustment_ID"`
	OldScore int       `gorm:"not null" json:"OldScore"` // เปลี่ยนเป็น OldScore
	NewScore int       `gorm:"not null" json:"NewScore"` // เปลี่ยนเป็น NewScore
	Date     time.Time `gorm:"not null" json:"Date"`
	Remarks  *string   `gorm:"type:text" json:"Remarks"`

	// SID ทำหน้าที่เป็น FK ไปยัง ScoreBehavior
	SID           *uint
	ScoreBehavior ScoreBehavior `gorm:"foreignKey:SID" json:"ScoreBehavior"`

	// Prisoner_ID ทำหน้าที่เป็น FK ไปยัง Prisoner
	Prisoner_ID uint     `json:"Prisoner_ID"`
	Prisoner    Prisoner `gorm:"foreignKey:Prisoner_ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"Prisoner"`

	// MID ทำหน้าที่เป็น FK ไปยัง Member
	MID    *uint  `json:"MID"`
	Member Member `gorm:"foreignKey:MID;references:MID" json:"Member"`
}
