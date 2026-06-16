package user

import "time"

type User struct {
	ID           string
	Email        string
	Name         string
	PasswordHash string // empty for accounts created via Google sign-in
	GoogleID     string // Google "sub" claim; empty for email/password accounts
	CreatedAt    time.Time
}

// GoogleIdentity is the verified identity extracted from a Google id_token after
// an OAuth code exchange. It is produced in infrastructure and consumed by the
// auth service to sign the user in or create their account.
type GoogleIdentity struct {
	GoogleID string // the "sub" claim — stable per Google account
	Email    string
	Name     string
}

type Preferences struct {
	UserID  string
	Styles  []string          // e.g. ["casual", "formal", "sport"]
	Answers map[string]string // personalized Q answers keyed by question ID
	UseAI   bool              // true = AI recommender, false = rule-based fallback
}
