package workschedule

import (
	"testing"
	"time"
)

func TestDefaultSchedule(t *testing.T) {
	s := DefaultSchedule("user-1")
	if len(s.WorkingDays) != 5 {
		t.Errorf("default working days = %d, want 5 (Mon–Fri)", len(s.WorkingDays))
	}
	if s.WorkStart != "09:00" || s.WorkEnd != "17:00" {
		t.Errorf("default time = %s–%s, want 09:00–17:00", s.WorkStart, s.WorkEnd)
	}
}

func TestIsWorkingDay(t *testing.T) {
	mon := time.Date(2026, 6, 8, 0, 0, 0, 0, time.UTC) // a Monday
	sat := time.Date(2026, 6, 13, 0, 0, 0, 0, time.UTC)
	if mon.Weekday() != time.Monday || sat.Weekday() != time.Saturday {
		t.Fatalf("test dates are not the expected weekdays")
	}

	s := DefaultSchedule("user-1")

	if !s.IsWorkingDay(mon) {
		t.Errorf("Monday should be a working day under the default schedule")
	}
	if s.IsWorkingDay(sat) {
		t.Errorf("Saturday should not be a working day under the default schedule")
	}

	// A holiday on a working weekday is not a working day.
	s.Holidays = []time.Time{mon}
	if s.IsWorkingDay(mon) {
		t.Errorf("a Monday marked as holiday should not be a working day")
	}
	if !s.IsHoliday(mon) {
		t.Errorf("IsHoliday should be true for the marked date")
	}
}
