package sellers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/geo"
	"github.com/faazio/server/gateway/internal/platform/httpx"
)

// Seller leads are the landing page's public "Sell with us" enquiries (/sell-with-us). They are
// deliberately NOT seller accounts: no PAN, bank, passbook or OTP, so they never touch
// sellers.sellers (whose create path is auth-gated and KYC-complete). An admin follows a lead up and
// the merchant completes onboarding in the mobile app (`SellWithUs` → POST /sellers).
//
// The write is unauthenticated, so it is hardened instead: a honeypot field, a per-IP daily counter
// (Valkey, fail-open), strict field validation and a district resolved against the server master.

const (
	// maxLeadsPerIPPerDay caps one submitter per UTC day. A real merchant submits once.
	maxLeadsPerIPPerDay = 5
	leadFieldMax        = 160
	leadAddressMax      = 500
	leadNotesMax        = 500
	leadPhoneMax        = 20
)

// Lead is one sellers.seller_leads row.
type Lead struct {
	LeadID          string   `json:"leadId"`
	BusinessName    string   `json:"businessName"`
	OwnerName       string   `json:"ownerName"`
	Category        string   `json:"category"`
	ContactPhone    string   `json:"contactPhone"`
	ContactEmail    string   `json:"contactEmail"`
	BusinessAddress string   `json:"businessAddress"`
	StateCode       string   `json:"stateCode"`
	DistrictCode    string   `json:"districtCode"`
	StateName       string   `json:"stateName"`
	DistrictName    string   `json:"districtName"`
	Latitude        *float64 `json:"latitude"`
	Longitude       *float64 `json:"longitude"`
	PlatformFeePct  *int     `json:"platformFeePct"`
	Notes           string   `json:"notes"`
	Status          string   `json:"status"`
	Source          string   `json:"source"`
	// IPHash is never serialized: it is an internal abuse trail, not operator data.
	IPHash string `json:"-"`
	// AdminNote is the operator's follow-up note / the reason a lead was rejected (0112).
	AdminNote string `json:"adminNote"`
	// ReviewedBy is the admin who last moved the status; empty while the lead is NEW.
	ReviewedBy string `json:"reviewedBy"`
	// ReviewedAt is the RFC3339 timestamp of that move; empty while the lead is NEW.
	ReviewedAt string `json:"reviewedAt"`
	// AssignedTo is the admin who claimed the call-back; empty = unclaimed (0113).
	AssignedTo string `json:"assignedTo"`
	// AssignedAt is the RFC3339 timestamp of that claim; empty while unclaimed.
	AssignedAt string `json:"assignedAt"`
	// SellerID is the application this lead became, back-filled when the merchant applies (0113).
	// Empty means they have not applied yet.
	SellerID  string    `json:"sellerId"`
	CreatedAt time.Time `json:"createdAt"`
}

type createLeadRequest struct {
	BusinessName    string   `json:"businessName"`
	OwnerName       string   `json:"ownerName"`
	Category        string   `json:"category"`
	ContactPhone    string   `json:"contactPhone"`
	ContactEmail    string   `json:"contactEmail"`
	BusinessAddress string   `json:"businessAddress"`
	StateCode       string   `json:"stateCode"`
	DistrictCode    string   `json:"districtCode"`
	StateName       string   `json:"stateName"`
	DistrictName    string   `json:"districtName"`
	Latitude        *float64 `json:"latitude"`
	Longitude       *float64 `json:"longitude"`
	PlatformFeePct  *int     `json:"platformFeePct"`
	Notes           string   `json:"notes"`
	// Source is accepted for wire-compatibility only. The landing page deliberately does NOT send it
	// (client/web/landingpage/src/lib/leads.ts treats provenance as server-owned), but an older cached
	// client bundle may still include it, and httpx.Decode rejects unknown fields — so declaring it
	// keeps those requests from 400ing. The value is never read: createLead always stamps the
	// server-owned provenance below, so a caller cannot forge where a lead came from.
	Source string `json:"source"`
	// Website is the honeypot: a real visitor never sees or fills it. A non-empty value is treated as
	// a bot and accepted silently, so a scraper learns nothing.
	Website string `json:"website"`
}

// CreateLead inserts a lead row and returns it.
func (r *Repo) CreateLead(ctx context.Context, l Lead) (Lead, error) {
	if r.pool == nil {
		return Lead{}, fmt.Errorf("sellers: database not configured")
	}
	l.LeadID = "lead-" + leadID()
	err := r.pool.QueryRow(ctx, `
		insert into sellers.seller_leads
		  (lead_id, business_name, owner_name, category, contact_phone, contact_email,
		   business_address, state_code, district_code, state_name, district_name,
		   latitude, longitude, platform_fee_pct, notes, status, source, ip_hash)
		values ($1,$2,$3,$4::app_brand,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'NEW',$16,$17)
		returning created_at`,
		l.LeadID, l.BusinessName, l.OwnerName, l.Category, l.ContactPhone, l.ContactEmail,
		l.BusinessAddress, nullIfEmpty(l.StateCode), nullIfEmpty(l.DistrictCode),
		l.StateName, l.DistrictName, l.Latitude, l.Longitude, l.PlatformFeePct,
		l.Notes, l.Source, l.IPHash).Scan(&l.CreatedAt)
	if err != nil {
		return Lead{}, err
	}
	return l, nil
}

// createLead accepts a public "Sell with us" enquiry. No auth: the landing page is open to visitors.
func (h *Handler) createLead(w http.ResponseWriter, r *http.Request) {
	var req createLeadRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	// Honeypot: silently accept so a bot cannot tell it was dropped.
	if strings.TrimSpace(req.Website) != "" {
		httpx.JSON(w, http.StatusCreated, map[string]string{"status": "NEW"})
		return
	}

	req.BusinessName = strings.TrimSpace(req.BusinessName)
	req.OwnerName = strings.TrimSpace(req.OwnerName)
	req.Category = strings.ToUpper(strings.TrimSpace(req.Category))
	req.ContactPhone = strings.TrimSpace(req.ContactPhone)
	req.ContactEmail = strings.TrimSpace(req.ContactEmail)
	req.BusinessAddress = strings.TrimSpace(req.BusinessAddress)
	req.StateCode = strings.ToUpper(strings.TrimSpace(req.StateCode))
	req.DistrictCode = geo.Normalise(req.DistrictCode)
	req.StateName = strings.TrimSpace(req.StateName)
	req.DistrictName = strings.TrimSpace(req.DistrictName)
	req.Notes = strings.TrimSpace(req.Notes)

	if req.BusinessName == "" || len(req.BusinessName) > leadFieldMax {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "business name is required")
		return
	}
	if req.OwnerName == "" || len(req.OwnerName) > leadFieldMax {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "owner name is required")
		return
	}
	if !validCategory(req.Category) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "category must be MART, FOOD or PHARMA")
		return
	}
	if len(digitsOnly(req.ContactPhone)) < 10 || len(req.ContactPhone) > leadPhoneMax {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a valid contact phone is required")
		return
	}
	if !validEmailAddress(req.ContactEmail) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a valid contact email is required")
		return
	}
	if len(req.BusinessAddress) < 5 || len(req.BusinessAddress) > leadAddressMax {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a shop address is required")
		return
	}
	if req.DistrictCode == "" && req.DistrictName == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a district is required")
		return
	}
	if len(req.Notes) > leadNotesMax {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "notes are too long")
		return
	}
	if !validLatLng(req.Latitude, req.Longitude) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "shop location is invalid")
		return
	}
	if req.PlatformFeePct != nil {
		if !validPlatformFee(req.Category, *req.PlatformFeePct) {
			httpx.Fail(w, http.StatusBadRequest, "bad_request", "platform fee is outside the allowed range")
			return
		}
	}

	// Resolve the district against the server master. An explicit valid code wins; otherwise the
	// submitted district name is matched (case-insensitive) so the map picker's reverse-geocoded
	// address needs no lookup table on the client. An unresolved name is kept as text for the admin.
	stateCode, districtCode, stateName, districtName := resolveLeadDistrict(req)
	if req.DistrictCode != "" && districtCode == "" {
		httpx.Fail(w, http.StatusBadRequest, "unknown_district", "unknown district code")
		return
	}

	ipHash := shortHash(clientIP(r))
	day := time.Now().UTC().Format("20060102")
	if n, err := h.cache.Incr(r.Context(), cache.SellerLeadRate(ipHash, day), cache.TTLSellerLeadRate); err == nil && n > maxLeadsPerIPPerDay {
		httpx.Fail(w, http.StatusTooManyRequests, "rate_limited", "too many enquiries from this connection today")
		return
	}

	created, err := h.repo.CreateLead(r.Context(), Lead{
		BusinessName: req.BusinessName, OwnerName: req.OwnerName, Category: req.Category,
		ContactPhone: req.ContactPhone, ContactEmail: req.ContactEmail,
		BusinessAddress: req.BusinessAddress, StateCode: stateCode, DistrictCode: districtCode,
		StateName: stateName, DistrictName: districtName,
		Latitude: req.Latitude, Longitude: req.Longitude,
		PlatformFeePct: req.PlatformFeePct, Notes: req.Notes,
		Status: "NEW", Source: "web", IPHash: ipHash,
	})
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "lead_unavailable", "could not record your enquiry")
		return
	}
	// No admins.audit_logs row: the actor is an anonymous visitor and that table's actor_role check
	// only accepts seller/admin roles. The lead row itself (with the IP hash) is the trail.
	httpx.JSON(w, http.StatusCreated, map[string]string{"leadId": created.LeadID, "status": created.Status})
}

// resolveLeadDistrict returns the canonical state/district codes plus the display names.
func resolveLeadDistrict(req createLeadRequest) (stateCode, districtCode, stateName, districtName string) {
	districtName = req.DistrictName
	if req.DistrictCode != "" && geo.IsValid(req.DistrictCode) {
		return geo.StateForDistrict(req.DistrictCode), req.DistrictCode, req.StateName, geo.Name(req.DistrictCode)
	}
	if req.DistrictName != "" {
		want := strings.ToLower(req.DistrictName)
		for _, d := range geo.All() {
			if strings.ToLower(d.Name) == want {
				return d.StateCode, d.Code, req.StateName, d.Name
			}
		}
	}
	return req.StateCode, "", req.StateName, districtName
}

func leadID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
