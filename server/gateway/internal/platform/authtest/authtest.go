// Package authtest provides an in-process identity injector for HTTP tests. It is NOT wired into
// the production router: the gateway itself only accepts verified bearer tokens.
package authtest

import (
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/geo"
)

// Middleware injects the identity described by the X-Dev-* request headers so existing table-driven
// tests can act as a seller/admin without minting JWTs. Production code never imports this package.
func Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role := strings.ToUpper(strings.TrimSpace(r.Header.Get("X-Dev-Role")))
			if role == "STATE_ADMIN" {
				role = auth.RoleDistrictAdmin
			}
			id := auth.Identity{
				UserID:       strings.TrimSpace(r.Header.Get("X-Dev-User")),
				Role:         role,
				SellerID:     strings.TrimSpace(r.Header.Get("X-Dev-Seller")),
				StateCode:    strings.ToUpper(strings.TrimSpace(r.Header.Get("X-Dev-State"))),
				DistrictCode: geo.Normalise(r.Header.Get("X-Dev-District")),
				SubRole:      strings.ToUpper(strings.TrimSpace(r.Header.Get("X-Dev-Sub-Role"))),
				Phone:        strings.TrimSpace(r.Header.Get("X-Dev-Phone")),
			}
			if id.UserID == "" {
				// Mirror the retired dev-mode default so tests that only care about a resolved
				// caller keep working.
				id.UserID = "user-1"
			}
			next.ServeHTTP(w, r.WithContext(auth.WithIdentity(r.Context(), id)))
		})
	}
}
