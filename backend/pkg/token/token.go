package token

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const expiry = 7 * 24 * time.Hour

type claims struct {
	jwt.RegisteredClaims
}

// Sign creates a signed JWT containing the userID as the subject.
func Sign(userID, secret string) (string, error) {
	c := claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString([]byte(secret))
}

// Verify validates the token and returns the userID stored in the subject claim.
func Verify(tokenStr, secret string) (string, error) {
	t, err := jwt.ParseWithClaims(tokenStr, &claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return "", err
	}
	c, ok := t.Claims.(*claims)
	if !ok {
		return "", fmt.Errorf("invalid claims")
	}
	return c.Subject, nil
}
