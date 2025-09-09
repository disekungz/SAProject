package entity

import "time"

type ActivitySchedule struct {
	Schedule_ID uint      `gorm:"primaryKey" json:"schedule_ID"`
	StartDate   time.Time `json:"StartDate"`
	EndDate     time.Time `json:"EndDate"`
	StartTime   string    `gorm:"type:TIME" json:"StartTime"`
	EndTime     string    `gorm:"type:TIME" json:"EndTime"`
	Max         int       `json:"max"`

	//MID    uint    `json:"mId"`
	//Member *Member `gorm:"foreignKey:MID;references:MID" json:"member"`

	StaffID *uint  `json:"staffId"`
	Staff   *Staff `gorm:"foreignKey:StaffID;references:StaffID" json:"staff"`

	Activity_ID uint      `json:"activity_ID"`
	Activity    *Activity `gorm:"foreignKey:Activity_ID;references:Activity_ID" json:"activity"`

	Enrollment []Enrollment `gorm:"foreignKey:Schedule_ID" json:"enrollment"`
}
