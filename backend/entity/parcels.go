package entity

type Parcel struct {
	PID        int    `gorm:"primaryKey" json:"PID"`
	ParcelName string `gorm:"unique;not null" json:"ParcelName"`
	Quantity   int    `gorm:"not null" json:"Quantity"`
	Type_ID    uint   `gorm:"not null" json:"Type_ID"`
	Type       Type   `gorm:"foreignKey:Type_ID" json:"Type"`
	Status     string `gorm:"not null" json:"Status"`
}
