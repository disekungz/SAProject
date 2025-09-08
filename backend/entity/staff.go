package entity

import (
	"time"
)

type Staff struct {
	StaffID   uint      `gorm:"primaryKey"` // เปลี่ยนเป็น uint
	Email     string    `gorm:"unique"`
	FirstName string    `gorm:"not null"`
	LastName  string    `gorm:"not null"`
	Birthday  time.Time `gorm:"type:date;not null"`
	Status    string    `gorm:"not null"`
	Address   string

	Gender_ID *uint  `gorm:"not null"` // เปลี่ยนเป็น *uint
	Gender    Gender `gorm:"foreignKey:Gender_ID"`

	Requestings []Requesting `gorm:"foreignKey:StaffID"`
}
