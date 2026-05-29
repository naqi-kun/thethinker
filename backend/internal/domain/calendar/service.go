package calendar

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// TODO: implement Connect(ctx, userID, provider, authCode) — OAuth exchange, persist token
// TODO: implement Disconnect(ctx, userID) — remove stored token
// TODO: implement GetUpcomingEvents(ctx, userID) — fetch and classify events
