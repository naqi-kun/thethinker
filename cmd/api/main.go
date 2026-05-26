package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/infrastructure/persistence/postgres"
)

func main() {
	// TODO: initialize Datadog tracer
	// tracer.Start(tracer.WithServiceName("thethinker-api"))
	// defer tracer.Stop()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	if err := postgres.RunMigrations(databaseURL); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	db, err := postgres.NewPool(ctx, databaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	userRepo     := postgres.NewUserRepository(db)
	wardrobeRepo := postgres.NewWardrobeRepository(db)
	calendarRepo := postgres.NewCalendarRepository(db)

	// TODO: wire repositories → services → handlers
	// userSvc        := user.NewService(userRepo)
	// wardrobeSvc    := wardrobe.NewService(wardrobeRepo)
	// calendarSvc    := calendar.NewService(calendarRepo)
	// weatherSvc     := weather.NewService()
	// recommendSvc   := recommendation.NewService(wardrobeRepo, calendarRepo, weatherSvc)
	//
	// userHandler      := handlers.NewUserHandler(userSvc)
	// wardrobeHandler  := handlers.NewWardrobeHandler(wardrobeSvc)
	// calendarHandler  := handlers.NewCalendarHandler(calendarSvc)
	// recommendHandler := handlers.NewRecommendationHandler(recommendSvc)

	_ = userRepo
	_ = wardrobeRepo
	_ = calendarRepo

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", healthz)

	// TODO: register domain routes
	// mux.HandleFunc("POST /auth/register",        userHandler.Register)
	// mux.HandleFunc("POST /auth/login",           userHandler.Login)
	// mux.HandleFunc("GET  /users/me/preferences", userHandler.GetPreferences)
	// mux.HandleFunc("PUT  /users/me/preferences", userHandler.UpdatePreferences)
	// mux.HandleFunc("GET  /wardrobe/items",       wardrobeHandler.List)
	// mux.HandleFunc("POST /wardrobe/scan",        wardrobeHandler.Scan)
	// mux.HandleFunc("POST /calendar/connect",     calendarHandler.Connect)
	// mux.HandleFunc("DELETE /calendar/disconnect",calendarHandler.Disconnect)
	// mux.HandleFunc("GET  /recommendations/outfit",recommendHandler.GetOutfit)

	srv := &http.Server{
		Addr:         ":" + port(),
		Handler:      mux,
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
