package errors

import "fmt"

type AppError struct {
	Code    string
	Message string
}

func (e *AppError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

var (
	ErrNotFound     = &AppError{Code: "NOT_FOUND", Message: "resource not found"}
	ErrUnauthorized = &AppError{Code: "UNAUTHORIZED", Message: "unauthorized"}
	ErrConflict     = &AppError{Code: "CONFLICT", Message: "resource already exists"}
	ErrBadRequest   = &AppError{Code: "BAD_REQUEST", Message: "invalid request"}
)
