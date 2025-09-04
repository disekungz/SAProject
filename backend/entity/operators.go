package entity

type Operator struct {
	OperatorID   int    `gorm:"primaryKey" json:"OperatorID"`
	OperatorName string `gorm:"unique;not null" json:"OperatorName"`
}
