package entity

type Type struct {
	Type_ID uint   `gorm:"primaryKey" json:"Type_ID"`
	Type    string `gorm:"not null"` // เช่น "วัสดุ", "อุปกรณ์"
}
