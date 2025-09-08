package entity

type Rank struct {
	RankID   int    `gorm:"column:rank_id;primaryKey" json:"RankID"`
	RankName string `gorm:"unique;not null" json:"RankName"`

	Staff  []Staff  `gorm:"foreignKey:RankID"`
	Member []Member `gorm:"foreignKey:RankID"`
}
