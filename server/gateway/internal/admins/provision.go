package admins

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

// passwordHasher hashes a portal credential password (implemented by portal.Hasher — passed in from
// the composition root; admins never imports the sibling portal context, monolith-breakdown.md §2).
type passwordHasher interface {
	Hash(password string) (string, error)
}

// ConflictError is a hard duplicate/identity block returned before any row is written. The role/id
// identify the existing identity (role like SUPER_ADMIN/SELLER/STATE_ADMIN, id like pu-*/sel-*/adm-*)
// so the portal can name it without leaking anything sensitive.
type ConflictError struct {
	Code            string
	Message         string
	ConflictingRole string
	ConflictingID   string
}

func (e *ConflictError) Error() string { return e.Message }

// IsConflict reports whether the error is an identity/duplicate block (HTTP 409).
func IsConflict(err error) bool {
	var ce *ConflictError
	return errors.As(err, &ce)
}

// AsConflict unwraps a *ConflictError (nil when the error is not a conflict).
func AsConflict(err error) *ConflictError {
	var ce *ConflictError
	if errors.As(err, &ce) {
		return ce
	}
	return nil
}

// CreateParams is the per-create input the Provisioner verifies inside the tx. Callers normalise first.
type CreateParams struct {
	Name        string
	Email       string // trimmed + lowercased
	PhoneDigits string // NormalisePhone output (exactly 10 digits)
	StateCode   string // normalised + IsValidState
	IssueLogin  bool
	Password    string
}

// CredentialDTO is the portal_users row emitted by a state-admin creation (never the hash/temp password).
type CredentialDTO struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	StateCode   string `json:"stateCode,omitempty"`
	Active      bool   `json:"active"`
	MustChange  bool   `json:"mustChange"`
	LastLoginAt string `json:"lastLoginAt,omitempty"`
	CreatedAt   string `json:"createdAt,omitempty"`
}

// CreateResult carries the roster row and, when a login was issued, the credential row. Warnings
// are non-blocking soft notices (never 40x): a shared phone that already belongs to another seller
// or roster row is allowed by policy, so the superadmin can still create and confirm the owner.
type CreateResult struct {
	Admin       StateAdmin
	Credential  CredentialDTO
	LoginIssued bool
	Warnings    []string
}

// Provisioner owns the unified state-admin creator: the roster + (optionally) the STATE_ADMIN portal
// login are written in ONE tx, and identity collisions are hard-blocked before anything is inserted.
// It is the single writer for the admins context's identity rows (db-schema.md §12.19).
type Provisioner struct {
	pool   *db.Pool
	hasher passwordHasher
}

// NewProvisioner builds a provisioner. hasher is the shared portal.Hasher (empty pepper allowed for
// dev only); a nil hasher makes login issuance impossible (roster-only creation still works).
func NewProvisioner(pool *db.Pool, hasher passwordHasher) *Provisioner {
	return &Provisioner{pool: pool, hasher: hasher}
}

// Create writes a roster row and, when IssueLogin is true, its STATE_ADMIN portal login in one tx.
// The temporary password is single-use (must_change locked true). Conflicts return a *ConflictError.
func (p *Provisioner) Create(ctx context.Context, in CreateParams) (CreateResult, error) {
	if p.pool == nil {
		return CreateResult{}, errors.New("admins: database not configured")
	}
	if in.IssueLogin && p.hasher == nil {
		return CreateResult{}, errors.New("admins: cannot issue a login without a password hasher")
	}

	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return CreateResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	conflict, err := checkCollisions(ctx, tx, in)
	if err != nil {
		return CreateResult{}, err
	}
	if conflict != nil {
		return CreateResult{}, conflict
	}
	warnings, err := phoneWarnings(ctx, tx, in)
	if err != nil {
		return CreateResult{}, err
	}

	admin := StateAdmin{
		AdminID: "adm-" + shortID(), Name: in.Name, Email: in.Email, Phone: in.PhoneDigits, StateCode: in.StateCode,
	}
	var createdAt, lastActive time.Time
	if err := tx.QueryRow(ctx, `
		insert into admins.state_admins (admin_id, name, email, phone, state_code, active)
		values ($1,$2,$3,$4,$5,true)
		returning active, created_at, last_active_at`,
		admin.AdminID, admin.Name, admin.Email, admin.Phone, admin.StateCode).
		Scan(&admin.Active, &createdAt, &lastActive); err != nil {
		if conflict := rosterConstraintConflict(ctx, tx, in, err); conflict != nil {
			return CreateResult{}, conflict
		}
		return CreateResult{}, err
	}
	admin.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	admin.LastActiveAt = lastActive.UTC().Format(time.RFC3339)
	res := CreateResult{Admin: admin, Warnings: warnings}

	if !in.IssueLogin {
		if err := tx.Commit(ctx); err != nil {
			return CreateResult{}, err
		}
		return res, nil
	}

	// Hash binds the login. A hash failure happens BEFORE the portal_users insert, so the roster row
	// created above rolls back with the tx — no orphan roster.
	hash, err := p.hasher.Hash(in.Password)
	if err != nil {
		return CreateResult{}, fmt.Errorf("admins: password hash: %w", err)
	}
	cred, err := insertStateAdminLogin(ctx, tx, in, hash)
	if err != nil {
		// Race: a portal login for this email appeared between the gate and the insert. The roster row
		// in this tx rolls back; surface the real blocking identity.
		if conflict, cErr := checkCollisions(ctx, tx, in); cErr == nil && conflict != nil {
			return CreateResult{}, conflict
		}
		return CreateResult{}, err
	}
	res.Credential = cred
	res.LoginIssued = true

	if err := tx.Commit(ctx); err != nil {
		return CreateResult{}, err
	}
	return res, nil
}

// checkCollisions returns the FIRST blocking identity (email only — one person, one role): a
// portal_users email across any role → SUPER_ADMIN/SELLER/STATE_ADMIN block; a roster email reuse →
// block. Phone is NOT here: a shared phone is a soft warning (phoneWarnings), never a 409, because
// a single phone can legitimately cover several people (team/SME lines). Runs inside the create tx
// so a concurrent insert cannot race it; the 0036 unique indexes are the frontier backstop.
func checkCollisions(ctx context.Context, tx pgx.Tx, in CreateParams) (*ConflictError, error) {
	var id, role, sellerID, stateCode string
	err := tx.QueryRow(ctx, `
		select user_id, role, coalesce(seller_id,''), coalesce(state_code,'')
		  from admins.portal_users
		 where lower(email) = lower($1)
		 limit 1`, in.Email).Scan(&id, &role, &sellerID, &stateCode)
	switch {
	case err == nil:
		switch role {
		case "SUPER_ADMIN":
			return &ConflictError{Code: "email_used_by_super_admin", Message: "this email already belongs to an active SUPER_ADMIN login", ConflictingRole: role, ConflictingID: id}, nil
		case "SELLER":
			return &ConflictError{Code: "email_used_by_seller", Message: "this email already belongs to seller " + sellerID, ConflictingRole: role, ConflictingID: sellerID}, nil
		default:
			return &ConflictError{Code: "email_has_state_login", Message: "this email already has a STATE_ADMIN login for " + stateCode, ConflictingRole: role, ConflictingID: id}, nil
		}
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, err
	}

	err = tx.QueryRow(ctx, `
		select admin_id, state_code from admins.state_admins
		 where lower(email) = lower($1)
		 limit 1`, in.Email).Scan(&id, &stateCode)
	switch {
	case err == nil:
		return &ConflictError{Code: "email_has_state_roster", Message: "this email already has a STATE_ADMIN roster for " + stateCode, ConflictingRole: "STATE_ADMIN", ConflictingID: id}, nil
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, err
	}
	return nil, nil
}

// phoneWarnings returns soft, non-blocking notices when the incoming phone already belongs to a
// seller or to another roster row. Never blocks — policy decision (shared/SME phones). A fresh
// phone yields no warnings.
func phoneWarnings(ctx context.Context, tx pgx.Tx, in CreateParams) ([]string, error) {
	var out []string
	// sellers.sellers.phone may carry +91/91/0 prefixes (legacy seed) while the roster stores the bare
	// 10 digits — normalise the seller side to digits + strip leading 091/91/0 before comparing.
	var sellerID string
	err := tx.QueryRow(ctx, `
		select seller_id from sellers.sellers
		 where phone <> '' and phone is not null
		   and regexp_replace(regexp_replace(regexp_replace(regexp_replace(phone, '\D', '', 'g'), '^091', ''), '^91', ''), '^0', '') = $1
		 limit 1`, in.PhoneDigits).Scan(&sellerID)
	switch {
	case err == nil:
		out = append(out, "phone already belongs to seller "+sellerID)
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, err
	}

	var adminID, stateCode string
	err = tx.QueryRow(ctx, `
		select admin_id, state_code from admins.state_admins
		 where regexp_replace(phone, '\D', '', 'g') = $1
		 limit 1`, in.PhoneDigits).Scan(&adminID, &stateCode)
	switch {
	case err == nil:
		out = append(out, "phone already belongs to the STATE_ADMIN roster for "+stateCode)
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, err
	}
	return out, nil
}

// rosterConstraintConflict re-derives a precise 409 when the roster insert hits a unique index (a
// concurrent writer slipped past the gate) — the 0036 unique constraints are the for-sure backstop.
func rosterConstraintConflict(ctx context.Context, tx pgx.Tx, in CreateParams, insertErr error) *ConflictError {
	if !isUniqueViolation(insertErr) {
		return nil
	}
	var adminID, stateCode string
	if err := tx.QueryRow(ctx, `
		select admin_id, coalesce(state_code,'') from admins.state_admins
		 where lower(email) = lower($1) or regexp_replace(phone, '\D', '', 'g') = $2
		 limit 1`, in.Email, in.PhoneDigits).Scan(&adminID, &stateCode); err == nil {
		return &ConflictError{Code: "email_has_state_roster", Message: "this email/phone already has a STATE_ADMIN roster for " + stateCode, ConflictingRole: "STATE_ADMIN", ConflictingID: adminID}
	}
	return &ConflictError{Code: "duplicate_identity", Message: "this identity already has a STATE_ADMIN roster", ConflictingRole: "STATE_ADMIN", ConflictingID: ""}
}

func isUniqueViolation(err error) bool {
	var pgErr interface{ SQLState() string }
	return errors.As(err, &pgErr) && pgErr.SQLState() == "23505"
}

// insertStateAdminLogin inserts the STATE_ADMIN portal credential. must_change is locked true — the
// temporary password is single-use by design (0034 keeps SUPER_ADMIN exempt; STATE_ADMIN is not).
func insertStateAdminLogin(ctx context.Context, tx pgx.Tx, in CreateParams, hash string) (CredentialDTO, error) {
	userID, err := randomHex(12)
	if err != nil {
		return CredentialDTO{}, err
	}
	userID = "pu-" + userID
	var c CredentialDTO
	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		insert into admins.portal_users
		  (user_id, email, display_name, password_hash, role, active, must_change, state_code)
		values ($1,$2,$3,$4,'STATE_ADMIN',true,true,$5)
		returning user_id, email, display_name, role, active, must_change, created_at`,
		userID, in.Email, in.Name, hash, in.StateCode).
		Scan(&c.ID, &c.Email, &c.Name, &c.Role, &c.Active, &c.MustChange, &createdAt)
	if err != nil {
		return CredentialDTO{}, err
	}
	c.StateCode = in.StateCode
	c.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return c, nil
}

// SetActive flips the roster flag and mirrors it onto the linked STATE_ADMIN portal login (matched by
// lower(email)); deactivating also revokes its refresh sessions so a dead roster can never leave a
// live login. ok=false when the roster row is absent.
func (p *Provisioner) SetActive(ctx context.Context, adminID string, active bool) (StateAdmin, bool, error) {
	if p.pool == nil {
		return StateAdmin{}, false, errors.New("admins: database not configured")
	}
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return StateAdmin{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var a StateAdmin
	var createdAt, lastActive time.Time
	err = tx.QueryRow(ctx, `
		update admins.state_admins set active = $2
		 where admin_id = $1
		 returning admin_id, name, email, phone, state_code, active, created_at, last_active_at`,
		adminID, active).
		Scan(&a.AdminID, &a.Name, &a.Email, &a.Phone, &a.StateCode, &a.Active, &createdAt, &lastActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return StateAdmin{}, false, nil
	}
	if err != nil {
		return StateAdmin{}, false, err
	}
	a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	a.LastActiveAt = lastActive.UTC().Format(time.RFC3339)

	if _, err := tx.Exec(ctx, `
		update admins.portal_users
		   set active = $2, updated_at = now()
		 where lower(email) = lower($1) and role = 'STATE_ADMIN'`, a.Email, active); err != nil {
		return StateAdmin{}, false, err
	}
	if !active {
		if _, err := tx.Exec(ctx, `
			update admins.portal_sessions set revoked_at = now()
			 where revoked_at is null
			   and user_id in (
			     select user_id from admins.portal_users
			      where lower(email) = lower($1) and role = 'STATE_ADMIN')`, a.Email); err != nil {
			return StateAdmin{}, false, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return StateAdmin{}, false, err
	}
	return a, true, nil
}

// Delete removes the roster row and its linked STATE_ADMIN portal login (sessions cascade) in one tx.
// Idempotent — an absent row is still a success (matches the legacy DELETE contract).
func (p *Provisioner) Delete(ctx context.Context, adminID string) error {
	if p.pool == nil {
		return errors.New("admins: database not configured")
	}
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var email string
	if err := tx.QueryRow(ctx, `select email from admins.state_admins where admin_id = $1`, adminID).Scan(&email); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if email != "" {
		if _, err := tx.Exec(ctx, `
			delete from admins.portal_users
			 where lower(email) = lower($1) and role = 'STATE_ADMIN'`, email); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `delete from admins.state_admins where admin_id = $1`, adminID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// randomHex returns n random bytes hex-encoded (24 chars for the portal-user id, mirroring portal).
// shortID() in repo.go covers the adm-* ids; crypto/rand.Read is safe for concurrent use.
func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}