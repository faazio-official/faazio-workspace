package portal

import (
	"context"

	"github.com/faazio/server/gateway/internal/platform/db"
)

// SchemaStatus reports whether the portal credential/session tables exist, whether the scoped
// SELLER/STATE_ADMIN columns (migration 0033) have been applied, and whether the session-lifetime
// columns (migration 0038) exist — login cannot mint a refresh row without them. Used only for a
// fail-loud startup log so an operator sees an unapplied migration in the Render logs immediately.
type SchemaStatus struct {
	Tables   bool // admins.portal_users + admins.portal_sessions exist
	Scoped   bool // migration 0033 widened the store (seller_id / state_code)
	Lifetime bool // migration 0038 added absolute_expires_at + ua_hash
}

// CheckSchema probes the portal tables. A nil pool or any error yields a zero status (unknown).
func CheckSchema(ctx context.Context, pool *db.Pool) SchemaStatus {
	if pool == nil {
		return SchemaStatus{}
	}
	var tables, scoped, lifetime bool
	err := pool.QueryRow(ctx, `
		select
		  to_regclass('admins.portal_users') is not null
		  and to_regclass('admins.portal_sessions') is not null,
		  exists (
		    select 1 from information_schema.columns
		     where table_schema = 'admins'
		       and table_name = 'portal_users'
		       and column_name = 'seller_id'
		  ),
		  exists (
		    select 1 from information_schema.columns
		     where table_schema = 'admins'
		       and table_name = 'portal_sessions'
		       and column_name = 'absolute_expires_at'
		  )`).Scan(&tables, &scoped, &lifetime)
	if err != nil {
		return SchemaStatus{}
	}
	return SchemaStatus{Tables: tables, Scoped: scoped, Lifetime: lifetime}
}
