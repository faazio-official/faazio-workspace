# Faazio Seller Partner — Google Play Console Answer Sheet

This records the answers submitted in **Google Play Console** for the seller listing:
`com.faazio.sellerpartner` ("Faazio Seller Partner"), the WebView shell over the partner portal
(`https://app.faazio.com`). It is the seller companion to the customer release manual
`PLAYSTORE_RELEASE_CUSTOMER.md` (whose Step 3c answer sheet is written for the **customer** listing).

Keep this file updated whenever the Play Console answers change. Facts below are derived from the
seller console code (`client/web/platform/app/seller/*`, `SellerWebViewScreen.tsx`) and
`docs/RUNBOOKS/PORTAL_AUTH.md`.

---

## 1. App access (sign-in details for the review team)

Seller logins are **provisioned by a Faazio superadmin** — there is no self sign-up.

| Field | Value |
|---|---|
| Name | `Faazio Mart Tiruchirappalli` |
| Username / email | `faisalbashafaisalbasha@gmail.com` |
| Password | `seller#123` |
| Any other information required for access | 1. Install and open the "Faazio Seller Partner" app. 2. It launches straight to the Sign in screen. 3. Enter the work email and password above, then tap Sign in. 4. If prompted, set a new password of at least 12 characters on the Security screen, then continue to the Seller dashboard. No phone OTP, 2FA, or biometric is required. Note: 5 failed attempts temporarily lock sign-in for 15 minutes. |

> The account must be a live `SELLER` role in `admins.portal_users` tied to `sel-tiruchi-01`
> (`docs/RUNBOOKS/PORTAL_AUTH.md:143-151`). Only the `SELLER` role works in this app — any other
> role is rejected with "Invalid email or password". Issued/temporary passwords start `must_change`
> and force a new password (≥12 chars) at `/security` on first sign-in. Re-verify the password
> before submitting; if the account must change it, rotate it first.

---

## 2. Content rating ("All Other App Types" questionnaire)

| Question | Answer |
|---|---|
| Downloaded App — ratings-relevant content shipped in the package (code, assets) | **No** |
| User Content Sharing — natively lets users interact/exchange content (voice, text, images, audio) | **No** |
| Online Content — features content beyond the initial download | **Yes** |
| Violence | **No** |
| Sexuality | **No** |
| Language | **No** |
| Controlled Substance | **No** |
| Promotion or Sale of Age-Restricted Products or Activities | **No** |
| Miscellaneous — shares user's current and precise physical location with other users | **No** |
| Miscellaneous — allows users to purchase digital goods | **No** |
| Miscellaneous — cash rewards, gift cards, play-to-earn, convertible crypto rewards, NFTs | **No** |
| Miscellaneous — is a web browser or search engine | **No** |
| Miscellaneous — primarily a news or educational product | **No** |

Notes: no tobacco/alcohol/firearms/gambling content exists. Prescriptions are **legal** prescription
medicines, not illegal/recreational drugs, so Controlled Substance = No. The Reviews page allows a
**public, moderated reply** to a shopper review — not user-to-user messaging — so User Content
Sharing = No. Online Content = Yes because listings/orders/reviews/prescriptions load from the
portal.

---

## 3. Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share required user data types? | **Yes** |
| Is all user data encrypted in transit? | **Yes** (HTTPS/TLS only; release denies cleartext) |
| Account creation methods | **My app does not allow users to create an account** |
| Can users log in with accounts created outside the app? | **Yes** |
| How are those accounts created? | **Through employment, or enterprise accounts** (issued by Faazio staff) |
| Do you provide a way to request data deletion? | **Yes** |
| Delete data URL | `https://faazio.com/privacy#delete-account` |

Notes: the delete-data page (`client/web/landingpage/src/routes/privacy.tsx:226-291`) names the
Faazio app, lists the deletion steps, and specifies what is deleted vs kept with retention. Add a
one-line note there that **seller partners can request deletion by email**, since the current steps
describe the customer app. Deletion completes within 30 days.

---

## 4. Data types selected

Only **Collected** is checked for every type below — nothing is **Shared**, because the only
recipients (Supabase, MongoDB Atlas, Aiven Valkey, Cloudflare, Render, Firebase) are service
providers processing on the developer's behalf, which Play exempts from "sharing".

| Category | Data type | Selected |
|---|---|---|
| Location | Approximate location | **No** |
| Location | Precise location | **No** |
| Personal info | Name | **Yes** |
| Personal info | Email address | **Yes** |
| Personal info | User IDs | **Yes** |
| Personal info | Address | **Yes** |
| Personal info | Phone number | **Yes** |
| Personal info | Other info (GSTIN, PAN) | **Yes** |
| Personal info | Race/ethnicity, Political/religious, Sexual orientation | No |
| Financial info | User payment info | **Yes** |
| Financial info | Purchase history | **Yes** |
| Financial info | Other financial info | **Yes** |
| Financial info | Credit score | No |
| Health and fitness | Health info | **Yes** |
| Health and fitness | Fitness info | No |
| Messages | Emails, SMS/MMS, Other in-app messages | No |
| Photos and videos | Photos | **Yes** |
| Photos and videos | Videos | No |
| Audio files | All | No |
| Files and docs | Files and docs | No |
| Calendar | Calendar events | No |
| Contacts | Contacts | No |
| App activity | App interactions, In-app search history, Installed apps, Other user-generated content, Other actions | No |
| Web browsing | Web browsing history | No |
| App info and performance | Crash logs, Diagnostics, Other app performance data | No |
| Device or other IDs | Device or other IDs | **Yes** |

> **Location:** the seller shell never accesses device location. The shared Android manifest declares
> `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` (`android/app/src/main/AndroidManifest.xml:2-3`)
> which the seller flavor does not strip, but nothing transmits location, and the iOS seller plist
> has no location keys. Answer **No**. To avoid a permission/declaration mismatch, add a
> `tools:node="remove"` for both permissions in `android/app/src/seller/AndroidManifest.xml`
> (same pattern used there for the Maps API key).
>
> **Device or other IDs:** the Firebase Cloud Messaging push token registered at startup
> (`SellerWebViewScreen.tsx:133-147`).

---

## 5. Data usage and handling (per selected type)

For every row: **Processed ephemerally = No** (data persists in Supabase/private storage).

| Data type | Required / Optional | Why collected |
|---|---|---|
| Name | Required | App functionality, Account management |
| Email address | Required | App functionality, Account management, Fraud prevention/security/compliance |
| User IDs | Required | App functionality, Account management |
| Address | Required | App functionality, Account management, Fraud prevention/security/compliance |
| Phone number | Required | App functionality, Account management, Fraud prevention/security/compliance |
| Other info (GSTIN/PAN) | Required | App functionality, Account management, Fraud prevention/security/compliance |
| Purchase history | Required | App functionality, Fraud prevention/security/compliance |
| User payment info | Required | App functionality, Fraud prevention/security/compliance |
| Other financial info | Required | App functionality, Fraud prevention/security/compliance |
| Photos | Optional | App functionality |
| Health info | Required | App functionality |
| Device or other IDs | Required | App functionality, Developer communications |

No type uses Analytics, Advertising or marketing, or Personalization. Photos is Optional because a
seller only provides a photo when they choose to upload one and can use the app without it.

---

## 6. App features

| Question | Answer |
|---|---|
| Financial features | **My app doesn't provide any financial features** — the console only *displays* settlement/payout data; payouts are processed by Razorpay |
| Health features | **Medication and treatment management** (+ optionally **Healthcare services and management**) — the seller Prescriptions module |

---

## 7. Store listing text

**App name** (21/30)

```
Faazio Seller Partner
```

**Short description** (61/80)

```
Sell on Faazio: manage orders, products, pricing and payouts.
```

**Full description** (~1,100/4000)

```
Faazio Seller Partner is the official app for merchants selling on Faazio. It gives you one place to run your store from your phone — manage orders, keep your catalogue and stock current, price your items, and track your payouts.

This app is for approved Faazio seller partners. Access is issued by the Faazio team; there is no self sign-up.

What you can do

• Orders — view, progress and manage incoming orders, and handle returns.
• Products and inventory — add and edit products with photos, and keep stock and pricing up to date.
• Menus and pricing — organise your catalogue and set prices.
• Prescriptions — review customer prescriptions, prepare a quote, and mark them ready for collection or delivery. Available to pharmacy partners.
• Payments — see your settlement ledger, tax and GST breakdown, and your weekly payout schedule.
• Promotions and ads — run offers and in-app campaigns.
• Reviews — read shopper reviews and reply publicly.
• Analytics — follow sales and store performance at a glance.
• Stores and settings — manage store details, your settlement bank account, notifications and staff sub-users.
• Support — raise tickets and track their status.

Built to be quick and simple, so you can keep your store running wherever you are.
```

---

## 8. Not covered in this chat (recommended defaults)

These Play Console screens were not answered here; keep them consistent with the customer listing:

| Question | Recommended |
|---|---|
| App category | Utility or Business |
| Target age groups | 18 and over only |
| Restrict minors | Enabled |
| Advertising / ad ID | No ad SDK, no `AD_ID` permission |
| Independent security review | No |

## See also

- `PLAYSTORE_RELEASE_CUSTOMER.md` — shared build/signing/upload manual (Step 3b/3c, checklist).
- `docs/RUNBOOKS/PORTAL_AUTH.md` — seller login provisioning and lockout rules.
- `docs/RUNBOOKS/RELEASE.md` — signing and CI release flow.
