-- Faazio MVP — SUPER_ADMIN is never forced to rotate its password.
-- Authority: docs/architecture/web-portal.md ("Portal auth"), db-schema.md §12.18,
-- monolith-breakdown.md §1 (portal auth row), docs/RUNBOOKS/PORTAL_AUTH.md.
--
-- Why: the first-login confinement (must_change=true) exists so a leaked shared/temporary password
-- cannot reach the control plane. Applying it to SUPER_ADMIN meant every seeded superadmin was
-- bounced to /security forever, and an admin reset (which re-armed must_change) could never clear it.
-- The backend now exempts SUPER_ADMIN when minting the token and when enforcing the confinement; this
-- migration repairs rows already seeded with must_change=true.
--
-- The column default stays true (the safe default for scoped SELLER/STATE_ADMIN rows); the backend
-- writes false for SUPER_ADMIN going forward, and only an explicit opt-in re-arms it.

update admins.portal_users
   set must_change = false, updated_at = now()
 where role = 'SUPER_ADMIN' and must_change = true;

comment on column admins.portal_users.must_change is
  'forces initial-password rotation on next sign-in; not applied to SUPER_ADMIN';