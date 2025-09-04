package entity

import (
	"time"
	"gorm.io/gorm"
)

type Petition struct {
	gorm.Model
	Detail       string
	Date_created time.Time

	Staff_ID *uint
	Staff    Staff `gorm:"foreignKey:Staff_ID"`

	Status_ID *uint
	Status    Status `gorm:"foreignKey:Status_ID"`

	Type_cum_ID *uint // แก้ไขชื่อฟิลด์
	Type    Type_cum `gorm:"foreignKey:Type_cum_ID"` // แก้ไข foreignKey ให้ตรงกับฟิลด์ที่ถูกต้อง

	Inmate_ID *uint
	Inmate    Prisoner `gorm:"foreignKey:Inmate_ID"`
}