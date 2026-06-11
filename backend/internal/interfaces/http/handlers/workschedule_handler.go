package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"school-gitlab.xsolla.dev/team3/thethinker/internal/domain/workschedule"
	"school-gitlab.xsolla.dev/team3/thethinker/internal/interfaces/http/middleware"
)

const holidayLayout = "2006-01-02"

type WorkScheduleHandler struct {
	svc *workschedule.Service
}

func NewWorkScheduleHandler(svc *workschedule.Service) *WorkScheduleHandler {
	return &WorkScheduleHandler{svc: svc}
}

type workScheduleBody struct {
	WorkingDays []int    `json:"working_days"`
	WorkStart   string   `json:"work_start"`
	WorkEnd     string   `json:"work_end"`
	Holidays    []string `json:"holidays"`
}

func toWorkScheduleBody(s *workschedule.Schedule) workScheduleBody {
	days := make([]int, len(s.WorkingDays))
	for i, d := range s.WorkingDays {
		days[i] = int(d)
	}
	holidays := make([]string, len(s.Holidays))
	for i, h := range s.Holidays {
		holidays[i] = h.Format(holidayLayout)
	}
	return workScheduleBody{
		WorkingDays: days,
		WorkStart:   s.WorkStart,
		WorkEnd:     s.WorkEnd,
		Holidays:    holidays,
	}
}

func (h *WorkScheduleHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	sched, err := h.svc.Get(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load work schedule")
		return
	}
	writeJSON(w, http.StatusOK, toWorkScheduleBody(sched))
}

func (h *WorkScheduleHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	var body workScheduleBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON")
		return
	}

	weekdays := make([]time.Weekday, 0, len(body.WorkingDays))
	for _, d := range body.WorkingDays {
		if d < 0 || d > 6 {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "working_days must be 0–6")
			return
		}
		weekdays = append(weekdays, time.Weekday(d))
	}

	holidays := make([]time.Time, 0, len(body.Holidays))
	for _, h := range body.Holidays {
		parsed, err := time.Parse(holidayLayout, h)
		if err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "holidays must be YYYY-MM-DD dates")
			return
		}
		holidays = append(holidays, parsed)
	}

	sched := &workschedule.Schedule{
		UserID:      userID,
		WorkingDays: weekdays,
		WorkStart:   body.WorkStart,
		WorkEnd:     body.WorkEnd,
		Holidays:    holidays,
	}
	if err := h.svc.Save(r.Context(), sched); err != nil {
		if errors.Is(err, workschedule.ErrInvalidSchedule) {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid work schedule")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to save work schedule")
		return
	}

	writeJSON(w, http.StatusOK, toWorkScheduleBody(sched))
}
