package portal

import (
	"context"

	"github.com/faazio/server/gateway/internal/platform/db"
)

// SchemaStatus reports whether the portal credential/session tables exist and whether the scoped
// SELLER/STATE_ADMIN columns (migration 0033) have been applied. Used only for a fail-loud startup
// log — an operator sees a missing secret or an unapplied migration in the Render logs immediately.
type SchemaStatus struct {
	Tables bool // admins.portal_users + admins.portal_sessions exist
	Scoped bool // migration 0033 widened the store (seller_id / state_code)
}

// CheckSchema probes the portal tables. A nil pool or any error yields a zero status (unknown).
func CheckSchema(ctx context.Context, pool *db.Pool) SchemaStatus {
	if pool == nil {
		return SchemaStatus{}
	}
	var tables, scoped bool
	err := pool.QueryRow(ctx, `
		select
		  to_regclass('admins.portal_users') is not null
		  and to_regclass('admins.portal_sessions') is not null,
		  exists (
		    select 1 from information_schema.columns
		     where table_schema = 'admins'
		       and table_name = 'portal_users'
		       and column_name = 'seller_id'
		  )`).Scan(&tables, &scoped)
	if err != nil {
		return SchemaStatus{}
	}
	return SchemaStatus{Tables: tables, Scoped: scoped}
}
