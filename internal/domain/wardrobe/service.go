package wardrobe

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// TODO: implement ListItems(ctx, userID, category) — return wardrobe catalog
// TODO: implement IngestScan(ctx, userID, imageBytes) — call AI vision, persist item
