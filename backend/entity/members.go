package entity

import "time"

type Member struct {
	MID       int       `gorm:"column:m_id;primaryKey" json:"MID"`
	Username  string    `gorm:"column:username;unique;not null" json:"Username"`
	Password  string    `gorm:"column:password;not null" json:"-"`
	Email     string    `gorm:"column:email;unique;not null" json:"Email"`
	RankID    int       `gorm:"column:rank_id;not null" json:"RankID"`
	FirstName string    `gorm:"column:first_name;not null" json:"FirstName"`
	LastName  string    `gorm:"column:last_name;not null" json:"LastName"`
	Birthday  time.Time `gorm:"column:birthday;not null" json:"Birthday"`

	// ให้ชี้ FK/PK ให้ตรงคอลัมน์จริงของ Rank (ปรับตาม struct Rank ของคุณ)
	Rank Rank `gorm:"foreignKey:RankID;references:RankID" json:"Rank"`

	BehaviorEvaluation []BehaviorEvaluation `gorm:"foreignKey:MID;references:m_id" json:"evaluations,omitempty"`
}

// ถ้าชื่อ table ไม่ใช่ "members" ให้กำหนดด้วย
// func (Member) TableName() string { return "members" }
