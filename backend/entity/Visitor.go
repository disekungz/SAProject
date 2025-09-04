package entity

import (
	"time"

	"gorm.io/gorm"
)

type Visitor struct {
	gorm.Model
	Citizen_ID string `gorm:"unique"` // Ensure Citizen ID is unique
	FirstName  string
	LastName   string
	Birthday   time.Time
	Age        int
	Email      string

	Relationship_ID *uint
	Relationship    Relationship `gorm:"references:ID"`

	Visitations []Visitation `gorm:"foreignKey:Visitor_ID"`
}

