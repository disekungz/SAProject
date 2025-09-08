package entity

import "time"

type Enrollment struct {
	// --- เพิ่ม json tags ---
	Enrollment_ID uint      `gorm:"primaryKey" json:"enrollment_ID"`
	EnrollDate    time.Time `json:"enrollDate"`
	Status        int       `json:"status"`
	Remarks       string    `json:"remarks"`

	// --- แก้ไข 2 บรรทัดนี้ ---
	Schedule_ID      uint              `json:"schedule_ID"`
	ActivitySchedule *ActivitySchedule `gorm:"foreignKey:Schedule_ID;references:Schedule_ID" json:"activitySchedule"`

	// --- แก้ไข 2 บรรทัดนี้ ---
	Prisoner_ID uint      `json:"prisoner_ID"`
	Prisoner    *Prisoner `gorm:"foreignKey:Prisoner_ID;references:Prisoner_ID" json:"prisoner"`
}
