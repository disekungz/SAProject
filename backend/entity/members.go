package entity

import (
	"time"
)

type Member struct {
	MID       int       `gorm:"primaryKey" json:"MID"`
	Username  string    `gorm:"unique;not null"`
	Password  string    `gorm:"not null"`
	Email     string    `gorm:"not null"`
	RankID    int       `gorm:"not null"`
	FirstName string    `gorm:"not null"`
	LastName  string    `gorm:"not null"`
	Birthday  time.Time `gorm:"not null"`

	Rank               Rank                 `gorm:"foreignKey:RankID;references:RankID"`
	BehaviorEvaluation []BehaviorEvaluation `gorm:"foreignKey:MID" json:"evaluations"`
}
