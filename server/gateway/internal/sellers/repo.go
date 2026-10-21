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
	"strconv"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// ErrNotEditable is returned when a seller tries to edit an application that is not REJECTED.
var ErrNotEditable = errors.New("sellers: application is not editable")

// Seller is one sellers.sellers row (contact_phone is PII — auth/role-scoped only).
type Seller struct {
	SellerID        string  `json:"sellerId"`
	BusinessName    string  `json:"businessName"`
	OwnerName       string  `json:"ownerName"`
	Category        string  `json:"category"`
	GSTIN           string  `json:"gstin"`
	PAN             string  `json:"pan"`
	BusinessAddress string  `json:"businessAddress"`
	ContactPhone    string  `json:"contactPhone,omitempty"`
	ContactEmail    string  `json:"contactEmail,omitempty"`
	StateCode       string  `json:"stateCode"`
	Status          string  `json:"status"`
	Rating          float64 `json:"rating"`
	// PlatformFeePct is the commission the platform retains on every split (admin-editable before
	// approval). FOOD sellers have a higher floor (5%).
	PlatformFeePct          int             `json:"platformFeePct"`
	RazorpayLinkedAccountID string          `json:"razorpayLinkedAccountId,omitempty"`
	FSSAINumber             string          `json:"fssaiNumber,omitempty"`
	FSSAICertKey            string          `json:"fssaiCertKey,omitempty"`
	FSSAICertAssetID        string          `json:"fssaiCertAssetId,omitempty"`
	OTPVerified             bool            `json:"otpVerified"`
	OTPVerifiedAt           string          `json:"otpVerifiedAt,omitempty"`
	RejectionReason         string          `json:"rejectionReason,omitempty"`
	RejectionHistory        json.RawMessage `json:"rejectionHistory,omitempty"`
	CreatedAt               string          `json:"createdAt"`
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
type Detail struct {
	Seller
	BankAccount     *BankAccount      `json:"bankAccount,omitempty"`
	KYCDocuments    []KycDocument     `json:"kycDocuments"`
	VerificationLog []VerificationLog `json:"verificationLog"`
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
	SellerID  string
	StateCode string
	Status    string
	Category  string
}

// Repo reads/writes the sellers schema.
type Repo struct {
	pool *db.Pool
}

// New returns a sellers repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

const sellerColumns = `seller_id, business_name, owner_name, category::text, gstin, pan, address,
	coalesce(phone,''), coalesce(contact_email,''), state_code, status::text, rating,
	platform_fee_pct, coalesce(razorpay_linked_account_id,''), coalesce(fssai_number,''),
	coalesce(fssai_cert_key,''), coalesce(fssai_cert_asset_id,''),
	otp_verified, otp_verified_at, coalesce(rejection_reason,''), rejection_history, created_at`

const sellerSelect = `select ` + sellerColumns + ` from sellers.sellers`

const bankColumns = `bank_account_id, seller_id, bank_name, account_number_masked, ifsc, beneficiary_name`

// List returns sellers, newest first, optionally scoped.
func (r *Repo) List(ctx context.Context, f ListFilter) ([]Seller, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("sellers: database not configured")
	}
	rows, err := r.pool.Query(ctx, sellerSelect+`
		 where ($1 = '' or state_code = $1)
		   and ($2 = '' or status::text = $2)
		   and ($3 = '' or category::text = $3)
		   and ($4 = '' or seller_id = $4)
		 order by created_at desc`, f.StateCode, f.Status, f.Category, f.SellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Seller{}
	for rows.Next() {
		s, err := scanSeller(rows)
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
	d := Detail{Seller: s, KYCDocuments: []KycDocument{}, VerificationLog: []VerificationLog{}}
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

// SettlementProfile is the read seam used by settlement when splitting a payment.
func (r *Repo) SettlementProfile(ctx context.Context, sellerID string) (contracts.SellerSettlementProfile, error) {
	if r.pool == nil {
		return contracts.SellerSettlementProfile{}, fmt.Errorf("sellers: database not configured")
	}
	var p contracts.SellerSettlementProfile
	err := r.pool.QueryRow(ctx, `
		select platform_fee_pct, coalesce(razorpay_linked_account_id,'')
		  from sellers.sellers where seller_id=$1`, sellerID).
		Scan(&p.PlatformFeePct, &p.LinkedAccountID)
	return p, err
}

// Create inserts an onboarding seller (status PENDING_REVIEW) and returns the new row.
func (r *Repo) Create(ctx context.Context, s Seller) (Seller, error) {
	return r.CreateExtended(ctx, s, nil, nil)
}

// CreateExtended inserts the seller, payout account and KYC documents in one transaction.
func (r *Repo) CreateExtended(ctx context.Context, s Seller, bank *BankAccount, docs []KycDocument) (Seller, error) {
	if r.pool == nil {
		return Seller{}, fmt.Errorf("sellers: database not configured")
	}
	s.SellerID = "sel-" + shortID()
	if s.PlatformFeePct == 0 {
		s.PlatformFeePct = 10
	}
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
		  (seller_id, business_name, owner_name, category, gstin, pan, address, phone, contact_email,
		   state_code, platform_fee_pct, razorpay_linked_account_id, fssai_number, fssai_cert_key,
		   fssai_cert_asset_id, otp_verified, otp_verified_at)
		values ($1,$2,$3,$4::app_brand,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
		returning `+sellerColumns,
		s.SellerID, s.BusinessName, s.OwnerName, s.Category, s.GSTIN, s.PAN, s.BusinessAddress,
		nullIfEmpty(s.ContactPhone), nullIfEmpty(s.ContactEmail), s.StateCode, s.PlatformFeePct,
		nullIfEmpty(s.RazorpayLinkedAccountID), nullIfEmpty(s.FSSAINumber), nullIfEmpty(s.FSSAICertKey),
		nullIfEmpty(s.FSSAICertAssetID), s.OTPVerified, otpAt))
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

// UpdatePlatformFee sets the commission before approval.
func (r *Repo) UpdatePlatformFee(ctx context.Context, id string, pct int) (Seller, bool, error) {
	if r.pool == nil {
		return Seller{}, false, fmt.Errorf("sellers: database not configured")
	}
	s, err := scanSeller(r.pool.QueryRow(ctx, `
		update sellers.sellers set platform_fee_pct = $2
		 where seller_id = $1
		 returning `+sellerColumns, id, pct))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Seller{}, false, nil
		}
		return Seller{}, false, err
	}
	return s, true, nil
}

// SetLinkedAccount stores the Razorpay Route linked-account id.
func (r *Repo) SetLinkedAccount(ctx context.Context, id, accountID string) (Seller, bool, error) {
	if r.pool == nil {
		return Seller{}, false, fmt.Errorf("sellers: database not configured")
	}
	s, err := scanSeller(r.pool.QueryRow(ctx, `
		update sellers.sellers set razorpay_linked_account_id = $2
		 where seller_id = $1
		 returning `+sellerColumns, id, accountID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Seller{}, false, nil
		}
		return Seller{}, false, err
	}
	return s, true, nil
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
		  business_name=$2, owner_name=$3, category=$4::app_brand, gstin=$5, pan=$6,
		  address=$7, phone=$8, contact_email=$9, state_code=$10, platform_fee_pct=$11,
		  fssai_number=$12,
		  fssai_cert_key=coalesce(nullif($13,''), fssai_cert_key),
		  fssai_cert_asset_id=coalesce(nullif($14,''), fssai_cert_asset_id),
		  status='PENDING_REVIEW', rejection_reason=null
		 where seller_id=$1
		 returning `+sellerColumns,
		id, next.BusinessName, next.OwnerName, next.Category, next.GSTIN, next.PAN,
		next.BusinessAddress, nullIfEmpty(next.ContactPhone), nullIfEmpty(next.ContactEmail), next.StateCode,
		next.PlatformFeePct, nullIfEmpty(next.FSSAINumber), next.FSSAICertKey, next.FSSAICertAssetID))
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
		{"category", before.Category, after.Category},
		{"gstin", before.GSTIN, after.GSTIN},
		{"pan", before.PAN, after.PAN},
		{"businessAddress", before.BusinessAddress, after.BusinessAddress},
		{"contactPhone", before.ContactPhone, after.ContactPhone},
		{"contactEmail", before.ContactEmail, after.ContactEmail},
		{"stateCode", before.StateCode, after.StateCode},
		{"platformFeePct", strconv.Itoa(before.PlatformFeePct), strconv.Itoa(after.PlatformFeePct)},
		{"fssaiNumber", before.FSSAINumber, after.FSSAINumber},
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
	)
	if err := row.Scan(&s.SellerID, &s.BusinessName, &s.OwnerName, &s.Category, &s.GSTIN, &s.PAN,
		&s.BusinessAddress, &s.ContactPhone, &s.ContactEmail, &s.StateCode, &s.Status, &s.Rating,
		&s.PlatformFeePct, &s.RazorpayLinkedAccountID, &s.FSSAINumber, &s.FSSAICertKey,
		&s.FSSAICertAssetID, &s.OTPVerified, &otpAt, &s.RejectionReason, &history, &createdAt); err != nil {
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
	return s, nil
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func nullIfEmpty(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}
