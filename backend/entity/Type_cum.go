package entity

import (
    "gorm.io/gorm"
)

type Type_cum struct {
    gorm.Model
    Type_cum_name   string

    // แก้ไข GORM tag ที่ผิดไวยากรณ์
    Petition []Petition `gorm:"foreignKey:Type_cum_ID"`
}