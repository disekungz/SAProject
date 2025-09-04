package entity

type Room struct {
	Room_ID        uint   `gorm:"primaryKey" json:"Room_ID"`
	Room_Name      string `json:"Room_Name"`
	Room_Status string `json:"Room_Status"`

	// 1 RoomID มี Medical ได้หลาย
	Prisoner []Prisoner `gorm:"foreignKey:Room_ID"`
}
