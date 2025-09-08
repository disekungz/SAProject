package entity

import (
	"time"
)

type Requesting struct {
	Requesting_ID uint   `gorm:"primaryKey"`
	Requesting_NO string `gorm:"unique;not null"`

	PID *uint `gorm:"not null"`
	// แก้ไข: เอา references ออก ให้ GORM จัดการเชื่อมกับ Primary Key ของ Item เอง
	Parcel Parcel `gorm:"foreignKey:PID"`

	Amount_Request uint      `gorm:"not null"`
	Request_Date   time.Time `gorm:"type:date;not null"`

	StaffID *uint `gorm:"not null"`
	// แก้ไข: เอา references ออก ให้ GORM จัดการเชื่อมกับ Primary Key ของ Staff เอง
	Staff *Staff `gorm:"foreignKey:StaffID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`

	Status_ID *uint `gorm:"not null"`
	// แก้ไข: เอา references ออก ให้ GORM จัดการเชื่อมกับ Primary Key ของ Status เอง
	Status Status `gorm:"foreignKey:Status_ID"`
}
