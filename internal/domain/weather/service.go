package weather

type Service struct {
	// TODO: inject external weather client (internal/infrastructure/external/weather)
}

func NewService() *Service {
	return &Service{}
}

// TODO: implement GetConditions(ctx, location) — fetch from 3rd-party weather API
