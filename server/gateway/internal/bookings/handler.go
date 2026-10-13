package bookings

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves the auth-scoped booking endpoints.
type Handler struct {
	repo  *Repo
	cache *cache.Cache
	audit contracts.AuditWriter
}

// NewHandler builds the bookings handler.
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit}
}

// Register mounts booking endpoints (all auth-scoped).
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/bookings", h.list)
		g.Post("/bookings", h.create)
		g.Delete("/bookings/{id}", h.cancel)
		g.Get("/food-bookings", h.listFood)
		g.Post("/food-bookings", h.createFood)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSeller, auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Get("/seller/bookings", h.sellerList)
		g.Put("/bookings/{id}/status", h.setStatus)
	})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	var cached []contracts.Booking
	if h.cache.GetJSON(r.Context(), cache.Bookings(userID), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	items, err := h.repo.ByUser(r.Context(), userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "bookings_unavailable", "bookings unavailable")
		return
	}
	h.cache.SetJSON(r.Context(), cache.Bookings(userID), items, cache.TTLBookings)
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var body contracts.Booking
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if body.VendorID == "" || body.Date == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "vendorId and date required")
		return
	}
	b, err := h.repo.Create(r.Context(), auth.UserID(r.Context()), body)
	if err != nil {
		if errors.Is(err, ErrSlotTaken) {
			httpx.Fail(w, http.StatusConflict, "slot_taken", "that slot is already booked")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "booking_failed", "could not create booking")
		return
	}
	h.cache.Del(r.Context(), cache.Bookings(b.UserID))
	httpx.JSON(w, http.StatusCreated, b)
}

func (h *Handler) cancel(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	if err := h.repo.Cancel(r.Context(), userID, chi.URLParam(r, "id")); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "cancel_failed", "could not cancel booking")
		return
	}
	h.cache.Del(r.Context(), cache.Bookings(userID))
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) listFood(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	var cached []contracts.FoodBooking
	if h.cache.GetJSON(r.Context(), cache.FoodBookings(userID), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	items, err := h.repo.FoodByUser(r.Context(), userID)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "bookings_unavailable", "food bookings unavailable")
		return
	}
	h.cache.SetJSON(r.Context(), cache.FoodBookings(userID), items, cache.TTLBookings)
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) createFood(w http.ResponseWriter, r *http.Request) {
	var body contracts.FoodBooking
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if body.Date == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "date required")
		return
	}
	f, err := h.repo.CreateFood(r.Context(), auth.UserID(r.Context()), body)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "booking_failed", "could not create food booking")
		return
	}
	h.cache.Del(r.Context(), cache.FoodBookings(f.UserID))
	httpx.JSON(w, http.StatusCreated, f)
}

func (h *Handler) sellerList(w http.ResponseWriter, r *http.Request) {
	sellerID := strings.TrimSpace(r.URL.Query().Get("sellerId"))
	if auth.Role(r.Context()) == auth.RoleSeller {
		sellerID = auth.SellerID(r.Context())
	}
	status := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("status")))
	items, err := h.repo.SellerBookings(r.Context(), sellerID, status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "bookings_unavailable", "bookings unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) setStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	status := strings.ToLower(strings.TrimSpace(body.Status))
	if status != "confirmed" && status != "cancelled" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "status must be confirmed or cancelled")
		return
	}
	role := auth.Role(r.Context())
	admin := role == auth.RoleStateAdmin || role == auth.RoleSuperAdmin
	b, ok, err := h.repo.SetStatus(r.Context(), id, auth.SellerID(r.Context()), status, admin)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "booking_failed", "could not update booking")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "booking not found")
		return
	}
	h.cache.Del(r.Context(), cache.Bookings(b.UserID))
	h.log(r, "BOOKING_"+strings.ToUpper(status), id)
	httpx.JSON(w, http.StatusOK, b)
}

func (h *Handler) log(r *http.Request, action, entityID string) {
	if h.audit == nil {
		return
	}
	actorID := auth.UserID(r.Context())
	if actorID == "" {
		actorID = auth.SellerID(r.Context())
	}
	if actorID == "" {
		actorID = "anonymous"
	}
	role := auth.Role(r.Context())
	if role == "" {
		role = auth.RoleSeller
	}
	raw, _ := json.Marshal(map[string]string{"action": action})
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: role, Action: action,
		Entity: "bookings.tables", EntityID: entityID, After: raw,
	})
}
