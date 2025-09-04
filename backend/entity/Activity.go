package entity

type Activity struct {
	// --- เพิ่ม json tags ทั้งหมด ---
	Activity_ID  uint   `gorm:"primaryKey" json:"activity_ID"`
	ActivityName string `json:"activityName"`
	Description  string `json:"description"`
	Location     string `json:"location"`

	ActivitySchedule []ActivitySchedule `gorm:"foreignKey:Activity_ID" json:"activitySchedule"`
}
