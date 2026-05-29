package handlers

import "net/http"

type WardrobeHandler struct {
	// TODO: svc *wardrobe.Service
}

func NewWardrobeHandler( /* svc *wardrobe.Service */ ) *WardrobeHandler {
	return &WardrobeHandler{}
}

func (h *WardrobeHandler) ListItems(w http.ResponseWriter, r *http.Request) {
	// TODO: parse category query param, call svc.ListItems, return JSON
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (h *WardrobeHandler) Scan(w http.ResponseWriter, r *http.Request) {
	// TODO: parse multipart image, call svc.IngestScan, return created item
	http.Error(w, "not implemented", http.StatusNotImplemented)
}
