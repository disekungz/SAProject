package configs

import (
	"time"

	"github.com/sa-project/entity"
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

	db.FirstOrCreate(&entity.Member{MID: 1, FirstName: "สมมติ", LastName: "สมาชิก"})

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
	act1 := entity.Activity{Activity_ID: 9001, ActivityName: "งานไม้", Location: "โรงฝึก 1", Description: "ฝึกทักษะการทำเฟอร์นิเจอร์"}
	act2 := entity.Activity{Activity_ID: 9002, ActivityName: "ภาษาอังกฤษ", Location: "ห้องเรียน 2", Description: "สอนภาษาอังกฤษเบื้องต้น"}
	db.FirstOrCreate(&act1)
	db.FirstOrCreate(&act2)

	// Seed Schedules
	schedule1 := entity.ActivitySchedule{Schedule_ID: 6001, Activity_ID: 9001, MID: 1, Max: 10, StartDate: time.Now(), EndDate: time.Now().AddDate(0, 0, 5), StartTime: "09:00:00", EndTime: "12:00:00"}
	schedule2 := entity.ActivitySchedule{Schedule_ID: 6002, Activity_ID: 9002, MID: 2, Max: 15, StartDate: time.Now().AddDate(0, 0, 7), EndDate: time.Now().AddDate(0, 1, 7), StartTime: "13:00:00", EndTime: "15:00:00"}
	db.FirstOrCreate(&schedule1)
	db.FirstOrCreate(&schedule2)

	// Seed Enrollments
	db.FirstOrCreate(&entity.Enrollment{Enrollment_ID: 1, Schedule_ID: 6001, Prisoner_ID: 101, EnrollDate: time.Now(), Status: 1})
	db.FirstOrCreate(&entity.Enrollment{Enrollment_ID: 2, Schedule_ID: 6002, Prisoner_ID: 102, EnrollDate: time.Now(), Status: 1})

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
