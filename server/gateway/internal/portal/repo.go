package portal

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// ErrEmailTaken is returned when the (case-insensitive) email is already in use.
var ErrEmailTaken = errors.New("portal: email already in use")

// PortalUser is one admins.portal_users row (never carries the raw password).
type PortalUser struct {
	UserID            string
	Email             string
	DisplayName       string
	PasswordHash      string
	Role              string
	Active            bool
	MustChange        bool
	FailedAttempts    int
	LockedUntil       *time.Time
	LastLoginAt       *time.Time
	PasswordChangedAt time.Time
	SellerID          string
	StateCode         string
	DistrictCode      string
	// SubRole is empty for a seller owner/admin; STAFF|VIEWER for a seller sub-user credential.
	SubRole string
	// SubUserID links a sub-user credential to its sellers.sub_users roster row (empty for an owner).
	SubUserID string
	// InviteStatus is the login lifecycle for an invite-minted credential (0131): pending / active /
	// expired. Empty only on rows created before the column existed (treated as active).
	InviteStatus    string
	InviteExpiresAt *time.Time
	CreatedAt       time.Time
	// Vertical scope (0130) for a DISTRICT_ADMIN login. VerticalScoped is false for every other role
	// and for a district admin whose roster row is missing — those keep full access (legacy tokens).
	VerticalScoped bool
	MartAccess     bool
	FoodAccess     bool
	PharmaAccess   bool
	// DeletedAt is set when the credential is in the trash (0128). Non-nil rows are excluded from
	// every auth lookup, list and identity gate, and are purged 7 days after this instant.
	DeletedAt *time.Time
	// DeleteReason is the superadmin's stated reason; kept with the trashed row until it is purged.
	DeleteReason string
}

// Deleted reports whether the credential is in the trash window.
func (u PortalUser) Deleted() bool { return u.DeletedAt != nil }

// Session is one admins.portal_sessions row (0038 lifetime columns included).
type Session struct {
	SessionID         string
	UserID            string
	TokenHash         string
	ExpiresAt         time.Time // sliding idle expiry (last rotation + RefreshIdleTTL)
	UsedAt            *time.Time
	RevokedAt         *time.Time
	AbsoluteExpiresAt time.Time // hard family cap, set at login, never extended (0038)
	LastSeenAt        *time.Time
	ReuseGraceUntil   *time.Time // replay within this window is idempotent, not theft (0038)
	UAHash            string
	RotatedToHash     string // hash of the child token this row rotated to (0038)
}

// Repo reads/writes the admins portal credential + session tables. All SQL is parameterized.
type Repo struct {
	pool *db.Pool
}

// New returns a portal repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

func (r *Repo) ready() error {
	if r.pool == nil {
		return fmt.Errorf("portal: database not configured")
	}
	return nil
}

const userColumns = `user_id, email, display_name, password_hash, role, active, must_change,
	failed_attempts, locked_until, last_login_at, password_changed_at,
	coalesce(seller_id, ''), coalesce(state_code, ''), coalesce(district_code, ''),
	coalesce(sub_role, ''), coalesce(sub_user_id, ''), coalesce(invite_status, 'active'),
	invite_expires_at, created_at, deleted_at, coalesce(delete_reason, '')`

// ByEmailLower looks an account up case-insensitively. ok=false when absent or trashed — a deleted
// credential must never authenticate, and its email is free to be re-issued immediately (0128).
func (r *Repo) ByEmailLower(ctx context.Context, email string) (PortalUser, bool, error) {
	if err := r.ready(); err != nil {
		return PortalUser{}, false, err
	}
	u, err := scanUser(r.pool.QueryRow(ctx, `
		select `+userColumns+`
		  from admins.portal_users
		 where lower(email) = lower($1) and deleted_at is null
		 limit 1`, email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PortalUser{}, false, nil
		}
		return PortalUser{}, false, err
	}
	return u, true, nil
}

// DistrictVerticalScope reads the per-vertical access flags (0130) for a district-admin login. The
// roster row is keyed by the login email plus its district (falling back to any active roster row for
// the email when the login has no district claim). ok=false means no roster row: the caller keeps
// full access so a pre-0130 login is not silently narrowed by a missing row.
func (r *Repo) DistrictVerticalScope(ctx context.Context, email, districtCode string) (mart, food, pharma, ok bool, err error) {
	if err := r.ready(); err != nil {
		return false, false, false, false, err
	}
	err = r.pool.QueryRow(ctx, `
		select mart_access, food_access, pharma_access
		  from admins.district_admins
		 where lower(email) = lower($1)
		   and ($2 = '' or coalesce(district_code, '') = $2)
		   and active
		 order by created_at desc
		 limit 1`, email, districtCode).Scan(&mart, &food, &pharma)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, false, false, false, nil
	}
	if err != nil {
		return false, false, false, false, err
	}
	return mart, food, pharma, true, nil
}

// ByID returns one live account. ok=false when absent or trashed.
func (r *Repo) ByID(ctx context.Context, userID string) (PortalUser, bool, error) {
	if err := r.ready(); err != nil {
		return PortalUser{}, false, err
	}
	u, err := scanUser(r.pool.QueryRow(ctx, `
		select `+userColumns+`
		  from admins.portal_users
		 where user_id = $1 and deleted_at is null`, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PortalUser{}, false, nil
		}
		return PortalUser{}, false, err
	}
	return u, true, nil
}

// ByIDAny returns one account whether or not it is in the trash — used by restore, which must resolve
// a trashed row (ByID deliberately hides it).
func (r *Repo) ByIDAny(ctx context.Context, userID string) (PortalUser, bool, error) {
	if err := r.ready(); err != nil {
		return PortalUser{}, false, err
	}
	u, err := scanUser(r.pool.QueryRow(ctx, `
		select `+userColumns+`
		  from admins.portal_users
		 where user_id = $1`, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PortalUser{}, false, nil
		}
		return PortalUser{}, false, err
	}
	return u, true, nil
}

// BySellerID returns a seller's live owner login (oldest first). Sub-user credentials are excluded
// (`sub_role is null`) so the approval provisioner never reuses a staff login as the owner's, and a
// trashed login is ignored so a re-approval mints a fresh one.
func (r *Repo) BySellerID(ctx context.Context, sellerID string) (PortalUser, bool, error) {
	if err := r.ready(); err != nil {
		return PortalUser{}, false, err
	}
	u, err := scanUser(r.pool.QueryRow(ctx, `
		select `+userColumns+`
		  from admins.portal_users
		 where seller_id = $1 and role = 'SELLER' and sub_role is null and deleted_at is null
		 order by created_at
		 limit 1`, sellerID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PortalUser{}, false, nil
		}
		return PortalUser{}, false, err
	}
	return u, true, nil
}

// BySubUserID returns the credential linked to a sellers.sub_users row. ok=false when the invite has
// not been accepted yet or the credential is trashed.
func (r *Repo) BySubUserID(ctx context.Context, subUserID string) (PortalUser, bool, error) {
	if err := r.ready(); err != nil {
		return PortalUser{}, false, err
	}
	u, err := scanUser(r.pool.QueryRow(ctx, `
		select `+userColumns+`
		  from admins.portal_users
		 where sub_user_id = $1 and deleted_at is null
		 limit 1`, subUserID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PortalUser{}, false, nil
		}
		return PortalUser{}, false, err
	}
	return u, true, nil
}

// List returns every live portal credential (never the password hash), newest first. Trashed rows are
// excluded — they surface through ListDeleted.
func (r *Repo) List(ctx context.Context) ([]PortalUser, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		select `+userColumns+`
		  from admins.portal_users
		 where deleted_at is null
		 order by created_at desc
		 limit 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PortalUser{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// ListDeleted returns the trashed credentials still inside the 7-day undo window (newest deletion
// first), so the superadmin can restore one.
func (r *Repo) ListDeleted(ctx context.Context) ([]PortalUser, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		select `+userColumns+`
		  from admins.portal_users
		 where deleted_at is not null
		 order by deleted_at desc
		 limit 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PortalUser{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func scanUser(row pgx.Row) (PortalUser, error) {
	var u PortalUser
	err := row.Scan(&u.UserID, &u.Email, &u.DisplayName, &u.PasswordHash, &u.Role, &u.Active,
		&u.MustChange, &u.FailedAttempts, &u.LockedUntil, &u.LastLoginAt, &u.PasswordChangedAt,
		&u.SellerID, &u.StateCode, &u.DistrictCode, &u.SubRole, &u.SubUserID, &u.InviteStatus,
		&u.InviteExpiresAt, &u.CreatedAt, &u.DeletedAt, &u.DeleteReason)
	return u, err
}

// RecordLoginSuccess clears the failure counter and records the login time.
func (r *Repo) RecordLoginSuccess(ctx context.Context, userID string) error {
	if err := r.ready(); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		update admins.portal_users
		   set failed_attempts = 0, locked_until = null, last_login_at = now(), updated_at = now()
		 where user_id = $1`, userID)
	return err
}

// RecordLoginFailure increments the durable failure counter and locks the account for 15 minutes
// after 5 consecutive failures. Returns the new counter + lock expiry.
func (r *Repo) RecordLoginFailure(ctx context.Context, userID string) (int, *time.Time, error) {
	if err := r.ready(); err != nil {
		return 0, nil, err
	}
	var (
		failed int
		locked *time.Time
	)
	err := r.pool.QueryRow(ctx, `
		update admins.portal_users
		   set failed_attempts = failed_attempts + 1,
		       locked_until = case
		         when failed_attempts + 1 >= 5 then now() + interval '15 minutes'
		         else locked_until
		       end,
		       updated_at = now()
		 where user_id = $1
		 returning failed_attempts, locked_until`, userID).Scan(&failed, &locked)
	return failed, locked, err
}

// SetPasswordHash stores a new PHC hash and clears must_change.
func (r *Repo) SetPasswordHash(ctx context.Context, userID, hash string) error {
	if err := r.ready(); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		update admins.portal_users
		   set password_hash = $2, must_change = false, password_changed_at = now(), updated_at = now()
		 where user_id = $1`, userID, hash)
	return err
}

// UpdateEmail stores a new sign-in email for the user. The unique index on lower(email) is the
// authority: a collision is reported as ErrEmailTaken so the handler can answer 409 without leaking
// the other row. ok=false when the user no longer exists.
func (r *Repo) UpdateEmail(ctx context.Context, userID, email string) (bool, error) {
	if err := r.ready(); err != nil {
		return false, err
	}
	tag, err := r.pool.Exec(ctx, `
		update admins.portal_users
		   set email = $2, updated_at = now()
		 where user_id = $1`, userID, email)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return false, ErrEmailTaken
		}
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// ResetPassword stores a new hash, sets must_change to the requested value and clears any lockout.
func (r *Repo) ResetPassword(ctx context.Context, userID, hash string, mustChange bool) error {
	if err := r.ready(); err != nil {
		return err
	}
	// A superadmin reset supersedes any outstanding invite: the invite link stops working and the
	// login becomes active with the new password.
	_, err := r.pool.Exec(ctx, `
		update admins.portal_users
		   set password_hash = $2,
		       must_change = $3,
		       failed_attempts = 0,
		       locked_until = null,
		       invite_status = 'active',
		       invite_token_hash = null,
		       invite_expires_at = null,
		       password_changed_at = now(),
		       updated_at = now()
		 where user_id = $1`, userID, hash, mustChange)
	return err
}

// CreateUser inserts one scoped credential. It never accepts a SUPER_ADMIN row from this path;
// that role is seeded operationally (docs/RUNBOOKS/PORTAL_AUTH.md).
func (r *Repo) CreateUser(ctx context.Context, u PortalUser) (PortalUser, error) {
	if err := r.ready(); err != nil {
		return PortalUser{}, err
	}
	_, err := r.pool.Exec(ctx, `
		insert into admins.portal_users
		  (user_id, email, display_name, password_hash, role, active, must_change, seller_id, state_code, district_code, sub_role, sub_user_id)
		values ($1,$2,$3,$4,$5,true,$6,$7,$8,$9,$10,$11)`,
		u.UserID, u.Email, u.DisplayName, u.PasswordHash, u.Role, u.MustChange,
		nullable(u.SellerID), nullable(u.StateCode), nullable(u.DistrictCode),
		nullable(u.SubRole), nullable(u.SubUserID))
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return PortalUser{}, ErrEmailTaken
		}
		return PortalUser{}, err
	}
	created, ok, err := r.ByID(ctx, u.UserID)
	if err != nil {
		return PortalUser{}, err
	}
	if !ok {
		return PortalUser{}, fmt.Errorf("portal: created user missing")
	}
	return created, nil
}

// SetUserActive flips the active flag. ok=false when the row is absent or trashed.
func (r *Repo) SetUserActive(ctx context.Context, userID string, active bool) (bool, error) {
	if err := r.ready(); err != nil {
		return false, err
	}
	tag, err := r.pool.Exec(ctx, `
		update admins.portal_users
		   set active = $2, updated_at = now()
		 where user_id = $1 and deleted_at is null`, userID, active)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// SoftDelete moves a credential to the trash (deleted_at = now()) and revokes its sessions in one
// statement pair. A trashed row can no longer authenticate (ByEmailLower/ByID exclude it) and its
// email is immediately free to re-issue. ok=false when the row is absent or already trashed.
func (r *Repo) SoftDelete(ctx context.Context, userID, reason string) (bool, error) {
	if err := r.ready(); err != nil {
		return false, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	tag, err := tx.Exec(ctx, `
		update admins.portal_users
		   set deleted_at = now(), delete_reason = $2, active = false, updated_at = now()
		 where user_id = $1 and deleted_at is null`, userID, strings.TrimSpace(reason))
	if err != nil {
		return false, err
	}
	if tag.RowsAffected() == 0 {
		return false, nil
	}
	if _, err := tx.Exec(ctx, `
		update admins.portal_sessions set revoked_at = now()
		 where user_id = $1 and revoked_at is null`, userID); err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

// Restore clears the soft delete so the credential becomes live again (it keeps `active = false` —
// the superadmin re-enables it deliberately rather than silently re-granting access). ok=false when
// the row is absent or not trashed. ErrEmailTaken when the address was re-issued while the row sat in
// the trash (the live-only unique index, 0128), so the caller can answer 409 instead of a 500.
func (r *Repo) Restore(ctx context.Context, userID string) (bool, error) {
	if err := r.ready(); err != nil {
		return false, err
	}
	tag, err := r.pool.Exec(ctx, `
		update admins.portal_users
		   set deleted_at = null, delete_reason = '', updated_at = now()
		 where user_id = $1 and deleted_at is not null`, userID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return false, ErrEmailTaken
		}
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// PurgeDeleted permanently removes trashed credentials older than maxAge (sessions cascade; a seller
// sub-user roster row survives with portal_user_id set null). Global sweep; callers pass the trash
// window. Returns the number of rows removed.
func (r *Repo) PurgeDeleted(ctx context.Context, maxAge time.Duration) (int64, error) {
	if err := r.ready(); err != nil {
		return 0, err
	}
	tag, err := r.pool.Exec(ctx, `
		delete from admins.portal_users
		 where deleted_at is not null and deleted_at < $1`, time.Now().Add(-maxAge))
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// CountActiveSuperAdmins reports how many live, active SUPER_ADMIN rows exist (the last-superadmin
// guard). Trashed/deactivated rows do not count.
func (r *Repo) CountActiveSuperAdmins(ctx context.Context) (int, error) {
	if err := r.ready(); err != nil {
		return 0, err
	}
	var count int
	err := r.pool.QueryRow(ctx, `
		select count(*) from admins.portal_users
		 where role = 'SUPER_ADMIN' and active and deleted_at is null`).Scan(&count)
	return count, err
}

// EmailInUse reports whether a LIVE credential (any role) already owns this email — the identity gate
// trashed rows must not block, because their address is free to re-issue.
func (r *Repo) EmailInUse(ctx context.Context, email string) (bool, error) {
	if err := r.ready(); err != nil {
		return false, err
	}
	var ok bool
	err := r.pool.QueryRow(ctx, `
		select exists(
		  select 1 from admins.portal_users
		   where lower(email) = lower($1) and deleted_at is null)`, strings.TrimSpace(email)).Scan(&ok)
	return ok, err
}

// SellerExists reports whether the seller id is real (the credential FK would reject it anyway,
// but a 400 is clearer than a 500).
func (r *Repo) SellerExists(ctx context.Context, sellerID string) (bool, error) {
	if err := r.ready(); err != nil {
		return false, err
	}
	var ok bool
	err := r.pool.QueryRow(ctx, `select exists(select 1 from sellers.sellers where seller_id = $1)`, sellerID).Scan(&ok)
	return ok, err
}

func nullable(v string) any {
	if v == "" {
		return nil
	}
	return v
}

// CreateSession inserts one rotation row. absoluteExpires is the family's hard cap (set at login,
// preserved on rotation); uaHash is a one-way browser fingerprint (never the raw UA); last_seen_at
// is stamped at creation so a never-refreshed session still reports its last activity.
func (r *Repo) CreateSession(ctx context.Context, sessionID, userID, tokenHash string, expiresAt, absoluteExpiresAt time.Time, ipHash, uaHash string) error {
	if err := r.ready(); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		insert into admins.portal_sessions
		  (session_id, user_id, token_hash, expires_at, absolute_expires_at, ip_hash, ua_hash, last_seen_at)
		values ($1,$2,$3,$4,$5,$6,$7, now())`,
		sessionID, userID, tokenHash, expiresAt, absoluteExpiresAt, ipHash, uaHash)
	return err
}

// SessionByTokenHash looks a refresh row up by the SHA-256 hash of the raw token.
func (r *Repo) SessionByTokenHash(ctx context.Context, hash string) (Session, bool, error) {
	if err := r.ready(); err != nil {
		return Session{}, false, err
	}
	var s Session
	var rotated *string
	err := r.pool.QueryRow(ctx, `
		select session_id, user_id, token_hash, expires_at, used_at, revoked_at,
		       absolute_expires_at, last_seen_at, reuse_grace_until, ua_hash, rotated_to_hash
		  from admins.portal_sessions
		 where token_hash = $1`, hash).
		Scan(&s.SessionID, &s.UserID, &s.TokenHash, &s.ExpiresAt, &s.UsedAt, &s.RevokedAt,
			&s.AbsoluteExpiresAt, &s.LastSeenAt, &s.ReuseGraceUntil, &s.UAHash, &rotated)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Session{}, false, nil
		}
		return Session{}, false, err
	}
	if rotated != nil {
		s.RotatedToHash = *rotated
	}
	return s, true, nil
}

// ConsumeSession atomically rotates a refresh token: marks the presented row used, opens its reuse
// grace window and points it at the child token in one UPDATE — no other rotation can interleave.
// false means the token was already used/revoked (or the family already lapsed idle/absolute) —
// the caller re-reads the row and applies the corresponding verdict.
func (r *Repo) ConsumeSession(ctx context.Context, hash, rotatedToHash string, graceUntil time.Time, ipHash, uaHash string) (bool, error) {
	if err := r.ready(); err != nil {
		return false, err
	}
	tag, err := r.pool.Exec(ctx, `
		update admins.portal_sessions
		   set used_at = now(),
		       reuse_grace_until = $2,
		       rotated_to_hash = $3,
		       last_seen_at = now(),
		       ip_hash = $4,
		       ua_hash = $5
		 where token_hash = $1
		   and used_at is null and revoked_at is null
		   and expires_at > now() and absolute_expires_at > now()`, hash, graceUntil, rotatedToHash, ipHash, uaHash)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// GracePoint re-points an already-used (but still within grace) token at a newly minted child. It
// is guarded by reuse_grace_until > now() so a grace window that lapsed between verdict and write
// cannot be resurrected. false → treat as theft.
func (r *Repo) GracePoint(ctx context.Context, hash, rotatedToHash, ipHash, uaHash string) (bool, error) {
	if err := r.ready(); err != nil {
		return false, err
	}
	tag, err := r.pool.Exec(ctx, `
		update admins.portal_sessions
		   set rotated_to_hash = $2,
		       last_seen_at = now(),
		       ip_hash = $3,
		       ua_hash = $4
		 where token_hash = $1
		   and used_at is not null and revoked_at is null
		   and reuse_grace_until > now()`, hash, rotatedToHash, ipHash, uaHash)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// RevokeSession revokes a single rotation row — used for an idle-timeout (the family survives, so
// a seller's other devices stay signed in).
func (r *Repo) RevokeSession(ctx context.Context, hash string) error {
	if err := r.ready(); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		update admins.portal_sessions set revoked_at = now()
		 where token_hash = $1 and revoked_at is null`, hash)
	return err
}

// RevokeFamily revokes every rotation row in one refresh family.
func (r *Repo) RevokeFamily(ctx context.Context, sessionID string) error {
	if err := r.ready(); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		update admins.portal_sessions set revoked_at = now()
		 where session_id = $1 and revoked_at is null`, sessionID)
	return err
}

// RevokeUserSessions revokes every refresh session for a user (password change / incident).
func (r *Repo) RevokeUserSessions(ctx context.Context, userID string) error {
	if err := r.ready(); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		update admins.portal_sessions set revoked_at = now()
		 where user_id = $1 and revoked_at is null`, userID)
	return err
}
