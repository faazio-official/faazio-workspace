# Shared flows — index

Cross-app interactions used by more than one product. Keep these here instead of duplicating them
under each app root.

| Flow | Used by | Doc |
|---|---|---|
| Phone OTP auth | customer, delivery | [auth-otp.md](./auth-otp.md) |
| Portal email/password JWT | seller portal, seller app WebView, admins | [auth-otp.md](./auth-otp.md) |
| Deep links / push routing | customer (payment callback), delivery (offer), seller (WebView) | See each app doc |

## Rules

- Firebase Phone Auth is shared by customer + delivery; the seller app uses portal credentials.
- Tokens live in `react-native-keychain` on mobile and HttpOnly cookies in the browser. Never log
  tokens or PII.
- The gateway verifier order is Firebase RS256 → portal HS256 → legacy Supabase HS256.

## Linked docs

- `docs/RUNBOOKS/FIREBASE_AUTH.md`
- `docs/RUNBOOKS/PORTAL_AUTH.md`
- `docs/architecture/monolith-breakdown.md` (auth verifier ownership)
