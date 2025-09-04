package entity

type BehaviorCriterion struct {
	BID       uint   `gorm:"primaryKey" json:"bId"`
	Criterion string `gorm:"type:varchar(100);not null" json:"criterion"`

	BehaviorEvaluation []BehaviorEvaluation `gorm:"foreignKey:BID" json:"evaluations"`
}
