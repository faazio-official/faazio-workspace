package portal

import (
	"context"
	"errors"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
)

// SubUserLoginProvisioner mints/deactivates the scoped SELLER portal credential a seller's staff
// sub-user signs in with once they accept an invite. It lives in the portal context because that is
// the single owner of admins.portal_users. It is idempotent per sub-user id: re-accepting a pending
// invite (or a retry after a partial failure) reuses the existing credential instead of duplicating.
type SubUserLoginProvisioner struct {
	repo   *Repo
	hasher *Hasher
}

// NewSubUserLoginProvisioner builds the provisioner around the shared portal repo + Argon2id hasher.
func NewSubUserLoginProvisioner(repo *Repo, hasher *Hasher) *SubUserLoginProvisioner {
	return &SubUserLoginProvisioner{repo: repo, hasher: hasher}
}

// EmailInUse reports whether the email already has any portal login (any role).
func (p *SubUserLoginProvisioner) EmailInUse(ctx context.Context, email string) (bool, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !validEmail(email) {
		return false, nil
	}
	_, ok, err := p.repo.ByEmailLower(ctx, email)
	return ok, err
}

// CreateSubUserLogin creates the credential for an accepted invite. The invitee's chosen password is
// validated against the portal policy; the email must be free across every portal role (the global
// one-person-one-role gate). A reused credential for the same sub-user id is returned as-is.
func (p *SubUserLoginProvisioner) CreateSubUserLogin(ctx context.Context, in contracts.SubUserLogin) (contracts.SubUserLoginResult, error) {
	email := strings.ToLower(strings.TrimSpace(in.Email))
	display := strings.TrimSpace(in.DisplayName)
	if display == "" {
		display = email
	}
	if in.SellerID == "" || in.SubUserID == "" || !validEmail(email) {
		return contracts.SubUserLoginResult{}, contracts.ErrSubUserEmailInUse
	}
	if len(in.Password) < minNewPasswordLen || len(in.Password) > maxPasswordLen || weakPassword(in.Password, "") {
		return contracts.SubUserLoginResult{}, contracts.ErrWeakPassword
	}

	// Idempotent by sub-user id: the roster row is the authority for "is this a real invite".
	if existing, ok, err := p.repo.BySubUserID(ctx, in.SubUserID); err != nil {
		return contracts.SubUserLoginResult{}, err
	} else if ok {
		return contracts.SubUserLoginResult{UserID: existing.UserID, Email: existing.Email}, nil
	}

	// Global email gate: an email already owned by any portal login cannot be reused.
	if existing, ok, err := p.repo.ByEmailLower(ctx, email); err != nil {
		return contracts.SubUserLoginResult{}, err
	} else if ok {
		_ = existing
		return contracts.SubUserLoginResult{}, contracts.ErrSubUserEmailInUse
	}

	hash, err := p.hasher.Hash(in.Password)
	if err != nil {
		return contracts.SubUserLoginResult{}, err
	}
	id, err := randomHex(12)
	if err != nil {
		return contracts.SubUserLoginResult{}, err
	}
	user, err := p.repo.CreateUser(ctx, PortalUser{
		UserID:       "pu-" + id,
		Email:        email,
		DisplayName:  display,
		PasswordHash: hash,
		Role:         auth.RoleSeller,
		Active:       true,
		MustChange:   false,
		SellerID:     in.SellerID,
		SubRole:      in.SubRole,
		SubUserID:    in.SubUserID,
	})
	if err != nil {
		if errors.Is(err, ErrEmailTaken) {
			return contracts.SubUserLoginResult{}, contracts.ErrSubUserEmailInUse
		}
		return contracts.SubUserLoginResult{}, err
	}
	return contracts.SubUserLoginResult{UserID: user.UserID, Email: user.Email}, nil
}

// DeactivateSubUser disables the linked credential and revokes its sessions. Absent credential is a
// no-op so a revoke of an unaccepted invite still succeeds.
func (p *SubUserLoginProvisioner) DeactivateSubUser(ctx context.Context, subUserID string) error {
	user, ok, err := p.repo.BySubUserID(ctx, subUserID)
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}
	if _, err := p.repo.SetUserActive(ctx, user.UserID, false); err != nil {
		return err
	}
	return p.repo.RevokeUserSessions(ctx, user.UserID)
}
