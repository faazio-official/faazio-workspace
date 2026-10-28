package blood

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
)

// Handler serves blood-donor endpoints. Health PII: the directory is auth-scoped; the requests board
// is public but contact/address are redacted for anon (same pattern as directory.stores).
type Handler struct {
	repo     *Repo
	cache    *cache.Cache
	audit    contracts.AuditWriter
	notifier contracts.Notifier
}

// NewHandler builds the blood handler. notifier may be nil (notification enqueue is best-effort).
func NewHandler(repo *Repo, c *cache.Cache, audit contracts.AuditWriter, notifier contracts.Notifier) *Handler {
	return &Handler{repo: repo, cache: c, audit: audit, notifier: notifier}
}

// Register mounts blood endpoints. The requests board is public; everything else is auth-scoped.
func (h *Handler) Register(r chi.Router) {
	r.Get("/blood-requests", h.listRequests)
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/donors/me", h.getDonor)
		g.Put("/donors/me", h.putDonor)
		g.Get("/donors", h.directory)
		g.Post("/blood-requests", h.createRequest)
		g.Put("/blood-requests/{id}/interest", h.interest)
		g.Delete("/blood-requests/{id}/interest", h.uninterest)
		g.Post("/donor-match-requests", h.createMatch)
		g.Get("/donor-match-requests", h.listMatches)
		g.Get("/donor-match-requests/incoming", h.listIncomingMatches)
		g.Put("/donor-match-requests/{id}/status", h.respondMatch)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleStateAdmin, auth.RoleSuperAdmin))
		g.Delete("/blood-requests/{id}", h.moderateRequest)
	})
}

func (h *Handler) getDonor(w http.ResponseWriter, r *http.Request) {
	d, ok, err := h.repo.Donor(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "donors_unavailable", "donor profile unavailable")
		return
	}
	if !ok {
		httpx.JSON(w, http.StatusOK, nil)
		return
	}
	httpx.JSON(w, http.StatusOK, d)
}

func (h *Handler) putDonor(w http.ResponseWriter, r *http.Request) {
	var body contracts.BloodDonor
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if body.Name == "" || len(body.Name) > 120 || len(body.City) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "name required")
		return
	}
	if !validBloodGroup(body.BloodGroup) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid blood group")
		return
	}
	body.UserID = auth.UserID(r.Context())
	if err := h.repo.UpsertDonor(r.Context(), body); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "donor_save_failed", "could not save donor profile")
		return
	}
	httpx.JSON(w, http.StatusOK, body)
}

func (h *Handler) directory(w http.ResponseWriter, r *http.Request) {
	group, city := queryFilter(r)
	donors, err := h.repo.Directory(r.Context(), group, city)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "donors_unavailable", "donor directory unavailable")
		return
	}
	if donors == nil {
		donors = []contracts.BloodDonor{}
	}
	httpx.JSON(w, http.StatusOK, donors)
}

func (h *Handler) listRequests(w http.ResponseWriter, r *http.Request) {
	authed := auth.UserID(r.Context()) != ""
	group, city := queryFilter(r)

	cacheKey := "group=" + group + ";city=" + city
	var cached []contracts.BloodRequest
	if authed == false && h.cache.GetJSON(r.Context(), cache.BloodRequests(cacheKey), &cached) {
		httpx.JSON(w, http.StatusOK, cached)
		return
	}
	requests, err := h.repo.Requests(r.Context(), group, city)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "requests_unavailable", "blood requests unavailable")
		return
	}
	if requests == nil {
		requests = []contracts.BloodRequest{}
	}
	if !authed {
		// Public projection: contact/address/created_by are PII/internal ids and are dropped;
		// cache the redacted view only.
		for i := range requests {
			requests[i].Contact = ""
			requests[i].Address = ""
			requests[i].CreatedBy = ""
		}
		h.cache.SetJSON(r.Context(), cache.BloodRequests(cacheKey), requests, cache.TTLBloodRequests)
	}
	httpx.JSON(w, http.StatusOK, requests)
}

func (h *Handler) createRequest(w http.ResponseWriter, r *http.Request) {
	var body contracts.BloodRequest
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid body")
		return
	}
	if !validBloodGroup(body.BloodGroup) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid blood group")
		return
	}
	// Right-to-erasure (account deletion): stamp the author from the bearer token so
	// DeleteAccount can erase this request (and its contact/address) when the account goes.
	body.CreatedBy = auth.UserID(r.Context())
	req, err := h.repo.CreateRequest(r.Context(), body)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "request_failed", "could not post request")
		return
	}
	h.cache.Del(r.Context(), cache.BloodRequests("group=;city="))
	httpx.JSON(w, http.StatusCreated, req)
}

func (h *Handler) interest(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Kind string `json:"kind"`
	}
	if err := httpx.Decode(r, &body); err != nil || (body.Kind != "interested" && body.Kind != "accepted") {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "kind must be interested|accepted")
		return
	}
	if err := h.repo.SetInterest(r.Context(), chi.URLParam(r, "id"), auth.UserID(r.Context()), body.Kind); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "interest_failed", "could not record interest")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

// uninterest removes an "interested"/"accepted" mark (idempotent). No board cache is touched: the
// public `blood.requests` projection carries no interest data, so un-interesting cannot stale it.
func (h *Handler) uninterest(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Kind string `json:"kind"`
	}
	if err := httpx.Decode(r, &body); err != nil || (body.Kind != "interested" && body.Kind != "accepted") {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "kind must be interested|accepted")
		return
	}
	if err := h.repo.DeleteInterest(r.Context(), chi.URLParam(r, "id"), auth.UserID(r.Context()), body.Kind); err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "interest_failed", "could not remove interest")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) createMatch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DonorUserID string `json:"donorUserId"`
		BloodGroup  string `json:"bloodGroup"`
		City        string `json:"city"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.DonorUserID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "donorUserId required")
		return
	}
	m, err := h.repo.CreateMatch(r.Context(), contracts.DonorMatch{
		RequesterUserID: auth.UserID(r.Context()),
		DonorUserID:     body.DonorUserID,
		BloodGroup:      body.BloodGroup,
		City:            body.City,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "match_failed", "could not request donor")
		return
	}
	httpx.JSON(w, http.StatusCreated, m)
}

func (h *Handler) listMatches(w http.ResponseWriter, r *http.Request) {
	matches, err := h.repo.MatchesByRequester(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "matches_unavailable", "matches unavailable")
		return
	}
	if matches == nil {
		matches = []contracts.DonorMatch{}
	}
	httpx.JSON(w, http.StatusOK, matches)
}

// listIncomingMatches lists the caller's incoming match requests (recipient = caller), so a donor
// sees targeted asks on any device rather than only the device that created the row.
func (h *Handler) listIncomingMatches(w http.ResponseWriter, r *http.Request) {
	matches, err := h.repo.MatchesByDonor(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "matches_unavailable", "matches unavailable")
		return
	}
	if matches == nil {
		matches = []contracts.DonorMatch{}
	}
	httpx.JSON(w, http.StatusOK, matches)
}

// respondMatch lets the recipient (donor) accept or decline one incoming request. Only the row's
// donor may respond, only while pending; acceptance notifies the requester (no contact is disclosed
// here — contact sharing remains a future reveal-gated step).
func (h *Handler) respondMatch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(r, &body); err != nil || (body.Status != "accepted" && body.Status != "declined") {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "status must be accepted|declined")
		return
	}
	m, ok, err := h.repo.SetMatchStatus(r.Context(), chi.URLParam(r, "id"), auth.UserID(r.Context()), body.Status)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "match_failed", "could not update request")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "request not found or already answered")
		return
	}
	// Best-effort: notify the requester their ask was answered. PII-free payload (no donor name/contact).
	if h.notifier != nil {
		kind := "MATCH_DECLINED"
		title := "A donor couldn't donate this time"
		if m.Status == "accepted" {
			kind = "MATCH_ACCEPTED"
			title = "A donor accepted your request"
		}
		_ = h.notifier.Enqueue(r.Context(), m.RequesterUserID, kind, title,
			"Open the app to see the update.", map[string]any{"matchId": m.ID, "status": m.Status})
	}
	httpx.JSON(w, http.StatusOK, m)
}

func queryFilter(r *http.Request) (group, city string) {
	group = strings.TrimSpace(r.URL.Query().Get("bloodGroup"))
	city = strings.TrimSpace(r.URL.Query().Get("city"))
	if !validBloodGroup(group) {
		group = ""
	}
	return group, city
}

// moderateRequest removes an inappropriate or stale public request (state/super admin only).
func (h *Handler) moderateRequest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stateCode := ""
	if auth.Role(r.Context()) == auth.RoleDistrictAdmin {
		stateCode = auth.StateCode(r.Context())
		if stateCode == "" {
			httpx.Fail(w, http.StatusForbidden, "forbidden", "no state scope on this account")
			return
		}
	}
	ok, err := h.repo.DeleteRequest(r.Context(), id, stateCode)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "request_failed", "could not remove request")
		return
	}
	if !ok {
		httpx.Fail(w, http.StatusNotFound, "not_found", "request not found")
		return
	}
	h.cache.Del(r.Context(), cache.BloodRequests("group=;city="))
	h.log(r, id)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) log(r *http.Request, entityID string) {
	if h.audit == nil {
		return
	}
	actorID := auth.UserID(r.Context())
	if actorID == "" {
		actorID = "admin"
	}
	role := auth.Role(r.Context())
	if role == "" {
		role = auth.RoleStateAdmin
	}
	raw, _ := json.Marshal(map[string]string{"action": "BLOOD_REQUEST_REMOVE"})
	_ = h.audit.Audit(r.Context(), contracts.AuditEntry{
		ActorID: actorID, ActorRole: role, Action: "BLOOD_REQUEST_REMOVE",
		Entity: "blood.requests", EntityID: entityID, After: raw,
	})
}

func validBloodGroup(g string) bool {
	switch g {
	case "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-":
		return true
	}
	return false
}
