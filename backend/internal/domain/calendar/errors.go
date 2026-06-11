package calendar

import "errors"

var (
	ErrInvalidICSURL    = errors.New("calendar: invalid ICS URL")
	ErrCalendarNotFound = errors.New("calendar: not found")
	ErrEventNotFound    = errors.New("calendar: event not found")
	ErrFetchFailed      = errors.New("calendar: failed to fetch or parse ICS feed")
)
