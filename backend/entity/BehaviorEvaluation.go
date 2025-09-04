package entity

import "time"

type BehaviorEvaluation struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	SID            uint      `json:"sId"`
	MID            uint      `json:"mId"`
	BID            uint      `json:"bId"`
	EvaluationDate time.Time `json:"evaluationDate"`
	Notes          string    `gorm:"type:text" json:"notes"`

	// เพิ่ม references tag ที่ 3 บรรทัดนี้เพื่อให้ GORM Preload ทำงานถูกต้อง
	ScoreBehavior     *ScoreBehavior     `gorm:"foreignKey:SID;references:SID" json:"scoreBehavior"`
	Member            *Member            `gorm:"foreignKey:MID;references:MID" json:"member"`
	BehaviorCriterion *BehaviorCriterion `gorm:"foreignKey:BID;references:BID" json:"behaviorCriterion"`
}
