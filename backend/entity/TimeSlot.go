package entity

import "gorm.io/gorm"

type TimeSlot struct {
	gorm.Model
	TimeSlot_Name string
	Start_Time    string
	End_Time      string

	// --- Relationship ---
	// บอก GORM ว่า TimeSlot หนึ่งอัน มี Visitation ได้หลายอัน
	// โดยใช้ TimeSlot_ID เป็น Foreign Key
	Visitation []Visitation `gorm:"foreignKey:TimeSlot_ID"`
}

