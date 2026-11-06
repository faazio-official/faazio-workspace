// Package sellers owns the seller directory + onboarding (sellers.sellers), KYC documents
// (sellers.kyc_documents, private R2 object keys only) and payout accounts (sellers.bank_accounts).
// Future service: Go + Postgres (monolith-breakdown.md §1). Every mutation is audited by the
// handler via contracts.AuditWriter. Writes are service_role only.
package sellers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// ErrNotEditable is returned when a seller tries to edit an application that is not REJECTED.
var ErrNotEditable = errors.New("sellers: application is not editable")

// Seller is one sellers.sellers row (contact_phone is PII — auth/role-scoped only).
// Seller is one sellers.sellers row: the ACCOUNT (brand-agnostic business identity). App brand,
// platform fee, taxonomy category and FSSAI are properties of each vendor (directory.stores), not
// of this row. contact_phone is PII — auth/role-scoped only.
type Seller struct {
	SellerID        string  `json:"sellerId"`
	BusinessName    string  `json:"businessName"`
	OwnerName       string  `json:"ownerName"`
	GSTIN           string  `json:"gstin"`
	PAN             string  `json:"pan"`
	BusinessAddress string  `json:"businessAddress"`
	ContactPhone    string  `json:"contactPhone,omitempty"`
	ContactEmail    string  `json:"contactEmail,omitempty"`
	StateCode       string  `json:"stateCode"`
	DistrictCode    string  `json:"districtCode,omitempty"`
	Status          string  `json:"status"`
	Rating          float64 `json:"rating"`
	// Shop pin captured during onboarding (public business location, not customer PII).
	Latitude         *float64        `json:"latitude,omitempty"`
	Longitude        *float64        `json:"longitude,omitempty"`
	OTPVerified      bool            `json:"otpVerified"`
	OTPVerifiedAt    string          `json:"otpVerifiedAt,omitempty"`
	RejectionReason  string          `json:"rejectionReason,omitempty"`
	RejectionHistory json.RawMessage `json:"rejectionHistory,omitempty"`
	CreatedAt        string          `json:"createdAt"`
	// VendorCount/VendorApps are populated by List (one account can own shops in several apps).
	VendorCount int      `json:"vendorCount,omitempty"`
	VendorApps  []string `json:"vendorApps,omitempty"`
}

// VendorSeed is one VENDOR created alongside an onboarding account. Commercial fields belong to the
// shop and are written to directory.stores.
type VendorSeed struct {
	Name                   string
	App                    string
	StateCode              string
	Address                string
	Phone                  string
	Hours                  string
	Latitude               *float64
	Longitude              *float64
	PlatformFeePct         int
	SellerCategoryID       string
	FSSAINumber            string
	FSSAICertKey           string
	FSSAICertAssetID       string
	DrugLicenseNumber      string
	DrugLicenseCertKey     string
	DrugLicenseCertAssetID string
	// Per-shop payout override (masked account tail only); empty means use the account bank.
	BankName          string
	BankAccountNumber string
	BankIFSC          string
	BankBeneficiary   string
}

// KycDocument is one sellers.kyc_documents row; file_key is a private R2 object key, never a URL.
type KycDocument struct {
	KycID      string `json:"kycId"`
	SellerID   string `json:"sellerId"`
	DocType    string `json:"docType"`
	FileKey    string `json:"fileKey"`
	AssetID    string `json:"assetId,omitempty"`
	Verified   bool   `json:"verified"`
	UploadedAt string `json:"uploadedAt"`
}

// BankAccount is one sellers.bank_accounts row (masked tail only — the full number is never stored).
type BankAccount struct {
	BankAccountID       string `json:"bankAccountId"`
	SellerID            string `json:"sellerId"`
	BankName            string `json:"bankName"`
	AccountNumberMasked string `json:"accountNumberMasked"`
	IFSC                string `json:"ifsc"`
	BeneficiaryName     string `json:"beneficiaryName"`
}

// VerificationLog is one manual PAN/GSTIN/FSSAI/passbook verification decision.
type VerificationLog struct {
	LogID      string `json:"logId"`
	SellerID   string `json:"sellerId"`
	DocType    string `json:"docType"`
	VerifiedBy string `json:"verifiedBy"`
	VerifiedAt string `json:"verifiedAt"`
	Notes      string `json:"notes,omitempty"`
}

// Detail is the admin review projection: the seller plus payout account, documents and log.
// Vendor is one directory.stores row owned by the account. Commercial fields (app brand, platform
// fee, taxonomy category, FSSAI) live here, never on the account.
type Vendor struct {
	StoreID          string `json:"storeId"`
	Name             string `json:"name"`
	App              string `json:"app"`
	IsLive           bool   `json:"isLive"`
	PlatformFeePct   int    `json:"platformFeePct"`
	SellerCategoryID string `json:"sellerCategoryId,omitempty"`
	FSSAINumber      string `json:"fssaiNumber,omitempty"`
	FSSAICertKey     string `json:"fssaiCertKey,omitempty"`
	FSSAICertAssetID string `json:"fssaiCertAssetId,omitempty"`
	StateCode        string `json:"stateCode,omitempty"`
	DistrictCode     string `json:"districtCode,omitempty"`
}

type Detail struct {
	Seller
	BankAccount     *BankAccount      `json:"bankAccount,omitempty"`
	KYCDocuments    []KycDocument     `json:"kycDocuments"`
	VerificationLog []VerificationLog `json:"verificationLog"`
	Vendors         []Vendor          `json:"vendors"`
}

// RequestHistoryEntry is one changed field on a rejected application resubmission.
type RequestHistoryEntry struct {
	HistoryID string `json:"historyId"`
	SellerID  string `json:"sellerId"`
	FieldName string `json:"fieldName"`
	OldValue  string `json:"oldValue"`
	NewValue  string `json:"newValue"`
	ChangedBy string `json:"changedBy"`
	ChangedAt string `json:"changedAt"`
}

// ListFilter narrows List.
type ListFilter struct {
	SellerID     string
	StateCode    string
	DistrictCode string
	Status       string
}

// Repo reads/writes the sellers schema.
type Repo struct {
	pool *db.Pool
}

// New returns a sellers repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// FirstStoreApp returns the app brand of the seller's first vendor. Linked-account provisioning is
// vendor-scoped: an account with no vendor cannot be provisioned.
func (r *Repo) FirstStoreApp(ctx context.Context, sellerID string) (string, error) {
	if r.pool == nil {
		return "", fmt.Errorf("sellers: database not configured")
	}
	var app string
	err := r.pool.QueryRow(ctx, `
		select app::text from directory.stores
		 where seller_id = $1 order by id limit 1`, sellerID).Scan(&app)
	return app, err
}

// ValidCategoryID reports whether id is an active taxonomy.categories row for the given app brand.
func (r *Repo) ValidCategoryID(ctx context.Context, app, id string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("sellers: database not configured")
	}
	var exists bool
	err := r.pool.QueryRow(ctx, `
		select exists(select 1 from taxonomy.categories
		               where id = $1 and app::text = $2 and is_active)`, id, app).Scan(&exists)
	return exists, err
}

const sellerColumns = `seller_id, business_name, owner_name, gstin, pan, address,
	coalesce(phone,''), coalesce(contact_email,''), state_code, coalesce(district_code,''), status::text, rating,
	otp_verified, otp_verified_at, coalesce(rejection_reason,''), rejection_history, created_at,
	latitude, longitude`

const sellerSelect = `select ` + sellerColumns + ` from sellers.sellers`

const bankColumns = `bank_account_id, seller_id, bank_name, account_number_masked, ifsc, beneficiary_name`

// List returns sellers, newest first, optionally scoped.
func (r *Repo) List(ctx context.Context, f ListFilter) ([]Seller, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("sellers: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select `+sellerColumns+`, coalesce(v.vendor_count, 0), coalesce(v.vendor_apps, '{}')
		  from sellers.sellers s
		  left join (
		    select seller_id as vendor_seller_id, count(*)::int as vendor_count,
		           array_agg(distinct app::text) as vendor_apps
		      from directory.stores group by seller_id
		  ) v on v.vendor_seller_id = s.seller_id
		 where ($1 = '' or s.state_code = $1)
		   and ($2 = '' or s.status::text = $2)
		   and ($3 = '' or s.seller_id = $3)
		   and ($4 = '' or s.district_code = $4)
		 order by s.created_at desc`, f.StateCode, f.Status, f.SellerID, f.DistrictCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Seller{}
	for rows.Next() {
		s, err := scanSellerList(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// ByID returns one seller.
func (r *Repo) ByID(ctx context.Context, id string) (Seller, bool, error) {
	if r.pool == nil {
		return Seller{}, false, fmt.Errorf("sellers: database not configured")
	}
	s, err := scanSeller(r.pool.QueryRow(ctx, sellerSelect+` where seller_id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Seller{}, false, nil
		}
		return Seller{}, false, err
	}
	return s, true, nil
}

// DetailByID returns the seller plus its payout account, KYC documents and verification log.
func (r *Repo) DetailByID(ctx context.Context, id string) (Detail, bool, error) {
	s, ok, err := r.ByID(ctx, id)
	if err != nil || !ok {
		return Detail{}, ok, err
	}
	d := Detail{Seller: s, KYCDocuments: []KycDocument{}, VerificationLog: []VerificationLog{}, Vendors: []Vendor{}}
	if vendors, verr := r.Vendors(ctx, id); verr != nil {
		return Detail{}, false, verr
	} else {
		d.Vendors = vendors
	}
	if b, found, berr := r.BankAccount(ctx, id); berr != nil {
		return Detail{}, false, berr
	} else if found {
		d.BankAccount = &b
	}
	if docs, kerr := r.KYC(ctx, id); kerr != nil {
		return Detail{}, false, kerr
	} else {
		d.KYCDocuments = docs
	}
	if logs, lerr := r.VerificationHistory(ctx, id); lerr != nil {
		return Detail{}, false, lerr
	} else {
		d.VerificationLog = logs
	}
	return d, true, nil
}

// Vendors returns every vendor (directory.stores row) owned by the account.
func (r *Repo) Vendors(ctx context.Context, sellerID string) ([]Vendor, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("sellers: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select st.id, st.name, st.app::text, st.is_live, st.platform_fee_pct,
		       coalesce(st.seller_category_id,''), coalesce(st.fssai_number,''),
		       coalesce(st.fssai_cert_key,''), coalesce(st.fssai_cert_asset_id,''),
		       coalesce(st.state_code,''), coalesce(s.district_code,'')
		  from directory.stores st
		  join sellers.sellers s on s.seller_id = st.seller_id
		 where st.seller_id = $1
		 order by st.name`, sellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Vendor{}
	for rows.Next() {
		var v Vendor
		if err := rows.Scan(&v.StoreID, &v.Name, &v.App, &v.IsLive, &v.PlatformFeePct,
			&v.SellerCategoryID, &v.FSSAINumber, &v.FSSAICertKey, &v.FSSAICertAssetID,
			&v.StateCode, &v.DistrictCode); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// Create inserts an onboarding seller (status PENDING_REVIEW) and returns the new row.
func (r *Repo) Create(ctx context.Context, s Seller) (Seller, error) {
	return r.CreateExtended(ctx, s, nil, nil, nil)
}

// CreateExtended inserts the account, payout account, KYC documents and its vendors in one
// transaction. The account row carries no brand/fee/FSSAI: those live on each vendor row.
func (r *Repo) CreateExtended(ctx context.Context, s Seller, bank *BankAccount, docs []KycDocument, vendors []VendorSeed) (Seller, error) {
	if r.pool == nil {
		return Seller{}, fmt.Errorf("sellers: database not configured")
	}
	s.SellerID = "sel-" + shortID()
	var otpAt any
	if s.OTPVerified {
		if s.OTPVerifiedAt == "" {
			otpAt = time.Now().UTC()
		} else if t, err := time.Parse(time.RFC3339, s.OTPVerifiedAt); err == nil {
			otpAt = t
		}
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Seller{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	created, err := scanSeller(tx.QueryRow(ctx, `
		insert into sellers.sellers
		  (seller_id, business_name, owner_name, gstin, pan, address, phone, contact_email,
		   state_code, district_code,
		   otp_verified, otp_verified_at, latitude, longitude)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		returning `+sellerColumns,
		s.SellerID, s.BusinessName, s.OwnerName, s.GSTIN, s.PAN, s.BusinessAddress,
		nullIfEmpty(s.ContactPhone), s.ContactEmail, s.StateCode, nullIfEmpty(s.DistrictCode),
		s.OTPVerified, otpAt, s.Latitude, s.Longitude))
	if err != nil {
		return Seller{}, err
	}
	if bank != nil {
		bank.SellerID = created.SellerID
		if _, err := upsertBank(ctx, tx, *bank); err != nil {
			return Seller{}, err
		}
	}
	for i := range docs {
		docs[i].SellerID = created.SellerID
		if _, err := insertKYC(ctx, tx, docs[i]); err != nil {
			return Seller{}, err
		}
	}
	for _, v := range vendors {
		fee := v.PlatformFeePct
		if fee == 0 {
			fee = 10
		}
		if _, err := tx.Exec(ctx, `
			insert into directory.stores
			  (id, app, name, seller_id, state_code, address, phone, hours, latitude, longitude,
			   platform_fee_pct, seller_category_id, fssai_number, fssai_cert_key, fssai_cert_asset_id,
			   drug_license_number, drug_license_cert_key, drug_license_cert_asset_id,
			   bank_name, bank_account_number, bank_ifsc, bank_beneficiary_name, is_live)
			values ($1, $2::app_brand, $3, $4, nullif($5,''), nullif($6,''), nullif($7,''), nullif($8,''),
			        $9, $10, $11, nullif($12,''), $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, false)`,
			"store-"+shortID(), v.App, v.Name, created.SellerID, v.StateCode, v.Address, v.Phone, v.Hours,
			v.Latitude, v.Longitude, fee, v.SellerCategoryID, v.FSSAINumber, v.FSSAICertKey, v.FSSAICertAssetID,
			v.DrugLicenseNumber, v.DrugLicenseCertKey, v.DrugLicenseCertAssetID,
			v.BankName, v.BankAccountNumber, v.BankIFSC, v.BankBeneficiary); err != nil {
			return Seller{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Seller{}, err
	}
	return created, nil
}

// SetStatus changes a seller's moderation status. Returns ok=false when the seller is absent.
// Approving clears the rejection trail (clean state), per the product rule.
func (r *Repo) SetStatus(ctx context.Context, id, status string) (Seller, bool, error) {
	if r.pool == nil {
		return Seller{}, false, fmt.Errorf("sellers: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Seller{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	s, err := scanSeller(tx.QueryRow(ctx, `
		update sellers.sellers set status = $2::seller_status,
		       rejection_reason = case when $2::seller_status = 'ACTIVE'::seller_status then null else rejection_reason end,
		       rejection_history = case when $2::seller_status = 'ACTIVE'::seller_status then '[]'::jsonb else rejection_history end
		 where seller_id = $1
		 returning `+sellerColumns, id, status))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Seller{}, false, nil
		}
		return Seller{}, false, err
	}
	if status == "ACTIVE" {
		if _, err := tx.Exec(ctx, `delete from sellers.seller_request_history where seller_id=$1`, id); err != nil {
			return Seller{}, false, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Seller{}, false, err
	}
	return s, true, nil
}

// UpdateStorePlatformFee applies a fee to one vendor shop owned by sellerID.
func (r *Repo) UpdateStorePlatformFee(ctx context.Context, sellerID, storeID string, pct int) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("sellers: database not configured")
	}
	tag, err := r.pool.Exec(ctx, `
		update directory.stores set platform_fee_pct = $3, updated_at = now()
		 where id = $1 and seller_id = $2`, storeID, sellerID, pct)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// VerifyDoc marks one KYC document verified and appends an immutable verification log row.
func (r *Repo) VerifyDoc(ctx context.Context, id, docType, verifiedBy, notes string) (bool, error) {
	if r.pool == nil {
		return false, fmt.Errorf("sellers: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		update sellers.kyc_documents set verified = true
		 where seller_id = $1 and doc_type = $2::kyc_doc_type`, id, docType)
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 0 {
		return false, nil
	}
	if _, err := tx.Exec(ctx, `
		insert into sellers.kyc_verification_log (log_id, seller_id, doc_type, verified_by, notes)
		values ($1,$2,$3::kyc_doc_type,$4,$5)`,
		"kyclog-"+shortID(), id, docType, verifiedBy, notes); err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

// Reject marks an application REJECTED and appends the reason to its rejection history.
func (r *Repo) Reject(ctx context.Context, id, reason, adminID string) (Seller, bool, error) {
	if r.pool == nil {
		return Seller{}, false, fmt.Errorf("sellers: database not configured")
	}
	s, err := scanSeller(r.pool.QueryRow(ctx, `
		update sellers.sellers set
		  status = 'REJECTED',
		  rejection_reason = $2,
		  rejection_history = rejection_history || jsonb_build_array(
		    jsonb_build_object('reason', $2::text, 'adminId', $3::text, 'createdAt', now()))
		 where seller_id = $1
		 returning `+sellerColumns, id, reason, adminID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Seller{}, false, nil
		}
		return Seller{}, false, err
	}
	return s, true, nil
}

// EditRequest updates a REJECTED application, records changed fields and resets it to PENDING_REVIEW.
func (r *Repo) EditRequest(ctx context.Context, id string, next Seller, bank *BankAccount, docs []KycDocument, actorID string) (Seller, []RequestHistoryEntry, error) {
	if r.pool == nil {
		return Seller{}, nil, fmt.Errorf("sellers: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Seller{}, nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	before, err := scanSeller(tx.QueryRow(ctx, sellerSelect+` where seller_id=$1 for update`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Seller{}, nil, ErrNotEditable
		}
		return Seller{}, nil, err
	}
	if before.Status != "REJECTED" {
		return Seller{}, nil, ErrNotEditable
	}

	after, err := scanSeller(tx.QueryRow(ctx, `
		update sellers.sellers set
		  business_name=$2, owner_name=$3, gstin=$4, pan=$5,
		  address=$6, phone=$7, contact_email=$8, state_code=$9, district_code=$10,
		  latitude=coalesce($11, latitude), longitude=coalesce($12, longitude),
		  status='PENDING_REVIEW', rejection_reason=null
		 where seller_id=$1
		 returning `+sellerColumns,
		id, next.BusinessName, next.OwnerName, next.GSTIN, next.PAN,
		next.BusinessAddress, nullIfEmpty(next.ContactPhone), next.ContactEmail, next.StateCode,
		nullIfEmpty(next.DistrictCode), next.Latitude, next.Longitude))
	if err != nil {
		return Seller{}, nil, err
	}
	if bank != nil {
		bank.SellerID = id
		if _, err := upsertBank(ctx, tx, *bank); err != nil {
			return Seller{}, nil, err
		}
	}
	for i := range docs {
		docs[i].SellerID = id
		tag, err := tx.Exec(ctx, `
			update sellers.kyc_documents
			   set file_key = $3, asset_id = nullif($4,''), verified = false
			 where seller_id = $1 and doc_type = $2::kyc_doc_type`,
			id, docs[i].DocType, docs[i].FileKey, docs[i].AssetID)
		if err != nil {
			return Seller{}, nil, err
		}
		if tag.RowsAffected() == 0 {
			if _, err := insertKYC(ctx, tx, docs[i]); err != nil {
				return Seller{}, nil, err
			}
		}
	}

	changes := diffFields(before, after)
	entries := make([]RequestHistoryEntry, 0, len(changes))
	for _, c := range changes {
		h := RequestHistoryEntry{
			HistoryID: "reqhist-" + shortID(), SellerID: id, FieldName: c.field,
			OldValue: c.oldValue, NewValue: c.newValue, ChangedBy: actorID,
		}
		var changedAt time.Time
		if err := tx.QueryRow(ctx, `
			insert into sellers.seller_request_history
			  (history_id, seller_id, field_name, old_value, new_value, changed_by)
			values ($1,$2,$3,$4,$5,$6)
			returning changed_at`,
			h.HistoryID, h.SellerID, h.FieldName, h.OldValue, h.NewValue, h.ChangedBy).
			Scan(&changedAt); err != nil {
			return Seller{}, nil, err
		}
		h.ChangedAt = changedAt.UTC().Format(time.RFC3339)
		entries = append(entries, h)
	}
	if err := tx.Commit(ctx); err != nil {
		return Seller{}, nil, err
	}
	return after, entries, nil
}

type fieldChange struct {
	field    string
	oldValue string
	newValue string
}

func diffFields(before, after Seller) []fieldChange {
	pairs := []struct {
		name string
		old  string
		new  string
	}{
		{"businessName", before.BusinessName, after.BusinessName},
		{"ownerName", before.OwnerName, after.OwnerName},
		{"gstin", before.GSTIN, after.GSTIN},
		{"pan", before.PAN, after.PAN},
		{"businessAddress", before.BusinessAddress, after.BusinessAddress},
		{"contactPhone", before.ContactPhone, after.ContactPhone},
		{"contactEmail", before.ContactEmail, after.ContactEmail},
		{"stateCode", before.StateCode, after.StateCode},
		{"districtCode", before.DistrictCode, after.DistrictCode},
	}
	out := []fieldChange{}
	for _, p := range pairs {
		if p.old != p.new {
			out = append(out, fieldChange{field: p.name, oldValue: p.old, newValue: p.new})
		}
	}
	return out
}

// KYC returns a seller's documents, newest first.
func (r *Repo) KYC(ctx context.Context, sellerID string) ([]KycDocument, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("sellers: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select kyc_id, seller_id, doc_type::text, file_key, coalesce(asset_id,''), verified, uploaded_at
		  from sellers.kyc_documents where seller_id = $1 order by uploaded_at desc`, sellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []KycDocument{}
	for rows.Next() {
		var (
			d          KycDocument
			uploadedAt time.Time
		)
		if err := rows.Scan(&d.KycID, &d.SellerID, &d.DocType, &d.FileKey, &d.AssetID, &d.Verified, &uploadedAt); err != nil {
			return nil, err
		}
		d.UploadedAt = uploadedAt.UTC().Format(time.RFC3339)
		out = append(out, d)
	}
	return out, rows.Err()
}

// VerificationHistory returns the manual verification log, newest first.
func (r *Repo) VerificationHistory(ctx context.Context, sellerID string) ([]VerificationLog, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("sellers: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select log_id, seller_id, doc_type::text, verified_by, verified_at, notes
		  from sellers.kyc_verification_log where seller_id=$1 order by verified_at desc`, sellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []VerificationLog{}
	for rows.Next() {
		var (
			l  VerificationLog
			at time.Time
		)
		if err := rows.Scan(&l.LogID, &l.SellerID, &l.DocType, &l.VerifiedBy, &at, &l.Notes); err != nil {
			return nil, err
		}
		l.VerifiedAt = at.UTC().Format(time.RFC3339)
		out = append(out, l)
	}
	return out, rows.Err()
}

// AddKYC records a KYC document (a private R2 object key, never a URL).
func (r *Repo) AddKYC(ctx context.Context, d KycDocument) (KycDocument, error) {
	if r.pool == nil {
		return KycDocument{}, fmt.Errorf("sellers: database not configured")
	}
	return insertKYC(ctx, r.pool, d)
}

type execQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func insertKYC(ctx context.Context, q execQuerier, d KycDocument) (KycDocument, error) {
	d.KycID = "kyc-" + shortID()
	var uploadedAt time.Time
	err := q.QueryRow(ctx, `
		insert into sellers.kyc_documents (kyc_id, seller_id, doc_type, file_key, asset_id)
		values ($1,$2,$3::kyc_doc_type,$4,$5)
		returning verified, uploaded_at`, d.KycID, d.SellerID, d.DocType, d.FileKey, nullIfEmpty(d.AssetID)).
		Scan(&d.Verified, &uploadedAt)
	if err != nil {
		return KycDocument{}, err
	}
	d.UploadedAt = uploadedAt.UTC().Format(time.RFC3339)
	return d, nil
}

// BankAccount returns the seller's current payout account.
func (r *Repo) BankAccount(ctx context.Context, sellerID string) (BankAccount, bool, error) {
	if r.pool == nil {
		return BankAccount{}, false, fmt.Errorf("sellers: database not configured")
	}
	var b BankAccount
	err := r.pool.QueryRow(ctx, `
		select `+bankColumns+` from sellers.bank_accounts where seller_id = $1`, sellerID).
		Scan(&b.BankAccountID, &b.SellerID, &b.BankName, &b.AccountNumberMasked, &b.IFSC, &b.BeneficiaryName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return BankAccount{}, false, nil
		}
		return BankAccount{}, false, err
	}
	return b, true, nil
}

// UpsertBankAccount inserts or replaces the seller's payout account (one per seller).
func (r *Repo) UpsertBankAccount(ctx context.Context, b BankAccount) (BankAccount, error) {
	if r.pool == nil {
		return BankAccount{}, fmt.Errorf("sellers: database not configured")
	}
	return upsertBank(ctx, r.pool, b)
}

func upsertBank(ctx context.Context, q execQuerier, b BankAccount) (BankAccount, error) {
	b.BankAccountID = "bank-" + shortID()
	err := q.QueryRow(ctx, `
		insert into sellers.bank_accounts
		  (bank_account_id, seller_id, bank_name, account_number_masked, ifsc, beneficiary_name)
		values ($1,$2,$3,$4,$5,$6)
		on conflict (seller_id) do update
		  set bank_name = excluded.bank_name,
		      account_number_masked = excluded.account_number_masked,
		      ifsc = excluded.ifsc,
		      beneficiary_name = excluded.beneficiary_name
		returning `+bankColumns,
		b.BankAccountID, b.SellerID, b.BankName, b.AccountNumberMasked, b.IFSC, b.BeneficiaryName).
		Scan(&b.BankAccountID, &b.SellerID, &b.BankName, &b.AccountNumberMasked, &b.IFSC, &b.BeneficiaryName)
	if err != nil {
		return BankAccount{}, err
	}
	return b, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanSeller(row rowScanner) (Seller, error) {
	var (
		s         Seller
		otpAt     *time.Time
		history   []byte
		createdAt time.Time
		lat, lng  *float64
	)
	if err := row.Scan(&s.SellerID, &s.BusinessName, &s.OwnerName, &s.GSTIN, &s.PAN,
		&s.BusinessAddress, &s.ContactPhone, &s.ContactEmail, &s.StateCode, &s.DistrictCode, &s.Status, &s.Rating,
		&s.OTPVerified, &otpAt, &s.RejectionReason, &history, &createdAt,
		&lat, &lng); err != nil {
		return Seller{}, err
	}
	if otpAt != nil {
		s.OTPVerifiedAt = otpAt.UTC().Format(time.RFC3339)
	}
	if len(history) > 0 {
		s.RejectionHistory = json.RawMessage(history)
	} else {
		s.RejectionHistory = json.RawMessage("[]")
	}
	s.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	s.Latitude = lat
	s.Longitude = lng
	return s, nil
}

// scanSellerList decodes the base seller columns plus the aggregated vendor count/apps.
func scanSellerList(row rowScanner) (Seller, error) {
	var (
		s         Seller
		otpAt     *time.Time
		history   []byte
		createdAt time.Time
		lat, lng  *float64
		apps      []string
	)
	if err := row.Scan(&s.SellerID, &s.BusinessName, &s.OwnerName, &s.GSTIN, &s.PAN,
		&s.BusinessAddress, &s.ContactPhone, &s.ContactEmail, &s.StateCode, &s.DistrictCode, &s.Status, &s.Rating,
		&s.OTPVerified, &otpAt, &s.RejectionReason, &history, &createdAt,
		&lat, &lng, &s.VendorCount, &apps); err != nil {
		return Seller{}, err
	}
	if otpAt != nil {
		s.OTPVerifiedAt = otpAt.UTC().Format(time.RFC3339)
	}
	if len(history) > 0 {
		s.RejectionHistory = json.RawMessage(history)
	} else {
		s.RejectionHistory = json.RawMessage("[]")
	}
	s.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	s.Latitude = lat
	s.Longitude = lng
	s.VendorApps = apps
	return s, nil
}

// ErrPendingRequest is returned when a seller already has a PENDING fee-change request.
var ErrPendingRequest = errors.New("sellers: a platform-fee request is already pending")

// FeeChangeRequest is one sellers.seller_fee_change_requests row (joined with the seller's name).
type FeeChangeRequest struct {
	RequestID       string `json:"requestId"`
	SellerID        string `json:"sellerId"`
	StoreID         string `json:"storeId,omitempty"`
	BusinessName    string `json:"businessName,omitempty"`
	DistrictCode    string `json:"districtCode,omitempty"`
	CurrentFeePct   int    `json:"currentFeePct"`
	RequestedFeePct int    `json:"requestedFeePct"`
	Status          string `json:"status"`
	AdminNote       string `json:"adminNote,omitempty"`
	RequestedAt     string `json:"requestedAt"`
	ReviewedBy      string `json:"reviewedBy,omitempty"`
	ReviewedAt      string `json:"reviewedAt,omitempty"`
	ReviewReason    string `json:"reviewReason,omitempty"`
}

const feeRequestColumns = `r.request_id, r.seller_id, coalesce(r.store_id,''), coalesce(s.business_name,''),
	coalesce(r.district_code, coalesce(s.district_code,'')), r.current_fee_pct, r.requested_fee_pct,
	r.status, r.admin_note, r.requested_at, coalesce(r.reviewed_by,''), r.reviewed_at,
	r.review_reason`

func scanFeeRequest(row rowScanner) (FeeChangeRequest, error) {
	var (
		f          FeeChangeRequest
		requested  time.Time
		reviewedAt *time.Time
	)
	if err := row.Scan(&f.RequestID, &f.SellerID, &f.StoreID, &f.BusinessName, &f.DistrictCode,
		&f.CurrentFeePct, &f.RequestedFeePct, &f.Status, &f.AdminNote, &requested,
		&f.ReviewedBy, &reviewedAt, &f.ReviewReason); err != nil {
		return FeeChangeRequest{}, err
	}
	f.RequestedAt = requested.UTC().Format(time.RFC3339)
	if reviewedAt != nil {
		f.ReviewedAt = reviewedAt.UTC().Format(time.RFC3339)
	}
	return f, nil
}

// StoreFeeForSeller returns a vendor store's current platform fee and app brand, only when the store
// is owned by sellerID. ok=false means the store does not exist or is not owned by the caller.
func (r *Repo) StoreFeeForSeller(ctx context.Context, storeID, sellerID string) (feePct int, app string, ok bool, err error) {
	if r.pool == nil {
		return 0, "", false, fmt.Errorf("sellers: database not configured")
	}
	err = r.pool.QueryRow(ctx, `
		select platform_fee_pct, app::text from directory.stores
		 where id = $1 and seller_id = $2`, storeID, sellerID).Scan(&feePct, &app)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, "", false, nil
		}
		return 0, "", false, err
	}
	return feePct, app, true, nil
}

// CreateFeeChangeRequest inserts a PENDING request for a VENDOR (store_id). A second pending row for
// the same store is rejected by the partial unique index and surfaces as ErrPendingRequest.
func (r *Repo) CreateFeeChangeRequest(ctx context.Context, sellerID, storeID, districtCode string, currentPct, requestedPct int) (FeeChangeRequest, error) {
	if r.pool == nil {
		return FeeChangeRequest{}, fmt.Errorf("sellers: database not configured")
	}
	f, err := scanFeeRequest(r.pool.QueryRow(ctx, `
		insert into sellers.seller_fee_change_requests
		  (request_id, seller_id, store_id, district_code, current_fee_pct, requested_fee_pct)
		values ($1,$2,nullif($3,''),$4,$5,$6)
		returning request_id, seller_id, coalesce(store_id,''), '', coalesce(district_code,''), current_fee_pct,
		          requested_fee_pct, status, admin_note, requested_at, coalesce(reviewed_by,''),
		          reviewed_at, review_reason`,
		"fee-"+shortID(), sellerID, storeID, nullIfEmpty(districtCode), currentPct, requestedPct))
	if err != nil {
		if isUniqueViolation(err) {
			return FeeChangeRequest{}, ErrPendingRequest
		}
		return FeeChangeRequest{}, err
	}
	return f, nil
}

// ListFeeChangeRequests returns requests newest first, optionally scoped to a district/state and
// status. The state filter exists for legacy state-scoped admins without a district claim.
func (r *Repo) ListFeeChangeRequests(ctx context.Context, districtCode, stateCode, status string) ([]FeeChangeRequest, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("sellers: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select `+feeRequestColumns+`
		  from sellers.seller_fee_change_requests r
		  join sellers.sellers s on s.seller_id = r.seller_id
		 where ($1 = '' or coalesce(r.district_code, s.district_code) = $1)
		   and ($2 = '' or coalesce(s.state_code,'') = $2)
		   and ($3 = '' or r.status = $3)
		 order by r.requested_at desc
		 limit 200`, districtCode, stateCode, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []FeeChangeRequest{}
	for rows.Next() {
		f, err := scanFeeRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// ListSellerFeeChangeRequests returns one seller's own request history, newest first.
func (r *Repo) ListSellerFeeChangeRequests(ctx context.Context, sellerID string) ([]FeeChangeRequest, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("sellers: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select `+feeRequestColumns+`
		  from sellers.seller_fee_change_requests r
		  join sellers.sellers s on s.seller_id = r.seller_id
		 where r.seller_id = $1
		 order by r.requested_at desc
		 limit 50`, sellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []FeeChangeRequest{}
	for rows.Next() {
		f, err := scanFeeRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// FeeChangeRequestByID returns one request (used to enforce the admin's district scope).
func (r *Repo) FeeChangeRequestByID(ctx context.Context, requestID string) (FeeChangeRequest, bool, error) {
	if r.pool == nil {
		return FeeChangeRequest{}, false, fmt.Errorf("sellers: database not configured")
	}
	f, err := scanFeeRequest(r.pool.QueryRow(ctx, `
		select `+feeRequestColumns+`
		  from sellers.seller_fee_change_requests r
		  join sellers.sellers s on s.seller_id = r.seller_id
		 where r.request_id = $1`, requestID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return FeeChangeRequest{}, false, nil
		}
		return FeeChangeRequest{}, false, err
	}
	return f, true, nil
}

// ApproveFeeChangeRequest applies the requested fee and marks the request APPROVED in one tx.
func (r *Repo) ApproveFeeChangeRequest(ctx context.Context, requestID, reviewer, note string) (Seller, FeeChangeRequest, bool, error) {
	if r.pool == nil {
		return Seller{}, FeeChangeRequest{}, false, fmt.Errorf("sellers: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Seller{}, FeeChangeRequest{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var sellerID string
	var storeID *string
	var requested int
	err = tx.QueryRow(ctx, `
		select seller_id, store_id, requested_fee_pct
		  from sellers.seller_fee_change_requests
		 where request_id = $1 and status = 'PENDING'
		 for update`, requestID).Scan(&sellerID, &storeID, &requested)
	if errors.Is(err, pgx.ErrNoRows) {
		return Seller{}, FeeChangeRequest{}, false, nil
	}
	if err != nil {
		return Seller{}, FeeChangeRequest{}, false, err
	}
	// The fee lives on the VENDOR (directory.stores, 0069/0072). Legacy account-level rows carry no
	// store and cannot be applied to a single shop; they are left PENDING for an explicit review.
	if storeID == nil || *storeID == "" {
		return Seller{}, FeeChangeRequest{}, false, nil
	}
	if _, err := tx.Exec(ctx, `update directory.stores set platform_fee_pct = $2, updated_at = now() where id = $1`, *storeID, requested); err != nil {
		return Seller{}, FeeChangeRequest{}, false, err
	}
	seller, err := scanSeller(tx.QueryRow(ctx, `
		select `+sellerColumns+` from sellers.sellers where seller_id=$1`, sellerID))
	if err != nil {
		return Seller{}, FeeChangeRequest{}, false, err
	}
	req, err := scanFeeRequest(tx.QueryRow(ctx, `
		update sellers.seller_fee_change_requests
		   set status = 'APPROVED', reviewed_by = $2, reviewed_at = now(), review_reason = $3,
		       admin_note = case when $3 = '' then admin_note else $3 end
		 where request_id = $1
		 returning request_id, seller_id, coalesce(store_id,''), '', coalesce(district_code,''), current_fee_pct,
		           requested_fee_pct, status, admin_note, requested_at, coalesce(reviewed_by,''),
		           reviewed_at, review_reason`, requestID, reviewer, note))
	if err != nil {
		return Seller{}, FeeChangeRequest{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Seller{}, FeeChangeRequest{}, false, err
	}
	return seller, req, true, nil
}

// RejectFeeChangeRequest marks a pending request REJECTED with a reason.
func (r *Repo) RejectFeeChangeRequest(ctx context.Context, requestID, reviewer, reason string) (FeeChangeRequest, bool, error) {
	if r.pool == nil {
		return FeeChangeRequest{}, false, fmt.Errorf("sellers: database not configured")
	}
	req, err := scanFeeRequest(r.pool.QueryRow(ctx, `
		update sellers.seller_fee_change_requests
		   set status = 'REJECTED', reviewed_by = $2, reviewed_at = now(), review_reason = $3
		 where request_id = $1 and status = 'PENDING'
		 returning request_id, seller_id, coalesce(store_id,''), '', coalesce(district_code,''), current_fee_pct,
		           requested_fee_pct, status, admin_note, requested_at, coalesce(reviewed_by,''),
		           reviewed_at, review_reason`, requestID, reviewer, reason))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return FeeChangeRequest{}, false, nil
		}
		return FeeChangeRequest{}, false, err
	}
	return req, true, nil
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func isUniqueViolation(err error) bool {
	var pgErr interface{ SQLState() string }
	return errors.As(err, &pgErr) && pgErr.SQLState() == "23505"
}

func nullIfEmpty(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}
