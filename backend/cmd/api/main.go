package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/user"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/wardrobe"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/infrastructure/persistence/postgres"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/handlers"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

func main() {
	// TODO: initialize Datadog tracer
	// tracer.Start(tracer.WithServiceName("thethinker-api"))
	// defer tracer.Stop()

	databaseURL := requireEnv("DATABASE_URL")
	jwtSecret := requireEnv("JWT_SECRET")

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

	// repositories
	userRepo     := postgres.NewUserRepository(db)
	wardrobeRepo := postgres.NewWardrobeRepository(db)

	// TODO: wire remaining repos when their handlers are implemented
	// calendarRepo := postgres.NewCalendarRepository(db)

	// services
	userSvc     := user.NewService(userRepo, jwtSecret)
	wardrobeSvc := wardrobe.NewService(wardrobeRepo)

	// handlers
	userHandler     := handlers.NewUserHandler(userSvc)
	wardrobeHandler := handlers.NewWardrobeHandler(wardrobeSvc)

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

	mux.Handle("GET /wardrobe/items",  auth(http.HandlerFunc(wardrobeHandler.ListItems)))
	mux.Handle("POST /wardrobe/items", auth(http.HandlerFunc(wardrobeHandler.AddItem)))

	// TODO: wire remaining routes — KAN-14+
	// mux.Handle("POST /wardrobe/scan",          auth(http.HandlerFunc(wardrobeHandler.Scan)))
	// mux.Handle("POST /calendar/connect",       auth(http.HandlerFunc(calendarHandler.Connect)))
	// mux.Handle("DELETE /calendar/disconnect",  auth(http.HandlerFunc(calendarHandler.Disconnect)))
	// mux.Handle("GET /recommendations/outfit",  auth(http.HandlerFunc(recommendHandler.GetOutfit)))

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

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("%s is required", key)
	}
	return v
}
