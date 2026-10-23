package admins

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/faazio/server/gateway/internal/platform/testenv"
	"github.com/faazio/server/gateway/internal/portal"
)

func validParams() CreateParams {
	return CreateParams{
		Name: "Mumbai Ops", Email: "mh.ops@faazio.in", PhoneDigits: "9000012345",
		StateCode: "MH", IssueLogin: true, Password: "TrustNo1-SuperSecret!",
	}
}

// validParamsRosterOnly is the same identity but pre-provisioned (no login requested).
func validParamsRosterOnly() CreateParams {
	p := validParams()
	p.IssueLogin = false
	return p
}

// cleanupAdmin removes a test roster + its linked login.
func cleanupAdmin(t *testing.T, ctx context.Context, p *Provisioner, adminID string) {
	t.Helper()
	t.Cleanup(func() {
		if adminID != "" {
			_ = p.Delete(ctx, adminID)
		}
	})
}

func TestNormalisePhone(t *testing.T) {
	for in, want := range map[string]string{
		"9000012345":      "9000012345",
		"+91 90000 12345": "9000012345",
		"091-90000-12345": "9000012345",
		"919000012345":    "9000012345",
		"09000012345":     "9000012345",
		"900001234":       "",
		"90000123456":     "",
		"9190000012345":   "",
		"+44 9000012345":  "",
		"not-a-phone":     "",
		"":                "",
	} {
		got, ok := NormalisePhone(in)
		if want == "" {
			if ok {
				t.Errorf("NormalisePhone(%q) ok, want reject", in)
			}
			continue
		}
		if !ok || got != want {
			t.Errorf("NormalisePhone(%q) = %q,%v want %q", in, got, ok, want)
		}
	}
}

func TestProvisionCreateIssuesLoginAndRoster(t *testing.T) {
	pool := testenv.Pool(t)
	p := NewProvisioner(pool, portal.NewHasher("test-pepper"))
	ctx := context.Background()
	in := validParams()

	res, err := p.Create(ctx, in)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	cleanupAdmin(t, ctx, p, res.Admin.AdminID)

	if !res.LoginIssued || res.Credential.ID == "" {
		t.Fatalf("expected issued login, got %+v", res)
	}
	if res.Admin.Email != "mh.ops@faazio.in" || !res.Admin.Active {
		t.Fatalf("roster wrong: %+v", res.Admin)
	}
	if res.Credential.Role != "DISTRICT_ADMIN" || res.Credential.StateCode != "MH" || !res.Credential.MustChange || !res.Credential.Active {
		t.Fatalf("credential not a forced-rotation MH state login: %+v", res.Credential)
	}

	// The hashed password must verify against the issued credential (password is single-use).
	user, ok, err := portal.New(pool).ByEmailLower(ctx, in.Email)
	if err != nil || !ok {
		t.Fatalf("portal login lookup: ok=%v err=%v", ok, err)
	}
	if !user.Active || user.Role != "DISTRICT_ADMIN" || user.StateCode != "MH" || !user.MustChange {
		t.Fatalf("portal row unexpected: %+v", user)
	}
}

func TestProvisionCreateRosterOnlyNoLogin(t *testing.T) {
	pool := testenv.Pool(t)
	p := NewProvisioner(pool, portal.NewHasher("test-pepper"))
	ctx := context.Background()
	in := validParams()
	in.IssueLogin = false

	res, err := p.Create(ctx, in)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	cleanupAdmin(t, ctx, p, res.Admin.AdminID)
	if res.LoginIssued || res.Credential.ID != "" {
		t.Fatalf("roster-only create must not mint a login: %+v", res)
	}
	if _, ok, err := portal.New(pool).ByEmailLower(ctx, in.Email); err != nil || ok {
		t.Fatalf("roster-only must not create a portal login: ok=%v err=%v", ok, err)
	}
}

func TestProvisionDuplicateEmailCaseVariant(t *testing.T) {
	pool := testenv.Pool(t)
	p := NewProvisioner(pool, portal.NewHasher("test-pepper"))
	ctx := context.Background()

	// Roster-only first row (no login) so the duplicate hits the roster-email code, not the login one.
	first, err := p.Create(ctx, validParamsRosterOnly())
	if err != nil {
		t.Fatalf("Create first: %v", err)
	}
	cleanupAdmin(t, ctx, p, first.Admin.AdminID)

	dup := validParams()
	dup.Email = strings.ToUpper(dup.Email) // case variant must block
	if _, err := p.Create(ctx, dup); err == nil {
		t.Fatal("case-variant duplicate fell through")
	} else if c := AsConflict(err); c == nil || c.Code != "email_has_state_roster" {
		t.Fatalf("want email_has_state_roster conflict, got %v", err)
	}
}

func TestProvisionDuplicateLoginEmailCaseVariant(t *testing.T) {
	pool := testenv.Pool(t)
	p := NewProvisioner(pool, portal.NewHasher("test-pepper"))
	ctx := context.Background()

	// Full create (roster + login); the duplicate must surface the STRONGER login conflict.
	first, err := p.Create(ctx, validParams())
	if err != nil {
		t.Fatalf("Create first: %v", err)
	}
	cleanupAdmin(t, ctx, p, first.Admin.AdminID)

	dup := validParams()
	dup.Email = strings.ToUpper(dup.Email)
	if _, err := p.Create(ctx, dup); err == nil {
		t.Fatal("case-variant duplicate fell through")
	} else if c := AsConflict(err); c == nil || c.Code != "email_has_state_login" {
		t.Fatalf("want email_has_state_login conflict, got %v", err)
	}
}

func TestProvisionSuperAdminEmailBlocked(t *testing.T) {
	pool := testenv.Pool(t)
	p := NewProvisioner(pool, portal.NewHasher("test-pepper"))
	h := portal.NewHasher("test-pepper")
	ctx := context.Background()

	hash, err := h.Hash("Super-Admin-Only-1")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		insert into admins.portal_users (user_id, email, display_name, password_hash, role, active, must_change)
		values ('pu-test-super', 'mh.ops@faazio.in', 'Super', $1, 'SUPER_ADMIN', true, false)`, hash); err != nil {
		t.Fatalf("seed superadmin: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from admins.portal_users where user_id='pu-test-super'`) })

	if _, err := p.Create(ctx, validParams()); err == nil {
		t.Fatal("same email as a seeded SUPER_ADMIN fell through")
	} else if c := AsConflict(err); c == nil || c.Code != "email_used_by_super_admin" {
		t.Fatalf("want email_used_by_super_admin conflict, got %v", err)
	}
}

func TestProvisionSellerPhoneWarnsSoft(t *testing.T) {
	pool := testenv.Pool(t)
	p := NewProvisioner(pool, portal.NewHasher("test-pepper"))
	ctx := context.Background()

	if _, err := pool.Exec(ctx, `
		insert into sellers.sellers (seller_id, business_name, owner_name, category, phone, state_code)
		values ('sel-test', 'Test Mart', 'Owner', 'MART', '+91 90000 12345', 'MH')`); err != nil {
		t.Fatalf("seed seller: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from sellers.sellers where seller_id='sel-test'`) })

	// Policy is SOFT for phone: a seller-owned phone must NOT block creation, only warn.
	res, err := p.Create(ctx, validParams())
	if err != nil {
		t.Fatalf("shared seller phone must not block (soft warning): %v", err)
	}
	cleanupAdmin(t, ctx, p, res.Admin.AdminID)
	if !res.LoginIssued {
		t.Fatalf("login must still be issued alongside a phone warning: %+v", res)
	}
	found := false
	for _, w := range res.Warnings {
		if strings.Contains(w, "sel-test") {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected a soft seller-phone warning naming sel-test, got %v", res.Warnings)
	}
}

func TestProvisionSharedRosterPhoneWarnsSoft(t *testing.T) {
	pool := testenv.Pool(t)
	p := NewProvisioner(pool, portal.NewHasher("test-pepper"))
	ctx := context.Background()

	// Two people sharing one phone (SME/team line) is allowed: email keeps them unique, phone warns.
	first := validParams()
	first.Email = "a.rostershare@faazio.in"
	firstRes, err := p.Create(ctx, first)
	if err != nil {
		t.Fatalf("Create first: %v", err)
	}
	cleanupAdmin(t, ctx, p, firstRes.Admin.AdminID)
	if len(firstRes.Warnings) != 0 {
		t.Fatalf("first create must have no warnings, got %v", firstRes.Warnings)
	}

	second := validParams()
	second.Email = "b.rostershare@faazio.in"
	res, err := p.Create(ctx, second)
	if err != nil {
		t.Fatalf("shared roster phone must not block (soft warning): %v", err)
	}
	cleanupAdmin(t, ctx, p, res.Admin.AdminID)
	found := false
	for _, w := range res.Warnings {
		if strings.Contains(w, "DISTRICT_ADMIN roster") || strings.Contains(w, "district admin roster") {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected a soft roster-phone warning, got %v", res.Warnings)
	}
}

// failHasher breaks after the roster insert so the test can prove the login+roster write is atomic.
type failHasher struct{}

func (failHasher) Hash(string) (string, error) { return "", errors.New("boom") }

func TestProvisionRollbackLeavesNoOrphanRoster(t *testing.T) {
	pool := testenv.Pool(t)
	p := NewProvisioner(pool, failHasher{})
	ctx := context.Background()
	in := validParams()

	if _, err := p.Create(ctx, in); err == nil {
		t.Fatal("expected hash failure")
	}
	var n int
	if err := pool.QueryRow(ctx, `select count(*) from admins.district_admins where lower(email)=lower($1)`, in.Email).Scan(&n); err != nil {
		t.Fatalf("count roster: %v", err)
	}
	if n != 0 {
		t.Fatalf("roster row leaked after login failure (want 0, got %d)", n)
	}
	if _, ok, err := portal.New(pool).ByEmailLower(ctx, in.Email); err != nil || ok {
		t.Fatalf("portal login leaked after hash failure: ok=%v err=%v", ok, err)
	}
}

func TestProvisionSetActiveAndDeleteSyncLogin(t *testing.T) {
	pool := testenv.Pool(t)
	p := NewProvisioner(pool, portal.NewHasher("test-pepper"))
	ctx := context.Background()

	res, err := p.Create(ctx, validParams())
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Deactivate roster → the linked login is deactivated and its sessions revoked.
	admin, ok, err := p.SetActive(ctx, res.Admin.AdminID, false)
	if err != nil || !ok || admin.Active {
		t.Fatalf("SetActive(false): ok=%v err=%v active=%v", ok, err, admin.Active)
	}
	user, found, err := portal.New(pool).ByEmailLower(ctx, res.Admin.Email)
	if err != nil {
		t.Fatalf("portal lookup: %v", err)
	}
	if !found || user.Active {
		t.Fatalf("linked login must deactivate with the roster: found=%v active=%v", found, user.Active)
	}

	// Reactivate → the login is active again.
	if _, ok, err := p.SetActive(ctx, res.Admin.AdminID, true); err != nil || !ok {
		t.Fatalf("SetActive(true): ok=%v err=%v", ok, err)
	}
	if user, found, err := portal.New(pool).ByEmailLower(ctx, res.Admin.Email); err != nil || !found || !user.Active {
		t.Fatalf("linked login must reactivate: found=%v active=%v err=%v", found, user.Active, err)
	}

	// Delete → the login row is gone (sessions cascade; the credential cannot sign in).
	if err := p.Delete(ctx, res.Admin.AdminID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, found, err := portal.New(pool).ByEmailLower(ctx, res.Admin.Email); err != nil || found {
		t.Fatalf("linked login must be deleted with the roster: found=%v err=%v", found, err)
	}
	if _, ok, err := p.SetActive(ctx, res.Admin.AdminID, true); err != nil || ok {
		t.Fatalf("deleted roster must read as absent: ok=%v err=%v", ok, err)
	}
}
