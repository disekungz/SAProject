package entity

// entity/score_behavior.go
type ScoreBehavior struct {
	SID         uint `gorm:"column:s_id;primaryKey;autoIncrement" json:"SID"`
	Prisoner_ID uint `gorm:"column:prisoner_id;not null;unique" json:"Prisoner_ID"`
	Score       int  `gorm:"column:score;not null" json:"Score"`

	BehaviorEvaluation []BehaviorEvaluation `gorm:"foreignKey:SID" json:"evaluations"`
	Prisoner           *Prisoner            `gorm:"foreignKey:Prisoner_ID;references:Prisoner_ID" json:"prisoner"`
}

func (ScoreBehavior) TableName() string { return "score_behaviors" }
