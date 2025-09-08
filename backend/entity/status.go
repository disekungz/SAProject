package entity

type Status struct {
	Status_ID uint   `gorm:"primaryKey"`
	Status    string `gorm:"not null;unique"`
	
	Requestings []Requesting `gorm:"foreignKey:Status_ID"`
	Visitation []Visitation `gorm:"foreignKey:Status_ID"`
	Petition []Petition `gorm:"foreignKey:Status_ID"`

}