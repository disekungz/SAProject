package entity

type Rank struct {
	RankID   int    `gorm:"primaryKey;not null"`
	RankName string `gorm:"unique;not null"`

	Staff  []Staff  `gorm:"foreignKey:RankID"`
	Member []Member `gorm:"foreignKey:RankID"`
}
