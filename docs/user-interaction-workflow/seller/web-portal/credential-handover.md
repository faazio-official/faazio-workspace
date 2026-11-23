# Super admin — seller credential hand-over (approve → share the login)

**App / route(s):** portal `/admin/super/sellers`, `/admin/district/sellers/[id]`,
`/admin/super/credentials`
**Status:** Shipped
**Trigger:** A seller application is approved (by a district admin after KYC, or by a super admin
overriding from the platform sellers board). Approval auto-provisions the seller's portal login, so
the approving admin must be able to hand that login to the seller — usually over WhatsApp.

## Why this flow exists

The gateway mints the login **server-side on approval** (`setStatus`/`verifyKYC` →
`ProvisionSellerLogin`): a `SELLER` `admins.portal_users` row scoped to `seller_id`, `must_change=true`,
password from `crypto/rand`, Argon2id-hashed at rest, returned **once** as
`credential.temporaryPassword`. The hash cannot be reversed and the plaintext is never stored or
logged, so the only moment the password can be shared is the response to the approval call.

Before this flow the super-admin board used a fire-and-forget `PATCH` and discarded that response:
the seller was activated with a login whose password nobody had seen. The board now awaits the call
and surfaces the credential.

## Steps

### A. Approve from the platform sellers board (`/admin/super/sellers`)

1. Open **Platform → Sellers**, filter by status/state/district, find the applicant.
2. Press **Activate**. The button enters an "Activating…" state while the `PATCH` is in flight.
3. A sheet opens with the one-time login: **email**, **temporary password** (only when
   `credential.created` is true), and the actions:
   - **Copy login** → `email\npassword` on the clipboard.
   - **Share on WhatsApp** → opens `wa.me/<contact phone>` pre-filled with the portal URL, email and
     temporary password. With no usable phone on file the message is copied instead and a toast says so.
4. Closing the sheet discards the password — it cannot be shown again. If it was missed, reset the
   login from **Portal credentials** (flow B).

Edge cases rendered by the same card:

- `credential.created = false` — an existing login for that seller was reused and its password was
  **not** changed, so only the email is copyable.
- `credential.skipped = true` — no login was minted (typically `contact_email` already belongs to
  another account). The card states the reason and links to `/admin/super/credentials`.
- The gateway can refuse an activation; the row rolls back to its previous status and an error toast
  shows the server message, so the UI never claims a status the DB does not have.

### B. Reset a login that was never handed over (`/admin/super/credentials`)

The approval is the only moment a temporary password exists. If it was missed, the super admin
recovers access by **resetting** the login rather than revealing it:

1. Switch to the **Sellers** role tab (or **All**) on `/admin/super/credentials`, find the seller's
   login (its `Last sign-in` reads **Never** until the seller accepts).
2. Press **Reset**. A fresh strong password is generated and applied with
   `PUT /admin/portal-users/{id}/password` (`forceChange`), then copy it and send it over WhatsApp
   from the seller's contact phone.
3. This is a real reset: any previous temporary password stops working immediately. There is no
   "reveal", because only the Argon2id hash exists server-side. There is no separate
   "ready to share" recovery list — the approval response already carries the password once, and
   subsequent hand-overs go through Reset.

### C. Delete a login (`/admin/super/credentials`)

1. Press **Delete** on a row. An optional reason can be recorded.
2. The login stops authenticating immediately and every session is revoked. It moves to the
   **Deleted** filter with a `purge` timestamp (`deletedAt + 7 days`).
3. **Restore** within 7 days brings it back **deactivated** — reactivate it deliberately. After the
   window the gateway purge removes the row permanently (the email becomes free to re-issue the
   instant it is deleted).
4. The last active super admin and the super admin's own signed-in login cannot be deleted
   (`last_super_admin` / `self_delete`).

### D. Approve from the district seller review (`/admin/district/sellers/[id]`)

**Verify KYC & activate** returns the credential from `POST /sellers/{id}/verify-kyc` and renders the
same card under **Seller login** — identical copy/WhatsApp hand-over.

## State

- Page-local `issued` (sellers board) holds the credential in memory only; dismissing clears it.
  Nothing is persisted client-side.
- `setSellerStatus` is an awaited `PATCH /sellers/{id}/status` with an optimistic status write and
  rollback on failure; it returns the parsed `credential` (or `null` in seed mode).
- `creds` on `/admin/super/credentials` is the live `GET /admin/portal-users` list (trashed rows
  excluded) and `trashed` is `GET /admin/portal-users/trash`; `useSellers()` supplies the business
  name. The board filters by role (Sellers / District admins / Super admins / All) and by Deleted.

## Data path

- `setSellerStatus()` → `PATCH /sellers/{id}/status` → `sellers/handler.go setStatus` →
  `portal/seller_login.go ProvisionSellerLogin` → `admins.portal_users` (Argon2id via `PORTAL_PEPPER`).
- `verifySellerKyc()` → `POST /sellers/{id}/verify-kyc` → same provisioner.
- `resetPortalCredentialPassword()` → `PUT /admin/portal-users/{id}/password` → `portal/repo.go`
  `ResetPassword`.
- `deletePortalCredential()` → `DELETE /admin/portal-users/{id}` → `portal/repo.go` `SoftDelete`
  (trash + session revoke); `restorePortalCredential()` → `POST /admin/portal-users/{id}/restore` →
  `Restore`. The hourly `portal.Purger` and the on-list sweep run `PurgeDeleted` after 7 days.
- Migration `0128` adds `deleted_at`/`delete_reason` and swaps the email unique index to live rows
  only.
- No plaintext credential is ever stored; the approval response carries the one-time password.

## Success / error / empty

- **Success:** sheet/card shows email + one-time password with copy and WhatsApp actions; a delete
  returns the purge instant.
- **Error:** activation failure rolls the row back and toasts the gateway's message; a failed reset
  toasts and leaves the row unchanged; a restore after the window is `410 trash_expired` and the row
  drops from the list.
- **Empty:** the role tab shows "No credentials here" (with the approval hint for sellers); the
  Deleted tab shows "Nothing deleted".

## Security notes

- The temporary password exists in the admin's browser memory and clipboard only — never in
  `localStorage`, the audit log, or the URL.
- No plaintext credential table was added: a retrievable store of live passwords is a standing
  breach target, and the reset-and-share path covers the same need.
- Every seller must change the password at first sign-in (`must_change`).
- A trashed credential cannot authenticate (`deleted_at is null` guards every lookup) and no longer
  blocks its email (live-only unique index); deletes and restores are audit-logged
  (`PORTAL_USER_DELETE` / `PORTAL_USER_RESTORE`).
