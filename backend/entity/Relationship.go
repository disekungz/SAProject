package entity

import (



	"gorm.io/gorm"
)

type Relationship struct {
	gorm.Model
	Relationship_name   string
	

	Visitation []Visitation `gorm:"foreignKey:Relationship_ID"`
}
