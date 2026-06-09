package workschedule

import "time"

// Schedule captures a user's working days, working time, and holidays. It drives
// the work-outfit recommendation (KAN-49 criteria 6–8).
type Schedule struct {
	UserID      string
	WorkingDays []time.Weekday // e.g. Mon–Fri
	WorkStart   string         // "HH:MM", 24-hour
	WorkEnd     string         // "HH:MM", 24-hour
	Holidays    []time.Time    // date-only; days off even on a working weekday
}

// DefaultSchedule is used when a user hasn't set one yet: Mon–Fri, 09:00–17:00.
func DefaultSchedule(userID string) *Schedule {
	return &Schedule{
		UserID: userID,
		WorkingDays: []time.Weekday{
			time.Monday, time.Tuesday, time.Wednesday, time.Thursday, time.Friday,
		},
		WorkStart: "09:00",
		WorkEnd:   "17:00",
		Holidays:  nil,
	}
}

// IsWorkingDay reports whether the given date is a working day: its weekday is in
// the schedule and it is not marked as a holiday.
func (s *Schedule) IsWorkingDay(date time.Time) bool {
	if s.IsHoliday(date) {
		return false
	}
	wd := date.Weekday()
	for _, d := range s.WorkingDays {
		if d == wd {
			return true
		}
	}
	return false
}

// IsHoliday reports whether the given date is marked as a holiday.
func (s *Schedule) IsHoliday(date time.Time) bool {
	y, m, d := date.Date()
	for _, h := range s.Holidays {
		hy, hm, hd := h.Date()
		if y == hy && m == hm && d == hd {
			return true
		}
	}
	return false
}
