package entity

type Doctor struct {
	DoctorID   int `gorm:"primaryKey"`
	DoctorName string

	// 1 PrisonID มี Jailer ได้หลาย
	Medical_History []Medical_History `gorm:"foreignKey:DoctorID"`
}
