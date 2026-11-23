package sellers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
	"github.com/faazio/server/gateway/internal/platform/geo"
	"github.com/faazio/server/gateway/internal/platform/httpx"
)

// A web enquiry and an app application are the same merchant at two depths of one funnel, so they now
// share ONE row in sellers.sellers (0129). A public "Sell with us" submission creates the row with
// status INQUIRY and source 'web'; the merchant completing onboarding in the app (POST /sellers) is
// matched on contact phone/email and PROMOTES that same row to PENDING_REVIEW with source 'app'.
//
// The write stays unauthenticated, so it is hardened instead: a honeypot, a per-IP daily counter
// (Valkey, fail-open), strict validation, a district resolved against the server master, and shop
// photos that must be AVIF drafts the caller uploaded (claimed inside the insert transaction).

const (
	// maxInquiriesPerIPPerDay caps one submitter per UTC day. A real merchant submits once.
	maxInquiriesPerIPPerDay = 5
	inquiryFieldMax         = 160
	inquiryAddressMax       = 500
	inquiryNotesMax         = 500
	inquiryPhoneMax         = 20
	// maxShopPhotos bounds the public gallery a single enquiry may attach.
	maxShopPhotos = 5
)

// stateCodePattern is the ISO 3166-2:IN shape (two uppercase letters) for a client-supplied state
// code. The landing page resolves it from the district master; a malformed one is a client bug, not an
// enquiry, so it is rejected rather than silently dropped.
var stateCodePattern = regexp.MustCompile(`^[A-Z]{2}$`)

// ShopPhoto is one public shop-front image on an enquiry: the media registry id plus its object key.
type ShopPhoto struct {
	AssetID string `json:"assetId"`
	Key     string `json:"key"`
	URL     string `json:"url,omitempty"`
}

type createInquiryRequest struct {
	BusinessName    string `json:"businessName"`
	OwnerName       string `json:"ownerName"`
	Category        string `json:"category"`
	ContactPhone    string `json:"contactPhone"`
	ContactEmail    string `json:"contactEmail"`
	BusinessAddress string `json:"businessAddress"`
	StateCode       string `json:"stateCode"`
	DistrictCode    string `json:"districtCode"`
	// DistrictPlaceID is the Google place_id of the district's administrative_area_level_3
	// component, as reverse-geocoded by the landing page from the visitor's shared location. It is
	// the preferred join (see resolveInquiryDistrict): a place_id cannot be misspelled or renamed the
	// way a district name can ("Bengaluru" vs "Bangalore"). Name matching stays as the fallback for
	// older cached bundles and for districts Google cannot resolve.
	DistrictPlaceID string   `json:"districtPlaceId"`
	StateName       string   `json:"stateName"`
	DistrictName    string   `json:"districtName"`
	Latitude        *float64 `json:"latitude"`
	Longitude       *float64 `json:"longitude"`
	PlatformFeePct  *int     `json:"platformFeePct"`
	Notes           string   `json:"notes"`
	// ShopPhotoIDs are media ids returned by POST /media/avif (unclaimed PUBLIC AVIF drafts). At
	// least one is required: a shop with no picture is not reviewable.
	ShopPhotoIDs []string `json:"shopPhotoIds"`
	// Website is the honeypot: a real visitor never sees or fills it. A non-empty value is treated as
	// a bot and accepted silently, so a scraper learns nothing.
	Website string `json:"website"`
}

// CreateInquiry inserts an INQUIRY seller row plus its claimed shop photos in one transaction.
//
// The caller has already validated the fields and resolved the district; this only owns the SQL. The
// photos are claimed through the media contract so the row is never written pointing at an asset the
// submitter did not upload.
func (r *Repo) CreateInquiry(ctx context.Context, s Seller, inquiryCategory string, feePct *int, notes string, photoIDs []string, photos contracts.PhotoClaimer) (Seller, []string, error) {
	if r.pool == nil {
		return Seller{}, nil, fmt.Errorf("sellers: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Seller{}, nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	s.SellerID = "sel-" + shortID()
	s.Status = "INQUIRY"
	s.Source = "web"
	created, err := scanSeller(tx.QueryRow(ctx, `
		insert into sellers.sellers
		  (seller_id, business_name, owner_name, address, phone, contact_email,
		   state_code, district_code, latitude, longitude, status, source,
		   inquiry_category, inquiry_platform_fee_pct, inquiry_notes)
		values ($1,$2,$3,$4,nullif($5,''),$6,$7,nullif($8,''),$9,$10,'INQUIRY'::seller_status,'web',
		        $11::app_brand,$12,$13)
		returning `+sellerColumns,
		s.SellerID, s.BusinessName, s.OwnerName, s.BusinessAddress, s.ContactPhone, s.ContactEmail,
		s.StateCode, s.DistrictCode, s.Latitude, s.Longitude,
		nullIfEmpty(inquiryCategory), feePct, nullIfEmpty(notes)))
	if err != nil {
		if isUniqueViolation(err) {
			return Seller{}, nil, ErrEmailTaken
		}
		return Seller{}, nil, err
	}
	keys, err := claimShopPhotos(ctx, tx, photos, photoIDs, created.SellerID)
	if err != nil {
		return Seller{}, nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Seller{}, nil, err
	}
	return created, keys, nil
}

// claimShopPhotos promotes the submitted drafts to ACTIVE and records them on the seller row. It is
// shared by the web inquiry and the app application so both attach photos the same way.
func claimShopPhotos(ctx context.Context, q contracts.Querier, claimer contracts.PhotoClaimer, ids []string, sellerID string) ([]string, error) {
	if len(ids) == 0 || claimer == nil {
		return nil, nil
	}
	return claimer.Claim(ctx, q, ids, "SHOP", sellerID)
}

// createInquiry accepts a public "Sell with us" enquiry. No auth: the landing page is open to visitors.
func (h *Handler) createInquiry(w http.ResponseWriter, r *http.Request) {
	var req createInquiryRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	// Honeypot: silently accept so a bot cannot tell it was dropped.
	if strings.TrimSpace(req.Website) != "" {
		httpx.JSON(w, http.StatusCreated, map[string]string{"status": "INQUIRY"})
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
	req.DistrictPlaceID = strings.TrimSpace(req.DistrictPlaceID)
	req.StateName = strings.TrimSpace(req.StateName)
	req.DistrictName = strings.TrimSpace(req.DistrictName)
	req.Notes = strings.TrimSpace(req.Notes)

	if req.BusinessName == "" || len(req.BusinessName) > inquiryFieldMax {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "business name is required")
		return
	}
	if req.OwnerName == "" || len(req.OwnerName) > inquiryFieldMax {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "owner name is required")
		return
	}
	if !validCategory(req.Category) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "category must be MART, FOOD or PHARMA")
		return
	}
	if len(digitsOnly(req.ContactPhone)) < 10 || len(req.ContactPhone) > inquiryPhoneMax {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a valid contact phone is required")
		return
	}
	if !validEmailAddress(req.ContactEmail) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a valid contact email is required")
		return
	}
	if len(req.BusinessAddress) < 5 || len(req.BusinessAddress) > inquiryAddressMax {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a shop address is required")
		return
	}
	if req.DistrictCode == "" && req.DistrictName == "" && req.DistrictPlaceID == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a district is required")
		return
	}
	if len(req.Notes) > inquiryNotesMax {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "notes are too long")
		return
	}
	if req.StateCode != "" && !stateCodePattern.MatchString(req.StateCode) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "state code must be a 2-letter code")
		return
	}
	if !validLatLng(req.Latitude, req.Longitude) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "shop location is invalid")
		return
	}
	// The platform fee is required: it is the number the partner team opens the call-back with, and an
	// enquiry without one forces a second conversation. The range follows the product rule (1–100,
	// 5–100 for FOOD), the same rule the mobile application applies.
	if req.PlatformFeePct == nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a platform fee is required")
		return
	}
	if !validPlatformFee(req.Category, *req.PlatformFeePct) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "platform fee is outside the allowed range")
		return
	}
	// At least one shop picture, at most maxShopPhotos. Each id must be a draft the caller uploaded;
	// the claim inside CreateInquiry enforces that, but rejecting the obvious cases here gives a
	// clearer error than a rolled-back transaction.
	photoIDs := dedupeIDs(req.ShopPhotoIDs)
	if len(photoIDs) == 0 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "at least one shop picture is required")
		return
	}
	if len(photoIDs) > maxShopPhotos {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "at most 5 shop pictures")
		return
	}

	// Resolve the district against the server master. An explicit valid code wins; otherwise the
	// submitted district name is matched (case-insensitive) so the map picker's reverse-geocoded
	// address needs no lookup table on the client. An unresolved name is kept as text for the admin.
	stateCode, districtCode, _, _ := resolveInquiryDistrict(req)
	if req.DistrictCode != "" && districtCode == "" {
		httpx.Fail(w, http.StatusBadRequest, "unknown_district", "unknown district code")
		return
	}
	// sellers.sellers.state_code is NOT NULL. A pin outside the seeded master still resolves to a
	// state when the client sent one; otherwise the enquiry is refused rather than guessed.
	if stateCode == "" {
		if req.StateCode != "" {
			stateCode = req.StateCode
		} else {
			httpx.Fail(w, http.StatusBadRequest, "unknown_district", "we could not resolve the shop's state")
			return
		}
	}

	ipHash := shortHash(clientIP(r))
	day := time.Now().UTC().Format("20060102")
	if n, err := h.cache.Incr(r.Context(), cache.SellerInquiryRate(ipHash, day), cache.TTLSellerInquiryRate); err == nil && n > maxInquiriesPerIPPerDay {
		httpx.Fail(w, http.StatusTooManyRequests, "rate_limited", "too many enquiries from this connection today")
		return
	}

	created, keys, err := h.repo.CreateInquiry(r.Context(), Seller{
		BusinessName: req.BusinessName, OwnerName: req.OwnerName,
		ContactPhone: req.ContactPhone, ContactEmail: req.ContactEmail,
		BusinessAddress: req.BusinessAddress, StateCode: stateCode, DistrictCode: districtCode,
		Latitude: req.Latitude, Longitude: req.Longitude,
	}, req.Category, req.PlatformFeePct, req.Notes, photoIDs, h.photos)
	if err != nil {
		if isUniqueViolation(err) || err == ErrEmailTaken {
			httpx.Fail(w, http.StatusConflict, "duplicate_inquiry",
				"an enquiry with this email already exists — our team will call you")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "inquiry_unavailable", "could not record your enquiry")
		return
	}
	// No admins.audit_logs row: the actor is an anonymous visitor and that table's actor_role check
	// only accepts seller/admin roles. The row itself (with the IP hash) is the trail.
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"sellerId":   created.SellerID,
		"status":     created.Status,
		"shopPhotos": keys,
	})
}

// resolveInquiryDistrict returns the canonical state/district codes plus the display names.
//
// Order of preference, strongest identity first:
//  1. districtPlaceId — the Google place_id of the administrative_area_level_3 the visitor's shared
//     location reverse-geocoded to. This is the durable join: it is immune to the spelling and rename
//     drift that breaks name matching (e.g. "Bengaluru" vs "Bangalore", "Mahé" vs "Mahe"), and it is
//     what the landing page sends once "Use my current location" has run.
//  2. An explicit, valid districtCode (a caller that already speaks codes).
//  3. The submitted district name, matched case-insensitively — the fallback for an older cached
//     bundle (which sends no place_id) and for a district Google cannot resolve.
//
// An unresolved name/place_id is still accepted and kept as text, so a visitor in a district outside
// the seeded master is never rejected — the admin following up can still read where the shop is.
func resolveInquiryDistrict(req createInquiryRequest) (stateCode, districtCode, stateName, districtName string) {
	districtName = req.DistrictName
	stateName = req.StateName

	if req.DistrictPlaceID != "" {
		if d, ok := geo.ByPlaceID(req.DistrictPlaceID); ok {
			return d.StateCode, d.Code, stateName, d.Name
		}
	}
	if req.DistrictCode != "" && geo.IsValid(req.DistrictCode) {
		return geo.StateForDistrict(req.DistrictCode), req.DistrictCode, stateName, geo.Name(req.DistrictCode)
	}
	if req.DistrictName != "" {
		want := strings.ToLower(strings.TrimSpace(req.DistrictName))
		for _, d := range geo.All() {
			if strings.ToLower(d.Name) == want {
				return d.StateCode, d.Code, stateName, d.Name
			}
		}
	}
	return req.StateCode, "", stateName, districtName
}

func inquiryID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func dedupeIDs(ids []string) []string {
	out := make([]string, 0, len(ids))
	seen := map[string]struct{}{}
	for _, raw := range ids {
		id := strings.TrimSpace(raw)
		if id == "" {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

// inquiryDistrict is one active row of the district master as the public enquiry form reads it.
type inquiryDistrict struct {
	DistrictCode string `json:"districtCode"`
	Name         string `json:"name"`
	StateCode    string `json:"stateCode"`
}

// inquiryDistricts serves the active district master to the anonymous enquiry form, so the page can
// send the canonical `stateCode`/`districtCode` alongside the reverse-geocoded name instead of leaving
// the gateway to re-match a label. It answers from the in-process geo mirror (no DB round-trip, no
// auth) and carries no PII: it is the same picker projection `GET /geo/districts` returns, minus the
// login.
func (h *Handler) inquiryDistricts(w http.ResponseWriter, r *http.Request) {
	all := geo.All()
	out := make([]inquiryDistrict, 0, len(all))
	for _, d := range all {
		if !d.Active {
			continue
		}
		out = append(out, inquiryDistrict{DistrictCode: d.Code, Name: d.Name, StateCode: d.StateCode})
	}
	// Public reference data changes only when an admin edits the master; a short shared cache keeps
	// the form snappy without serving a deactivated district for long.
	w.Header().Set("Cache-Control", "public, max-age=300")
	httpx.JSON(w, http.StatusOK, out)
}
