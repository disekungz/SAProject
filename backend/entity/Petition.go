package entity

import (
	"time"

	"gorm.io/gorm"
)

// Petition defines the structure for the petitions table
type Petition struct {
	gorm.Model
	Detail       string
	Date_created time.Time

	Inmate_ID *uint
	Inmate    Prisoner `gorm:"foreignKey:Inmate_ID"`

	Staff_ID *uint
	Staff    Staff `gorm:"foreignKey:Staff_ID"`

	Status_ID *uint
	Status    Status `gorm:"foreignKey:Status_ID"`

	Type_cum_ID *uint
	Type        PetitionTypeCum `gorm:"foreignKey:Type_cum_ID"`
}

// PetitionTypeCum defines the structure for petition types
type PetitionTypeCum struct {
	gorm.Model
	Type_cum_name string
}

