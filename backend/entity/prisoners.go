package entity

import (
	"time"
)

type Prisoner struct {
	Prisoner_ID uint       `gorm:"primaryKey" json:"Prisoner_ID"`
	Inmate_ID   string     `gorm:"type:varchar(10);unique" json:"Inmate_ID"`
	Citizen_ID  string     `gorm:"type:varchar(13)" json:"Citizen_ID"`
	FirstName   string     `gorm:"type:varchar(100)" json:"FirstName"`
	LastName    string     `gorm:"type:varchar(100)" json:"LastName"`
	Birthday    time.Time  `gorm:"type:date" json:"Birthday"`
	Case_ID     string     `gorm:"type:varchar(50)" json:"Case_ID"`
	EntryDate   time.Time  `gorm:"type:date" json:"EntryDate"`
	ReleaseDate *time.Time `gorm:"type:date" json:"ReleaseDate"`

	Room_ID   *uint  `json:"Room_ID"`
	Room      Room   `gorm:"foreignKey:Room_ID"`
	Work_ID   *uint  `json:"Work_ID"`
	Work      Work   `gorm:"foreignKey:Work_ID"`
	Gender_ID *uint  `json:"Gender_ID"`
	Gender    Gender `gorm:"foreignKey:Gender_ID"`

	ScoreBehavior   ScoreBehavior     `gorm:"foreignKey:Prisoner_ID;references:Prisoner_ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Medical_History []Medical_History `gorm:"foreignKey:Prisoner_ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Enrollment      []Enrollment      `gorm:"foreignKey:Prisoner_ID" json:"enrollment"`
}
