package user

import "time"

type User struct {
	ID           string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

type Preferences struct {
	UserID  string
	Styles  []string          // e.g. ["casual", "formal", "sport"]
	Answers map[string]string // personalized Q answers keyed by question ID
}
