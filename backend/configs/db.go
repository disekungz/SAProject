package configs

import (
	"time"

	"github.com/sa-project/entity"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var db *gorm.DB

func DB() *gorm.DB {
	return db
}

func ConnectionDB() {
	database, err := gorm.Open(sqlite.Open("sa.db"), &gorm.Config{})
	if err != nil {
		panic("Failed to connect to database!")
	}
	db = database
}
func SetupDatabase() {
	db.AutoMigrate(
		&entity.Rank{},
		&entity.Staff{},
		&entity.Medical_History{},
		&entity.Member{},
		&entity.Parcel{},
		&entity.Operation{},
		&entity.Operator{},
		&entity.Prisoner{},
		&entity.Work{},
		&entity.Room{},
		&entity.Adjustment{},
		&entity.Gender{},
		&entity.ScoreBehavior{},
		&entity.Doctor{},
		&entity.Type{},
		&entity.Status{},
		&entity.Requesting{},
		&entity.Visitor{},
		&entity.Status{},
		&entity.Relationship{},
		&entity.Visitation{},
		&entity.Type_cum{},
		&entity.Petition{},
		&entity.TimeSlot{},
		&entity.Activity{},
		&entity.ActivitySchedule{},
		&entity.Enrollment{},
	)

	db.FirstOrCreate(&entity.Gender{Gender_ID: 1}, entity.Gender{Gender_ID: 1, Gender: "ชาย"})
	db.FirstOrCreate(&entity.Gender{Gender_ID: 2}, entity.Gender{Gender_ID: 2, Gender: "หญิง"})

	db.FirstOrCreate(&entity.Type{Type_ID: 1, Type: "วัสดุ"})
	db.FirstOrCreate(&entity.Type{Type_ID: 2, Type: "อุปกรณ์"})
	db.FirstOrCreate(&entity.Type{Type_ID: 3, Type: "ยา"})

	db.FirstOrCreate(&entity.Rank{RankID: 1}, entity.Rank{RankID: 1, RankName: "แอดมิน"})
	db.FirstOrCreate(&entity.Rank{RankID: 2}, entity.Rank{RankID: 2, RankName: "ผู้คุม"})
	db.FirstOrCreate(&entity.Rank{RankID: 3}, entity.Rank{RankID: 3, RankName: "ญาติ"})

	db.FirstOrCreate(&entity.Doctor{DoctorID: 1, DoctorName: "แพทย์หญิงสมศรี"})
	db.FirstOrCreate(&entity.Doctor{DoctorID: 2, DoctorName: "แพทย์ชายสมชาย"})

	db.FirstOrCreate(&entity.Operator{OperatorID: 1, OperatorName: "เพิ่ม"})
	db.FirstOrCreate(&entity.Operator{OperatorID: 2, OperatorName: "เบิก"})
	db.FirstOrCreate(&entity.Operator{OperatorID: 3, OperatorName: "แก้ไข"})
	db.FirstOrCreate(&entity.Operator{OperatorID: 4, OperatorName: "เพิ่มใหม่"})

	password := "123456"
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

	member := entity.Member{
		MID:       1,
		Username:  "admin01",
		Password:  string(hashedPassword),
		Email:     "admin01@example.com",
		RankID:    1, // ให้สิทธิ์เป็นแอดมิน
		FirstName: "สมชาย",
		LastName:  "ใจดี",
		Birthday:  time.Date(1995, time.March, 15, 0, 0, 0, 0, time.Local),
	}

	db.Where(entity.Member{Username: member.Username}).FirstOrCreate(&member)

	db.FirstOrCreate(&entity.Work{Work_ID: 1, Work_Name: "ซ่อมบำรุง"})
	db.FirstOrCreate(&entity.Work{Work_ID: 2, Work_Name: "ทำสวน"})
	db.FirstOrCreate(&entity.Work{Work_ID: 3, Work_Name: "ล้างห้องน้ำ"})

	db.FirstOrCreate(&entity.Status{Status_ID: 1, Status: "รอ..."})
	db.FirstOrCreate(&entity.Status{Status_ID: 2, Status: "อนุมัติ"})
	db.FirstOrCreate(&entity.Status{Status_ID: 3, Status: "ไม่อนุมัติ"})
	db.FirstOrCreate(&entity.Status{Status_ID: 4, Status: "สำเร็จ"})
	// Seed BehaviorCriterion
	db.FirstOrCreate(&entity.BehaviorCriterion{BID: 1, Criterion: "ดีมาก"})
	db.FirstOrCreate(&entity.BehaviorCriterion{BID: 2, Criterion: "ดี"})
	db.FirstOrCreate(&entity.BehaviorCriterion{BID: 3, Criterion: "ปานกลาง"})
	db.FirstOrCreate(&entity.BehaviorCriterion{BID: 4, Criterion: "ต้องปรับปรุง"})

	// Seed Activities
	
	relationships := []entity.Relationship{
		{Relationship_name: "พ่อ"},
		{Relationship_name: "แม่"},
		{Relationship_name: "พี่น้อง"},
		{Relationship_name: "คู่สมรส"},
		{Relationship_name: "เพื่อน"},
	}
	for _, r := range relationships {
		db.Where(entity.Relationship{Relationship_name: r.Relationship_name}).FirstOrCreate(&r)
	}

	// Type_cum
	typesCum := []entity.Type_cum{
		{Type_cum_name: "ทั่วไป"},
		{Type_cum_name: "สุขภาพ"},
		{Type_cum_name: "โอนย้าย"},
	}
	for _, t := range typesCum {
		db.Where(entity.Type_cum{Type_cum_name: t.Type_cum_name}).FirstOrCreate(&t)
	}

	// TimeSlot
	timeslots := []entity.TimeSlot{
		{TimeSlot_Name: "09:00 - 09:30", Start_Time: "09:00", End_Time: "09:30"},
		{TimeSlot_Name: "09:30 - 10:00", Start_Time: "09:30", End_Time: "10:00"},
		{TimeSlot_Name: "10:00 - 10:30", Start_Time: "10:00", End_Time: "10:30"},
		{TimeSlot_Name: "10:30 - 11:00", Start_Time: "10:30", End_Time: "11:00"},
		{TimeSlot_Name: "13:00 - 13:30", Start_Time: "13:00", End_Time: "13:30"},
		{TimeSlot_Name: "13:30 - 14:00", Start_Time: "13:30", End_Time: "14:00"},
		{TimeSlot_Name: "14:00 - 14:30", Start_Time: "14:00", End_Time: "14:30"},
		{TimeSlot_Name: "14:30 - 15:00", Start_Time: "14:30", End_Time: "15:00"},
	}
	for _, ts := range timeslots {
		db.Where(entity.TimeSlot{TimeSlot_Name: ts.TimeSlot_Name}).FirstOrCreate(&ts)
	}

}
