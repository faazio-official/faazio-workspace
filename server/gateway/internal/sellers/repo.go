// Package sellers owns the seller directory + onboarding (sellers.sellers), KYC documents
// (sellers.kyc_documents, Storage object keys only) and payout accounts (sellers.bank_accounts).
// Future service: Go + Postgres (monolith-breakdown.md §1). Every mutation is audited by the
// handler via contracts.AuditWriter. Writes are service_role only.
package sellers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

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
	StateCode       string  `json:"stateCode"`
	Status          string  `json:"status"`
	Rating          float64 `json:"rating"`
	CreatedAt       string  `json:"createdAt"`
}

// KycDocument is one sellers.kyc_documents row; file_key is a Storage object key, never a URL.
type KycDocument struct {
	KycID      string `json:"kycId"`
	SellerID   string `json:"sellerId"`
	DocType    string `json:"docType"`
	FileKey    string `json:"fileKey"`
	Verified   bool   `json:"verified"`
	UploadedAt string `json:"uploadedAt"`
}

// BankAccount is one sellers.bank_accounts row (masked tail only).
type BankAccount struct {
	BankAccountID       string `json:"bankAccountId"`
	SellerID            string `json:"sellerId"`
	AccountNumberMasked string `json:"accountNumberMasked"`
	IFSC                string `json:"ifsc"`
	BeneficiaryName     string `json:"beneficiaryName"`
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

const sellerSelect = `
	select seller_id, business_name, owner_name, category::text, gstin, pan, address,
	       coalesce(phone,''), state_code, status::text, rating, created_at
	  from sellers.sellers`

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

// Create inserts an onboarding seller (status PENDING_REVIEW) and returns the new row.
func (r *Repo) Create(ctx context.Context, s Seller) (Seller, error) {
	if r.pool == nil {
		return Seller{}, fmt.Errorf("sellers: database not configured")
	}
	s.SellerID = "sel-" + shortID()
	var createdAt time.Time
	err := r.pool.QueryRow(ctx, `
		insert into sellers.sellers
		  (seller_id, business_name, owner_name, category, gstin, pan, address, phone, state_code)
		values ($1,$2,$3,$4::app_brand,$5,$6,$7,$8,$9)
		returning status::text, rating, created_at`,
		s.SellerID, s.BusinessName, s.OwnerName, s.Category, s.GSTIN, s.PAN, s.BusinessAddress,
		nullIfEmpty(s.ContactPhone), s.StateCode).
		Scan(&s.Status, &s.Rating, &createdAt)
	if err != nil {
		return Seller{}, err
	}
	s.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return s, nil
}

// SetStatus changes a seller's moderation status. Returns ok=false when the seller is absent.
func (r *Repo) SetStatus(ctx context.Context, id, status string) (Seller, bool, error) {
	if r.pool == nil {
		return Seller{}, false, fmt.Errorf("sellers: database not configured")
	}
	s, err := scanSeller(r.pool.QueryRow(ctx, `
		update sellers.sellers set status = $2::seller_status
		 where seller_id = $1
		 returning seller_id, business_name, owner_name, category::text, gstin, pan, address,
		           coalesce(phone,''), state_code, status::text, rating, created_at`, id, status))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Seller{}, false, nil
		}
		return Seller{}, false, err
	}
	return s, true, nil
}

// KYC returns a seller's documents, newest first.
func (r *Repo) KYC(ctx context.Context, sellerID string) ([]KycDocument, error) {
	if r.pool == nil {
		return nil, fmt.Errorf("sellers: database not configured")
	}
	rows, err := r.pool.Query(ctx, `
		select kyc_id, seller_id, doc_type::text, file_key, verified, uploaded_at
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
		if err := rows.Scan(&d.KycID, &d.SellerID, &d.DocType, &d.FileKey, &d.Verified, &uploadedAt); err != nil {
			return nil, err
		}
		d.UploadedAt = uploadedAt.UTC().Format(time.RFC3339)
		out = append(out, d)
	}
	return out, rows.Err()
}

// AddKYC records a KYC document (a Storage object key, never a URL).
func (r *Repo) AddKYC(ctx context.Context, d KycDocument) (KycDocument, error) {
	if r.pool == nil {
		return KycDocument{}, fmt.Errorf("sellers: database not configured")
	}
	d.KycID = "kyc-" + shortID()
	var uploadedAt time.Time
	err := r.pool.QueryRow(ctx, `
		insert into sellers.kyc_documents (kyc_id, seller_id, doc_type, file_key)
		values ($1,$2,$3::kyc_doc_type,$4)
		returning verified, uploaded_at`, d.KycID, d.SellerID, d.DocType, d.FileKey).
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
		select bank_account_id, seller_id, account_number_masked, ifsc, beneficiary_name
		  from sellers.bank_accounts where seller_id = $1`, sellerID).
		Scan(&b.BankAccountID, &b.SellerID, &b.AccountNumberMasked, &b.IFSC, &b.BeneficiaryName)
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
	b.BankAccountID = "bank-" + shortID()
	err := r.pool.QueryRow(ctx, `
		insert into sellers.bank_accounts (bank_account_id, seller_id, account_number_masked, ifsc, beneficiary_name)
		values ($1,$2,$3,$4,$5)
		on conflict (seller_id) do update
		  set account_number_masked = excluded.account_number_masked,
		      ifsc = excluded.ifsc,
		      beneficiary_name = excluded.beneficiary_name
		returning bank_account_id, seller_id, account_number_masked, ifsc, beneficiary_name`,
		b.BankAccountID, b.SellerID, b.AccountNumberMasked, b.IFSC, b.BeneficiaryName).
		Scan(&b.BankAccountID, &b.SellerID, &b.AccountNumberMasked, &b.IFSC, &b.BeneficiaryName)
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
		createdAt time.Time
	)
	if err := row.Scan(&s.SellerID, &s.BusinessName, &s.OwnerName, &s.Category, &s.GSTIN, &s.PAN,
		&s.BusinessAddress, &s.ContactPhone, &s.StateCode, &s.Status, &s.Rating, &createdAt); err != nil {
		return Seller{}, err
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
	if v == "" {
		return nil
	}
	return v
}
