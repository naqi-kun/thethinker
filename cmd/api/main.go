package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	// TODO: initialize Datadog tracer
	// tracer.Start(tracer.WithServiceName("thethinker-api"))
	// defer tracer.Stop()

	// TODO: connect to database
	// db, err := pgxpool.Connect(ctx, os.Getenv("DATABASE_URL"))
	// if err != nil { log.Fatal(err) }
	// defer db.Close()

	// TODO: wire repositories → services → handlers
	// userRepo    := postgres.NewUserRepository(db)
	// wardrobeRepo := postgres.NewWardrobeRepository(db)
	// calendarRepo := postgres.NewCalendarRepository(db)
	// weatherSvc  := weather.NewService()
	// userSvc     := user.NewService(userRepo)
	// wardrobeSvc := wardrobe.NewService(wardrobeRepo)
	// calendarSvc := calendar.NewService(calendarRepo)
	// recommendSvc := recommendation.NewService(wardrobeRepo, calendarRepo, weatherSvc)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", healthz)

	// TODO: register domain routes
	// mux.HandleFunc("POST /auth/register", userHandler.Register)
	// mux.HandleFunc("POST /auth/login",    userHandler.Login)
	// ...

	srv := &http.Server{
		Addr:         ":" + port(),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	// graceful shutdown — k8s sends SIGTERM before killing the pod
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

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
