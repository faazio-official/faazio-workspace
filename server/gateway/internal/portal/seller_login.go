package portal

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/auth"
)

// SellerLoginProvisioner creates the scoped SELLER portal credential the seller app signs in with
// once an application is approved. It is deliberately idempotent: re-approving a seller (or a
// concurrent approval) reuses the existing login instead of minting a second credential, so a
// seller is never locked out by a rotation they did not ask for.
type SellerLoginProvisioner struct {
	repo   *Repo
	hasher *Hasher
}

// NewSellerLoginProvisioner builds the provisioner around the shared portal repo + Argon2id hasher.
func NewSellerLoginProvisioner(repo *Repo, hasher *Hasher) *SellerLoginProvisioner {
	return &SellerLoginProvisioner{repo: repo, hasher: hasher}
}

// ProvisionSellerLogin returns the seller's login, creating it when absent. A missing/invalid
// contact email or an email already used by another account is reported as Skipped (the approval
// itself still succeeds); a real storage/hash failure is returned as an error.
func (p *SellerLoginProvisioner) ProvisionSellerLogin(ctx context.Context, sellerID, email, displayName string) (contracts.SellerLogin, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	displayName = strings.TrimSpace(displayName)
	if sellerID == "" || !validEmail(email) {
		return contracts.SellerLogin{Skipped: true, Reason: "seller has no valid contact email"}, nil
	}

	// Idempotent reuse by seller first: a seller may have rotated their sign-in email since approval,
	// so matching on email alone could mint a second login on the old contact address. Reusing the
	// seller's existing login keeps "one approval → one credential" true across an email change.
	if existing, ok, err := p.repo.BySellerID(ctx, sellerID); err != nil {
		return contracts.SellerLogin{}, err
	} else if ok {
		return contracts.SellerLogin{UserID: existing.UserID, Email: existing.Email}, nil
	}

	// Idempotent reuse: the same seller + email already has a login.
	if existing, ok, err := p.repo.ByEmailLower(ctx, email); err != nil {
		return contracts.SellerLogin{}, err
	} else if ok {
		if existing.Role == auth.RoleSeller && existing.SellerID == sellerID {
			return contracts.SellerLogin{UserID: existing.UserID, Email: existing.Email}, nil
		}
		return contracts.SellerLogin{Skipped: true, Reason: "contact email already has a portal login"}, nil
	}

	password, err := temporaryPassword()
	if err != nil {
		return contracts.SellerLogin{}, err
	}
	hash, err := p.hasher.Hash(password)
	if err != nil {
		return contracts.SellerLogin{}, err
	}
	id, err := randomHex(12)
	if err != nil {
		return contracts.SellerLogin{}, err
	}
	if displayName == "" {
		displayName = email
	}
	user, err := p.repo.CreateUser(ctx, PortalUser{
		UserID:       "pu-" + id,
		Email:        email,
		DisplayName:  displayName,
		PasswordHash: hash,
		Role:         auth.RoleSeller,
		Active:       true,
		MustChange:   true,
		SellerID:     sellerID,
	})
	if err != nil {
		// A concurrent approval may have won the unique-email race. Re-read before failing: if the
		// winning row is this seller's login, return it as a successful reuse.
		if errors.Is(err, ErrEmailTaken) {
			if existing, ok, rerr := p.repo.ByEmailLower(ctx, email); rerr == nil && ok &&
				existing.Role == auth.RoleSeller && existing.SellerID == sellerID {
				return contracts.SellerLogin{UserID: existing.UserID, Email: existing.Email}, nil
			}
			return contracts.SellerLogin{Skipped: true, Reason: "contact email already has a portal login"}, nil
		}
		return contracts.SellerLogin{}, err
	}
	return contracts.SellerLogin{
		UserID:            user.UserID,
		Email:             user.Email,
		TemporaryPassword: password,
		Created:           true,
	}, nil
}

// temporaryPassword returns a random 36-character hex secret (144 bits) that always satisfies the
// portal password policy. It is hashed immediately and returned to the approving admin only once.
func temporaryPassword() (string, error) {
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
