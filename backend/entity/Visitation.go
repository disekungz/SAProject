package entity

import (
	"time"

	"gorm.io/gorm"
)

type Visitation struct {
	gorm.Model
	Visit_Date       time.Time
	Visit_Time_Start string
	Visit_Time_End   string

	Staff_ID *uint
	Staff    Staff `gorm:"foreignKey:Staff_ID"`

	Status_ID *uint
	Status    Status `gorm:"foreignKey:Status_ID"`

	Relationship_ID *uint
	Relationship    Relationship `gorm:"foreignKey:Relationship_ID"`

	Visitor_ID *uint
	Visitor    Visitor `gorm:"foreignKey:Visitor_ID"`

	Inmate_ID *uint
	Inmate    Prisoner `gorm:"foreignKey:Inmate_ID"`

	TimeSlot_ID *uint
	TimeSlot    TimeSlot `gorm:"references:ID"`
}
