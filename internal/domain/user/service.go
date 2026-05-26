package user

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// TODO: implement Register(ctx, email, password) — hash password, persist user
// TODO: implement Login(ctx, email, password) — verify hash, return JWT
// TODO: implement GetPreferences / UpdatePreferences
