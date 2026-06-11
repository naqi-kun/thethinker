package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/recommendation"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/weather"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/workschedule"
	aiinfra "school-gitlab.xsolla.dev/team3/thethinker/internal/infrastructure/external/ai"
	calendarext "school-gitlab.xsolla.dev/team3/thethinker/internal/infrastructure/external/calendar"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/infrastructure/external/classifier"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/infrastructure/persistence/postgres"
	gcsclient "school-gitlab.xsolla.dev/team3/thethinker/internal/infrastructure/storage/gcs"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/handlers"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
	"school-gitlab.xsolla.dev/team3/thethinker/pkg/telemetry"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	shutdownTelemetry, err := telemetry.Setup(ctx)
	if err != nil {
		log.Fatalf("telemetry: %v", err)
	}
	defer func() {
		if err := shutdownTelemetry(context.Background()); err != nil {
			log.Printf("telemetry shutdown: %v", err)
		}
	}()

	databaseURL := requireEnv("DATABASE_URL")
	jwtSecret := requireEnv("JWT_SECRET")
	aiServiceURL := requireEnv("AI_SERVICE_URL")
	gcsBucket := getEnvOrDefault("GCS_BUCKET", "wardrobe-images")

	if err := postgres.RunMigrations(databaseURL); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	db, err := postgres.NewPool(ctx, databaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	// storage
	gcsClient, err := gcsclient.New(ctx, gcsBucket)
	if err != nil {
		log.Fatalf("gcs: %v", err)
	}
	defer gcsClient.Close()

	// repositories
	userRepo := postgres.NewUserRepository(db)
	wardrobeRepo := postgres.NewWardrobeRepository(db)
	calendarRepo := postgres.NewCalendarRepository(db)
	workScheduleRepo := postgres.NewWorkScheduleRepository(db)

	// services
	userSvc := user.NewService(userRepo, jwtSecret)
	classifierClient := classifier.NewClient(aiServiceURL)
	wardrobeSvc := wardrobe.NewService(wardrobeRepo, classifierClient, gcsClient, classifierClient)
	calendarSvc := calendar.NewService(calendarRepo, calendarext.NewICSFetcher())
	workScheduleSvc := workschedule.NewService(workScheduleRepo)
	weatherSvc := weather.NewService()
	aiRecommendClient := aiinfra.NewRecommendClient(aiServiceURL)
	recommendSvc := recommendation.NewService(wardrobeRepo, calendarRepo, weatherSvc, aiRecommendClient)

	// handlers
	userHandler := handlers.NewUserHandler(userSvc)
	wardrobeHandler := handlers.NewWardrobeHandler(wardrobeSvc)
	calendarHandler := handlers.NewCalendarHandler(calendarSvc)
	workScheduleHandler := handlers.NewWorkScheduleHandler(workScheduleSvc)
	recommendHandler := handlers.NewRecommendationHandler(recommendSvc, wardrobeSvc)

	// middleware
	auth := middleware.Auth(jwtSecret)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", healthz)

	// auth — public
	mux.HandleFunc("POST /auth/register", userHandler.Register)
	mux.HandleFunc("POST /auth/login", userHandler.Login)

	// user — protected
	mux.Handle("GET /users/me/preferences", auth(http.HandlerFunc(userHandler.GetPreferences)))
	mux.Handle("PUT /users/me/preferences", auth(http.HandlerFunc(userHandler.UpdatePreferences)))
	mux.Handle("GET /users/me/work-schedule", auth(http.HandlerFunc(workScheduleHandler.Get)))
	mux.Handle("PUT /users/me/work-schedule", auth(http.HandlerFunc(workScheduleHandler.Update)))

	// wardrobe — protected
	mux.Handle("GET /wardrobe/items", auth(http.HandlerFunc(wardrobeHandler.ListItems)))
	mux.Handle("POST /wardrobe/items", auth(http.HandlerFunc(wardrobeHandler.AddItem)))
	mux.Handle("DELETE /wardrobe/items/{id}", auth(http.HandlerFunc(wardrobeHandler.DeleteItem)))
	mux.Handle("POST /wardrobe/items/{id}/image", auth(http.HandlerFunc(wardrobeHandler.UploadImage)))
	mux.Handle("POST /wardrobe/scan", auth(http.HandlerFunc(wardrobeHandler.Scan)))
	mux.Handle("POST /wardrobe/classify", auth(http.HandlerFunc(wardrobeHandler.Classify)))
	mux.Handle("PUT /wardrobe/items/{id}", auth(http.HandlerFunc(wardrobeHandler.UpdateItem)))

	// calendar — protected. ICS multi-calendar flow (KAN-49).
	mux.Handle("GET /calendars", auth(http.HandlerFunc(calendarHandler.ListCalendars)))
	mux.Handle("POST /calendars", auth(http.HandlerFunc(calendarHandler.AddCalendar)))
	mux.Handle("DELETE /calendars/{id}", auth(http.HandlerFunc(calendarHandler.RemoveCalendar)))
	mux.Handle("GET /calendars/events", auth(http.HandlerFunc(calendarHandler.TodayEvents)))
	mux.Handle("POST /calendars/events/{id}/ignore", auth(http.HandlerFunc(calendarHandler.IgnoreEvent)))
	mux.Handle("DELETE /calendars/events/{id}/ignore", auth(http.HandlerFunc(calendarHandler.UnignoreEvent)))

	// calendar OAuth — protected (legacy, returns 501 until implemented)
	mux.Handle("POST /calendar/connect", auth(http.HandlerFunc(calendarHandler.Connect)))
	mux.Handle("DELETE /calendar/disconnect", auth(http.HandlerFunc(calendarHandler.Disconnect)))

	// recommendations — protected
	mux.Handle("GET /recommendations/outfit", auth(http.HandlerFunc(recommendHandler.GetOutfit)))
	mux.Handle("POST /recommendations/outfit/accept", auth(http.HandlerFunc(recommendHandler.AcceptOutfit)))

	srv := &http.Server{
		Addr:         ":" + port(),
		Handler:      middleware.Tracing(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("%s is required", key)
	}
	return v
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
