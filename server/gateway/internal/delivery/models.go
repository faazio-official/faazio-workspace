// Package delivery owns the delivery-partner domain: rider onboarding/KYC, availability,
// road-aware dispatch, multi-stop execution, handover OTP and ratings.
//
// Future service: Go + Postgres (monolith-breakdown.md §1). Writes are service_role only and every
// partner mutation is audited. Live rider coordinates are authoritative in Valkey; Postgres holds
// the durable business state. Phase 5 (payout engine) is explicitly out of scope.
package delivery

import (
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// Vehicle types mirror the delivery_vehicle_type enum.
const (
	VehicleBicycle     = "BICYCLE"
	VehicleTwoWheeler  = "TWO_WHEELER"
	VehicleFourWheeler = "FOUR_WHEELER"
)

// CapacityByVehicle is the hard cap enforced at intake (user decision: bounded by vehicle).
var CapacityByVehicle = map[string]int{
	VehicleBicycle:     1,
	VehicleTwoWheeler:  2,
	VehicleFourWheeler: 5,
}

// Rider statuses mirror delivery_partner_status.
const (
	StatusApplied       = "APPLIED"
	StatusPendingReview = "PENDING_REVIEW"
	StatusVerified      = "VERIFIED"
	StatusActive        = "ACTIVE"
	StatusSuspended     = "SUSPENDED"
	StatusBlacklisted   = "BLACKLISTED"
	StatusRejected      = "REJECTED"
)

// Document statuses mirror delivery_doc_status.
const (
	DocPending           = "PENDING"
	DocVerified          = "VERIFIED"
	DocRejected          = "REJECTED"
	DocReuploadRequested = "REUPLOAD_REQUESTED"
)

// Order statuses mirror delivery_order_status.
const (
	OrderAssigned      = "ASSIGNED"
	OrderAccepted      = "ACCEPTED"
	OrderRejected      = "REJECTED"
	OrderRouteComplete = "ROUTE_COMPLETE"
	OrderCancelled     = "CANCELLED"
)

// Stop statuses mirror delivery_stop_status.
const (
	StopPending    = "PENDING"
	StopAtPickup   = "AT_PICKUP"
	StopPickedUp   = "PICKED_UP"
	StopAtCustomer = "AT_CUSTOMER"
	StopDelivered  = "DELIVERED"
	StopFailed     = "FAILED"
)

// ErrNotFound is returned when a rider/order/stop does not exist.
var ErrNotFound = errors.New("delivery: not found")

// ErrConflict is returned when a mutation is invalid for the current state.
var ErrConflict = errors.New("delivery: state conflict")

// Rider is one delivery.delivery_boys row. Phone is PII and only projected to auth-scoped callers.
type Rider struct {
	RiderID string `json:"riderId"`
	// UserID is the checkout.users identity linked at registration. It is the notification-outbox
	// target and is never projected to a client.
	UserID           string  `json:"-"`
	Phone            string  `json:"phone,omitempty"`
	FullName         string  `json:"fullName"`
	StateCode        string  `json:"stateCode"`
	HubZone          string  `json:"hubZone"`
	Address          string  `json:"address,omitempty"`
	City             string  `json:"city"`
	Pincode          string  `json:"pincode"`
	EmergencyContact string  `json:"emergencyContact,omitempty"`
	VehicleType      string  `json:"vehicleType"`
	MaxCapacity      int     `json:"maxCapacity"`
	Status           string  `json:"status"`
	IsAvailable      bool    `json:"isAvailable"`
	CurrentLoad      int     `json:"currentLoad"`
	Rating           float64 `json:"rating"`
	CompletedOrders  int     `json:"completedOrders"`
	LastHeartbeatAt  string  `json:"lastHeartbeatAt,omitempty"`
	RejectionReason  string  `json:"rejectionReason,omitempty"`
	CreatedAt        string  `json:"createdAt"`
}

// Document is one delivery_documents row. FileKey is a private R2 object key, never a URL.
type Document struct {
	DocID           string `json:"docId"`
	RiderID         string `json:"riderId"`
	DocType         string `json:"docType"`
	FileKey         string `json:"fileKey"`
	AssetID         string `json:"assetId,omitempty"`
	Status          string `json:"status"`
	RejectionReason string `json:"rejectionReason,omitempty"`
	UploadedAt      string `json:"uploadedAt"`
}

// BankAccount is one delivery_bank_accounts row (masked tail only).
type BankAccount struct {
	BankAccountID       string `json:"bankAccountId"`
	RiderID             string `json:"riderId"`
	AccountName         string `json:"accountName"`
	AccountNumberMasked string `json:"accountNumberMasked"`
	IFSC                string `json:"ifsc"`
	ChequeKey           string `json:"chequeKey,omitempty"`
	ChequeAssetID       string `json:"chequeAssetId,omitempty"`
	Status              string `json:"status"`
	RejectionReason     string `json:"rejectionReason,omitempty"`
	CreatedAt           string `json:"createdAt"`
}

// Detail is the admin review projection.
type Detail struct {
	Rider
	Documents   []Document   `json:"documents"`
	BankAccount *BankAccount `json:"bankAccount,omitempty"`
}

// Stop is one delivery_stops row. customer_otp_hash is never projected.
type Stop struct {
	StopID          string   `json:"stopId"`
	DeliveryOrderID string   `json:"deliveryOrderId"`
	Sequence        int      `json:"sequence"`
	StopType        string   `json:"stopType"`
	Status          string   `json:"status"`
	Label           string   `json:"label"`
	Address         string   `json:"address"`
	Latitude        *float64 `json:"latitude,omitempty"`
	Longitude       *float64 `json:"longitude,omitempty"`
	CustomerName    string   `json:"customerName,omitempty"`
	CustomerPhone   string   `json:"customerPhone,omitempty"`
	RequiresOTP     bool     `json:"requiresOtp"`
	FailureReason   string   `json:"failureReason,omitempty"`
	ArrivedAt       string   `json:"arrivedAt,omitempty"`
	CompletedAt     string   `json:"completedAt,omitempty"`
}

// Order is one delivery_orders row plus its ordered stops.
type Order struct {
	OrderID               string          `json:"orderId"`
	CustomerOrderID       string          `json:"customerOrderId"`
	StoreID               string          `json:"storeId"`
	RiderID               string          `json:"riderId"`
	Status                string          `json:"status"`
	RouteSequence         json.RawMessage `json:"routeSequence"`
	TotalDistanceMeters   int64           `json:"totalDistanceMeters"`
	EstimatedDurationSecs int64           `json:"estimatedDurationSeconds"`
	PayoutAmountPaisa     int64           `json:"payoutAmountPaisa"`
	RequireOTP            bool            `json:"requireOtp"`
	AssignedAt            string          `json:"assignedAt"`
	AcceptedAt            string          `json:"acceptedAt,omitempty"`
	ExpiresAt             string          `json:"expiresAt,omitempty"`
	CompletedAt           string          `json:"completedAt,omitempty"`
	CreatedAt             string          `json:"createdAt"`
	Stops                 []Stop          `json:"stops"`
}

// Heartbeat is the Valkey coordinate payload.
type Heartbeat struct {
	RiderID   string  `json:"riderId"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	UpdatedAt string  `json:"updatedAt"`
}

// ApplyRequest is the rider registration payload. Phone is taken from the verified ID token in
// production; the body value is only honoured in AUTH_DISABLED dev mode.
type ApplyRequest struct {
	FullName         string          `json:"fullName"`
	StateCode        string          `json:"stateCode"`
	HubZone          string          `json:"hubZone"`
	Address          string          `json:"address"`
	City             string          `json:"city"`
	Pincode          string          `json:"pincode"`
	EmergencyContact string          `json:"emergencyContact"`
	VehicleType      string          `json:"vehicleType"`
	MaxCapacity      int             `json:"maxCapacity"`
	Phone            string          `json:"phone,omitempty"`
	Documents        []DocumentInput `json:"documents"`
	Bank             BankInput       `json:"bank"`
}

// DocumentInput is one captured document key.
type DocumentInput struct {
	DocType string `json:"docType"`
	FileKey string `json:"fileKey"`
	AssetID string `json:"assetId,omitempty"`
}

// BankInput carries the full account number transiently; only the masked tail is persisted.
type BankInput struct {
	AccountName   string `json:"accountName"`
	AccountNumber string `json:"accountNumber"`
	IFSC          string `json:"ifsc"`
	ChequeKey     string `json:"chequeKey,omitempty"`
	ChequeAssetID string `json:"chequeAssetId,omitempty"`
}

// ListFilter scopes the rider directory.
type ListFilter struct {
	StateCode  string
	Status     string
	Available  bool
	OnlyOnline bool
	Limit      int
}

// CapacityForVehicle returns the hard capacity cap for a vehicle type.
func CapacityForVehicle(vehicle string) (int, bool) {
	cap, ok := CapacityByVehicle[strings.ToUpper(strings.TrimSpace(vehicle))]
	return cap, ok
}

// NormalizePhone returns the E.164 form used as the rider identity (+91XXXXXXXXXX) and ok=false
// when the input is not a valid 10-digit Indian mobile.
func NormalizePhone(raw string) (string, bool) {
	digits := make([]byte, 0, 12)
	for i := 0; i < len(raw); i++ {
		if raw[i] >= '0' && raw[i] <= '9' {
			digits = append(digits, raw[i])
		}
	}
	s := string(digits)
	switch {
	case len(s) == 12 && strings.HasPrefix(s, "91"):
		s = s[2:]
	case len(s) == 10:
	default:
		return "", false
	}
	if s[0] < '6' || s[0] > '9' {
		return "", false
	}
	return "+91" + s, true
}

// requiredDocsFor returns the mandatory document set for a vehicle type.
func requiredDocsFor(vehicle string) []string {
	base := []string{"AADHAAR", "PAN", "SELFIE"}
	if strings.EqualFold(vehicle, VehicleBicycle) {
		return base
	}
	return append(base,
		"DL_FRONT", "DL_BACK", "RC_FRONT", "RC_BACK", "INSURANCE_FRONT", "INSURANCE_BACK")
}

func iso(t *time.Time) string {
	if t == nil || t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}
