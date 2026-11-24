package admins

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// InviteTTL is how long a district-admin invite link stays valid (mirrors the seller sub-user flow).
const InviteTTL = 7 * 24 * time.Hour

// ErrInviteNotPending is returned when a resend targets a login that is not an unexpired invite.
var ErrInviteNotPending = errors.New("admins: invite is not pending")

// ErrInviteInvalid is returned when an accept token is absent, already used or expired.
var ErrInviteInvalid = errors.New("admins: invite link is invalid or has expired")

// newInviteToken returns a random capability token and its at-rest SHA-256 hash. Only the hash is
// persisted; the raw token is shown to the creator once.
func newInviteToken() (raw, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(b)
	return raw, HashInviteToken(raw), nil
}

// HashInviteToken is the at-rest representation of an accept token.
func HashInviteToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// ResendInvite rotates the accept token + expiry for a still-pending district-admin invite (matched
// by the roster row's email). The previous link stops working immediately. ok=false when the linked
// login is not a live pending invite.
func (p *Provisioner) ResendInvite(ctx context.Context, adminID string) (string, string, bool, error) {
	if p.pool == nil {
		return "", "", false, errors.New("admins: database not configured")
	}
	raw, hash, err := newInviteToken()
	if err != nil {
		return "", "", false, err
	}
	expiresAt := time.Now().Add(InviteTTL)
	var email string
	err = p.pool.QueryRow(ctx, `
		update admins.portal_users u
		   set invite_token_hash = $2, invite_expires_at = $3, updated_at = now()
		  from admins.district_admins a
		 where a.admin_id = $1
		   and lower(u.email) = lower(a.email)
		   and u.role = 'DISTRICT_ADMIN'
		   and u.deleted_at is null
		   and u.invite_status = 'pending'
		 returning u.email`,
		adminID, hash, expiresAt).Scan(&email)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", false, ErrInviteNotPending
	}
	if err != nil {
		return "", "", false, err
	}
	return raw, expiresAt.UTC().Format(time.RFC3339), true, nil
}

// AcceptInvite consumes a one-time invite token, sets the invitee's own password and flips the login
// to active. It is single-use and time-bound: the token hash is cleared on success. Returns the
// login's email so the page can confirm who was activated. Errors: ErrInviteInvalid, ErrWeakPassword
// (from the caller's validation) or a hashing failure.
func (p *Provisioner) AcceptInvite(ctx context.Context, rawToken, password string) (string, error) {
	if p.pool == nil {
		return "", errors.New("admins: database not configured")
	}
	if p.hasher == nil {
		return "", errors.New("admins: cannot accept an invite without a password hasher")
	}
	tokenHash := HashInviteToken(rawToken)

	var userID, email string
	err := p.pool.QueryRow(ctx, `
		select user_id, email from admins.portal_users
		 where invite_token_hash = $1
		   and invite_status = 'pending'
		   and deleted_at is null
		   and invite_expires_at is not null
		   and invite_expires_at > now()`, tokenHash).Scan(&userID, &email)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrInviteInvalid
	}
	if err != nil {
		return "", err
	}

	hash, err := p.hasher.Hash(password)
	if err != nil {
		return "", err
	}
	// Guarded update (not a plain update by id) so a concurrent second accept of the same token
	// loses the race and is rejected rather than overwriting the first invitee's password.
	tag, err := p.pool.Exec(ctx, `
		update admins.portal_users
		   set password_hash = $2,
		       must_change = false,
		       invite_status = 'active',
		       invite_token_hash = null,
		       invite_expires_at = null,
		       failed_attempts = 0,
		       locked_until = null,
		       password_changed_at = now(),
		       updated_at = now()
		 where user_id = $1
		   and invite_token_hash = $3
		   and invite_status = 'pending'
		   and deleted_at is null`, userID, hash, tokenHash)
	if err != nil {
		return "", err
	}
	if tag.RowsAffected() == 0 {
		return "", ErrInviteInvalid
	}
	return email, nil
}
