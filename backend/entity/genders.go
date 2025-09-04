package entity

type Gender struct {
	Gender_ID uint        `gorm:"primaryKey"`
	Gender    string     `gorm:"not null"`             // เช่น "ชาย", "หญิง"
	Prisoners []Prisoner `gorm:"foreignKey:Gender_ID"` // เชื่อมกับตาราง Prisoner
	Staff     []Staff    `gorm:"foreignKey:Gender_ID"` // เชื่อมกับตาราง Staff
}
