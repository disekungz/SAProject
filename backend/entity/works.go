package entity

type Work struct {
	Work_ID   int `gorm:"primaryKey" json:"Work_ID"`
	Work_Name string

	// 1 WorkID มี Medical ได้หลาย
	Prisoner []Prisoner `gorm:"foreignKey:Work_ID"`
}
