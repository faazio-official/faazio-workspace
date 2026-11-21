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
4. Closing the sheet discards the password — it cannot be shown again. If it was missed, use flow B.

Edge cases rendered by the same card:

- `credential.created = false` — an existing login for that seller was reused and its password was
  **not** changed, so only the email is copyable.
- `credential.skipped = true` — no login was minted (typically `contact_email` already belongs to
  another account). The card states the reason and links to `/admin/super/credentials`.
- The gateway can refuse an activation; the row rolls back to its previous status and an error toast
  shows the server message, so the UI never claims a status the DB does not have.

### B. Recover an unshared login (`/admin/super/credentials`)

1. The **Ready to share** section lists `SELLER` logins that are `active` and have **never signed
   in** (`lastLoginAt` empty) — i.e. auto-provisioned on approval and still awaiting first use.
   Seller staff logins (sub-users) are excluded; those invitees set their own password.
2. Press **Prepare password**. A fresh strong password is generated in the browser and applied with
   `PUT /admin/portal-users/{id}/password` (`forceChange`), then shown once in a **Share login** card
   with the same Copy / WhatsApp actions.
3. This is a real reset: the previous temporary password stops working immediately. There is no
   "reveal", because only the Argon2id hash exists server-side.

### C. Approve from the district seller review (`/admin/district/sellers/[id]`)

**Verify KYC & activate** returns the credential from `POST /sellers/{id}/verify-kyc` and renders the
same card under **Seller login** — identical copy/WhatsApp hand-over.

## State

- Page-local `issued` (sellers board) and `shared` (credentials board) hold the credential in memory
  only; dismissing clears it. Nothing is persisted client-side.
- `setSellerStatus` is now an awaited `PATCH /sellers/{id}/status` with an optimistic status write and
  rollback on failure; it returns the parsed `credential` (or `null` in seed mode).
- `creds` on `/admin/super/credentials` is the live `GET /admin/portal-users` list; `useSellers()`
  supplies the business name and contact phone for the WhatsApp destination.

## Data path

- `setSellerStatus()` → `PATCH /sellers/{id}/status` → `sellers/handler.go setStatus` →
  `portal/seller_login.go ProvisionSellerLogin` → `admins.portal_users` (Argon2id via `PORTAL_PEPPER`).
- `verifySellerKyc()` → `POST /sellers/{id}/verify-kyc` → same provisioner.
- `resetPortalCredentialPassword()` → `PUT /admin/portal-users/{id}/password` → `portal/repo.go`
  `SetPassword`.
- No migration: the credential is returned in the approval response, not stored in a retrievable table.

## Success / error / empty

- **Success:** sheet/card shows email + one-time password with copy and WhatsApp actions.
- **Error:** activation failure rolls the row back and toasts the gateway's message; a failed password
  mint toasts and leaves the row in **Ready to share**.
- **Empty:** **Ready to share** shows "Nothing waiting" once every provisioned seller has signed in.

## Security notes

- The temporary password exists in the admin's browser memory and clipboard only — never in
  `localStorage`, the audit log, or the URL.
- No plaintext credential table was added: a retrievable store of live passwords is a standing
  breach target, and the reset-and-share path covers the same need.
- Every seller must change the password at first sign-in (`must_change`).
