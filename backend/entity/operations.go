package entity

import (
	"time"
)

type Operation struct {
	OPID         int       `gorm:"primaryKey;not null"`
	DateTime     time.Time `gorm:"not null"`
	PID          int       `gorm:"not null"`
	OldQuantity  int       `gorm:"not null"`
	NewQuantity  int       `gorm:"not null"`
	ChangeAmount int       `gorm:"not null"`
	OperatorID   int       `gorm:"not null"`
	MID          int       `gorm:"not null"`

	OldParcelName string `gorm:"type:varchar(255);default:null"`
	NewParcelName string `gorm:"type:varchar(255);default:null"`
	OldTypeID     *int   `gorm:"default:null"`
	NewTypeID     *int   `gorm:"default:null"`

	Parcel   Parcel   `gorm:"foreignKey:PID;references:PID"`
	Operator Operator `gorm:"foreignKey:OperatorID"`
	Member   Member   `gorm:"foreignKey:MID;references:MID"`
}
