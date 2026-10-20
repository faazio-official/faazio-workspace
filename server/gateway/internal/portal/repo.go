package portal

import (
	"context"
	"errors"
	"fmt"
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
	CreatedAt         time.Time
}

// Session is one admins.portal_sessions row.
type Session struct {
	SessionID string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
	UsedAt    *time.Time
	RevokedAt *time.Time
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
	coalesce(seller_id, ''), coalesce(state_code, ''), created_at`

// ByEmailLower looks an account up case-insensitively. ok=false when absent.
func (r *Repo) ByEmailLower(ctx context.Context, email string) (PortalUser, bool, error) {
	if err := r.ready(); err != nil {
		return PortalUser{}, false, err
	}
	u, err := scanUser(r.pool.QueryRow(ctx, `
		select `+userColumns+`
		  from admins.portal_users
		 where lower(email) = lower($1)
		 limit 1`, email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PortalUser{}, false, nil
		}
		return PortalUser{}, false, err
	}
	return u, true, nil
}

// ByID returns one account. ok=false when absent.
func (r *Repo) ByID(ctx context.Context, userID string) (PortalUser, bool, error) {
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

// List returns every portal credential (never the password hash), newest first.
func (r *Repo) List(ctx context.Context) ([]PortalUser, error) {
	if err := r.ready(); err != nil {
		return nil, err
	}
	rows, err := r.pool.Query(ctx, `
		select `+userColumns+`
		  from admins.portal_users
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

func scanUser(row pgx.Row) (PortalUser, error) {
	var u PortalUser
	err := row.Scan(&u.UserID, &u.Email, &u.DisplayName, &u.PasswordHash, &u.Role, &u.Active,
		&u.MustChange, &u.FailedAttempts, &u.LockedUntil, &u.LastLoginAt, &u.PasswordChangedAt,
		&u.SellerID, &u.StateCode, &u.CreatedAt)
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

// ResetPassword stores a temporary hash, forces a change and clears any lockout.
func (r *Repo) ResetPassword(ctx context.Context, userID, hash string) error {
	if err := r.ready(); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		update admins.portal_users
		   set password_hash = $2,
		       must_change = true,
		       failed_attempts = 0,
		       locked_until = null,
		       password_changed_at = now(),
		       updated_at = now()
		 where user_id = $1`, userID, hash)
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
		  (user_id, email, display_name, password_hash, role, active, must_change, seller_id, state_code)
		values ($1,$2,$3,$4,$5,true,true,$6,$7)`,
		u.UserID, u.Email, u.DisplayName, u.PasswordHash, u.Role, nullable(u.SellerID), nullable(u.StateCode))
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

// SetUserActive flips the active flag. ok=false when the row is absent.
func (r *Repo) SetUserActive(ctx context.Context, userID string, active bool) (bool, error) {
	if err := r.ready(); err != nil {
		return false, err
	}
	tag, err := r.pool.Exec(ctx, `
		update admins.portal_users
		   set active = $2, updated_at = now()
		 where user_id = $1`, userID, active)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
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

// CreateSession inserts one rotation row.
func (r *Repo) CreateSession(ctx context.Context, sessionID, userID, tokenHash string, expiresAt time.Time, ipHash string) error {
	if err := r.ready(); err != nil {
		return err
	}
	_, err := r.pool.Exec(ctx, `
		insert into admins.portal_sessions (session_id, user_id, token_hash, expires_at, ip_hash)
		values ($1,$2,$3,$4,$5)`, sessionID, userID, tokenHash, expiresAt, ipHash)
	return err
}

// SessionByTokenHash looks a refresh row up by the SHA-256 hash of the raw token.
func (r *Repo) SessionByTokenHash(ctx context.Context, hash string) (Session, bool, error) {
	if err := r.ready(); err != nil {
		return Session{}, false, err
	}
	var s Session
	err := r.pool.QueryRow(ctx, `
		select session_id, user_id, token_hash, expires_at, used_at, revoked_at
		  from admins.portal_sessions
		 where token_hash = $1`, hash).
		Scan(&s.SessionID, &s.UserID, &s.TokenHash, &s.ExpiresAt, &s.UsedAt, &s.RevokedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Session{}, false, nil
		}
		return Session{}, false, err
	}
	return s, true, nil
}

// MarkSessionUsed atomically consumes a refresh token. false means it was already used/revoked —
// the caller treats that as theft and revokes the whole family.
func (r *Repo) MarkSessionUsed(ctx context.Context, hash string) (bool, error) {
	if err := r.ready(); err != nil {
		return false, err
	}
	tag, err := r.pool.Exec(ctx, `
		update admins.portal_sessions
		   set used_at = now()
		 where token_hash = $1 and used_at is null and revoked_at is null`, hash)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
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
