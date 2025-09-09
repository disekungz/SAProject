package main

import (
	"github.com/gin-gonic/gin"
	"github.com/sa-project/configs"
	"github.com/sa-project/controller"
	"github.com/sa-project/middleware"
)

const PORT = "8088"

func main() {
	configs.ConnectionDB()
	configs.SetupDatabase()

	// This function ensures that every prisoner has a score behavior record.
	backfillScoreBehaviors()

	r := gin.Default()
	r.Use(CORSMiddleware())
	r.Use(middleware.AuthOptional())

	api := r.Group("/api")
	api.POST("/auth/register", controller.Register)
	api.POST("/auth/login", controller.Login)
	api.GET("/me", middleware.AuthRequired(), controller.Me)

	{
		// --- Prisoner & Related Routes ---
		api.GET("/prisoners", controller.GetPrisoners)
		api.POST("/prisoners", controller.CreatePrisoner)
		api.PUT("/prisoners/:id", controller.UpdatePrisoner)
		api.DELETE("/prisoners/:id", controller.DeletePrisoner)
		api.GET("/prisoners/:id", controller.GetPrisonerByID)
		api.GET("/prisoners/next-inmate-id", controller.GetNextInmateID)

		// --- Staff & Permissions Routes ---
		api.GET("/staffs", controller.GetStaffs)
		api.POST("/staffs", controller.CreateStaff)
		api.PUT("/staffs/:id", controller.UpdateStaff)
		api.DELETE("/staffs/:id", controller.DeleteStaff)
		api.GET("/staffs/:id", controller.GetStaffByID)
		api.GET("/ranks", controller.GetRanks)

		// --- Score & Adjustment Routes ---
		api.GET("/scorebehaviors", controller.GetScoreBehaviors)
		api.PUT("/scorebehaviors/:id", controller.UpdateScoreBehavior)
		api.GET("/adjustments", controller.GetAdjustments)
		api.POST("/adjustments", controller.CreateAdjustment)

		// --- Medical & Inventory Routes ---
		api.GET("/medical_histories", controller.GetMedicalHistories)
		api.POST("/medical_histories", controller.CreateMedicalHistory)
		api.PUT("/medical_histories/:id", controller.UpdateMedicalHistory)
		api.DELETE("/medical_histories/:id", controller.DeleteMedicalHistory)
		api.GET("/parcels", controller.GetParcels)
		api.POST("/parcels", controller.CreateParcel)
		api.PUT("/parcels/:id", controller.UpdateParcel)
		api.POST("/parcels/:id/add", controller.AddParcel)
		api.POST("/parcels/:id/reduce", controller.ReduceParcel)
		api.GET("/operations", controller.GetOperations)

		// --- Room, Work & Requesting Routes ---
		api.GET("/rooms", controller.GetRooms)
		api.POST("/rooms", controller.CreateRoom)
		api.PUT("/rooms/:id", controller.UpdateRoom)
		api.DELETE("/rooms/:id", controller.DeleteRoom)
		api.GET("/works", controller.GetWorks)
		api.GET("/requestings", controller.GetRequestings)
		api.POST("/requestings", controller.CreateRequesting)
		api.PUT("/requestings/:id", controller.UpdateRequesting)
		api.DELETE("/requestings/:id", controller.DeleteRequesting)
		api.GET("/requestings/next-request-no", controller.GetNextRequestNo)
		api.PUT("/requestings/:id/status", controller.UpdateRequestingStatus)

		// --- Visitation System ---
		api.GET("/visitations", controller.GetVisitations)
		api.POST("/visitations", controller.CreateVisitation)
		api.PUT("/visitations/:id", controller.UpdateVisitation)
		api.DELETE("/visitations/:id", controller.DeleteVisitation)

		// --- Petition System ---
		api.GET("/petitions", controller.GetPetitions)
		api.POST("/petitions", controller.CreatePetition)
		api.PUT("/petitions/:id", controller.UpdatePetition)
		api.DELETE("/petitions/:id", controller.DeletePetition)

		// --- General & Dropdown Data ---
		api.GET("/genders", controller.GetGenders)
		api.GET("/types", controller.GetTypes)
		api.GET("/statuses", controller.GetStatuses)
		api.GET("/visitors", controller.GetVisitors)
		api.GET("/relationships", controller.GetRelationships)
		api.GET("/typesc", controller.GetTypeCums)
		api.GET("/timeslots", controller.GetTimeSlots)

		api.GET("/evaluations", controller.GetEvaluations)
		api.POST("/evaluations", controller.CreateEvaluation)
		api.PUT("/evaluations/:id", controller.UpdateEvaluation)
		api.DELETE("/evaluations/:id", controller.DeleteEvaluation)
		api.GET("/scorebehavior/prisoner/:id", controller.GetScoreByPrisoner)

		// --- Activity Schedule Routes ---
		api.GET("/schedules", controller.GetActivitySchedules)
		api.POST("/schedules", controller.CreateActivitySchedule)
		api.PUT("/schedules/:id", controller.UpdateActivitySchedule)
		api.DELETE("/schedules/:id", controller.DeleteActivitySchedule)
		api.POST("/enrollments", controller.EnrollParticipant)
		api.PUT("/enrollments/:id/status", controller.UpdateEnrollmentStatus)
		api.DELETE("/enrollments/:id", controller.DeleteEnrollment)
		api.GET("/members", controller.GetMember)
		api.GET("/behaviorcriteria", controller.GetBehaviorCriteria)

		// --- Member Management ---
		api.PATCH("/members/:id", controller.UpdateMember)        // เปลี่ยน Rank (และอนาคตเปลี่ยนฟิลด์อื่น)
		api.PUT("/members/:id/rank", controller.UpdateMemberRank) // ทางลัดเฉพาะเปลี่ยน Rank
		api.DELETE("/member/:id", controller.DeleteMemberById)    // ใส่เอกพจน์ให้ตรง FE
		// ถ้าอยากเคร่งสิทธิ์ ให้ครอบด้วย middleware.AuthRequired() ได้

	}

	r.Run("localhost:" + PORT)
}

func backfillScoreBehaviors() {
	configs.DB().Exec(`
		INSERT INTO score_behaviors (prisoner_id, score)
		SELECT p.prisoner_id, 0
		FROM prisoners p
		LEFT JOIN score_behaviors sb ON sb.prisoner_id = p.prisoner_id
		WHERE sb.prisoner_id IS NULL
	`)
}

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
