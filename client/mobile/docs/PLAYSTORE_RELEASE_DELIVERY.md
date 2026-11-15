# Faazio Delivery Partner — Google Play Console Answer Sheet

This records the answers submitted in **Google Play Console** for the delivery-partner listing:
`com.faazio.deliverypartner` ("Faazio Delivery Partner"). It is the delivery companion to the
customer release manual `PLAYSTORE_RELEASE_CUSTOMER.md` and follows the structure of
`PLAYSTORE_RELEASE_SELLER.md`.

Keep this file updated whenever the Play Console answers change. Facts below are derived from the
delivery app code (`client/mobile/src/features/delivery-partner/*`), the Android manifests, and the
delivery interaction workflows under `docs/user-interaction-workflow/delivery/`.

---

## 1. App access (sign-in details for the review team)

The delivery app uses **Firebase phone OTP** (same Firebase project as the customer app). The test
number and its fixed code are registered in Firebase Console → Authentication → Phone → **Phone
numbers for testing**. Do **not** reuse the customer number.

| Field | Value |
|---|---|
| Name | `Delivery Partner test account` |
| Username / email or phone | `+91 9876543210` |
| Password | `123456` (fixed Firebase test OTP) |
| Any other information required for access | 1. Install and open the "Faazio Delivery Partner" app. 2. Enter the phone number `9876543210` (10 digits, no country code) and tap **Send OTP**. 3. Enter `123456` on the OTP screen. 4. The app opens the rider **Dashboard**. No password, 2FA, or biometric is required. If the app shows the registration form instead of the Dashboard, the test rider is not ACTIVE — see the note below. |

> The test number must belong to a rider whose `delivery.delivery_boys` row is **ACTIVE**. Before
> submitting, sign in with it and confirm the app lands on the Dashboard (not `Register` /
> `SubmissionSuccess`). Pending or suspended riders are routed away from the Dashboard. Full
> credentials and the cross-app warning are in `TEST_ACCOUNTS.md`.

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

Notes: there is no messaging or social feed; support is an email/phone link, not user-to-user
content. The rider's location is sent to **Faazio dispatch/operations** for assignment and tracking,
not shared with other users, so the location-sharing question is **No**. Rider payouts are **wages
for completed deliveries**, not a cash-reward/gift-card program, so that question is **No**. Online
Content = **Yes** because orders, routes, payouts and notifications load from the gateway.

---

## 3. Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share required user data types? | **Yes** |
| Is all user data encrypted in transit? | **Yes** (HTTPS/TLS only; release denies cleartext) |
| Account creation methods | **Username and other authentication** (phone number + Firebase OTP) |
| Can users log in with accounts created outside the app? | **No** |
| Do you provide a way to request data deletion? | **Yes** |
| Delete data URL | `https://faazio.com/privacy#delete-account` |

Notes: riders create an account in the app with phone OTP and then submit a partner application.
There is no in-app delete-account screen; deletion is requested via the privacy page email route
(completed within 30 days). The privacy policy states it covers delivery partners.

---

## 4. Data types selected

Only **Collected** is checked for every type below — nothing is **Shared**, because the only
recipients (Supabase, MongoDB Atlas, Aiven Valkey, Cloudflare, Render, Firebase) are service
providers processing on the developer's behalf, which Play exempts from "sharing".

| Category | Data type | Selected |
|---|---|---|
| Location | Approximate location | **Yes** |
| Location | Precise location | **Yes** |
| Personal info | Name | **Yes** |
| Personal info | Email address | No |
| Personal info | User IDs | **Yes** |
| Personal info | Address | **Yes** |
| Personal info | Phone number | **Yes** |
| Personal info | Other info (government ID, emergency contact, vehicle, hub) | **Yes** |
| Personal info | Race/ethnicity, Political/religious, Sexual orientation | No |
| Financial info | User payment info (settlement bank account) | **Yes** |
| Financial info | Purchase history | No |
| Financial info | Other financial info (earnings, payouts) | **Yes** |
| Financial info | Credit score | No |
| Health and fitness | Health info | No |
| Health and fitness | Fitness info | No |
| Messages | Emails, SMS/MMS, Other in-app messages | No |
| Photos and videos | Photos (Aadhaar/PAN/selfie/DL/RC/insurance captures) | **Yes** |
| Photos and videos | Videos | No |
| Audio files | All | No |
| Files and docs | Files and docs | No |
| Calendar | Calendar events | No |
| Contacts | Contacts | No |
| App activity | App interactions, In-app search history, Installed apps, Other user-generated content, Other actions | No |
| Web browsing | Web browsing history | No |
| App info and performance | Crash logs, Diagnostics, Other app performance data | No |
| Device or other IDs | Device or other IDs | **Yes** |

> **Location:** requested while the rider is **online** only; the app has no
> `ACCESS_BACKGROUND_LOCATION`. The Android manifest declares coarse + fine location and the
> delivery flavor adds `FOREGROUND_SERVICE_LOCATION` for the go-online heartbeat.
>
> **Photos:** document capture is live-only (`DocumentCapture`; gallery uploads are blocked). The
> captured KYC/vehicle images are stored in a private bucket and never shown to other users.
>
> **Device or other IDs:** the Firebase Cloud Messaging push token registered for order offers and
> notifications.

---

## 5. Data usage and handling (per selected type)

For every row: **Processed ephemerally = No** (data persists in Supabase/private storage).

| Data type | Required / Optional | Why collected |
|---|---|---|
| Approximate location | Required | App functionality, Fraud prevention/security/compliance |
| Precise location | Required | App functionality, Fraud prevention/security/compliance |
| Name | Required | App functionality, Account management, Fraud prevention/security/compliance |
| User IDs | Required | App functionality, Account management |
| Address | Required | App functionality, Account management |
| Phone number | Required | App functionality, Account management, Fraud prevention/security/compliance |
| Other info (government ID, emergency contact, vehicle, hub) | Required | App functionality, Account management, Fraud prevention/security/compliance |
| User payment info (bank account) | Required | App functionality (payouts), Fraud prevention/security/compliance |
| Other financial info (earnings, payouts) | Required | App functionality, Account management |
| Photos (documents) | Required | App functionality (identity/vehicle verification), Fraud prevention/security/compliance |
| Device or other IDs | Required | App functionality, Developer communications |

No type uses Analytics, Advertising or marketing, or Personalization. Emergency contact is required
by the rider onboarding flow; documents are required before a rider can be activated.

---

## 6. App features

| Question | Answer |
|---|---|
| Financial features | **My app doesn't provide any financial features** — the app displays earned delivery payouts and lets the rider mark cash-on-delivery payment received; Faazio settles payouts manually and processes no digital wallet/transfer in the app |
| Health features | **My app does not provide any health features** |

---

## 7. Store listing text

**App name** (23/30)

```
Faazio Delivery Partner
```

**Short description** (64/80)

```
Deliver on Faazio: accept orders, follow routes, track earnings.
```

**Full description** (~1,100/4000)

```
Faazio Delivery Partner is the official app for riders delivering on Faazio. It gives you the tools to run your deliveries from your phone — accept offers, follow the best route, scan at pickup, hand over with OTP, and keep track of what you earn.

This app is for approved Faazio delivery partners. New riders can apply in the app; access is activated after the Faazio team reviews the application and documents.

What you can do

• Offers — receive nearby delivery offers, accept or reject them before the countdown ends, and get reassigned automatically if you miss one.
• Routes — see pickup and drop stops in the best order, with the store and customer addresses on a map.
• Pickup — arrive at the store, scan the seller's pickup QR, and confirm the order is collected.
• Handover — enter the customer's OTP to complete delivery, and mark cash-on-delivery payment received where applicable.
• Availability — go online to receive offers, with a live heartbeat so dispatch knows you are available.
• Earnings — see per-order payouts, pending and paid totals, and your payout history.
• Orders — review completed deliveries and their breakdowns.
• Notifications — get order offers and updates, and open them straight from the notification.
• Profile and support — manage your details and reach the Faazio delivery partner team.

Built to be quick and simple, so you can keep moving.
```

---

## 8. Not covered in this chat (recommended defaults)

These Play Console screens were not answered here; keep them consistent with the customer listing:

| Question | Recommended |
|---|---|
| App category | Maps & Navigation, or Business |
| Target age groups | 18 and over only |
| Restrict minors | Enabled |
| Advertising / ad ID | No ad SDK, no `AD_ID` permission |
| Independent security review | No |

## See also

- `TEST_ACCOUNTS.md` — single source of truth for all test accounts and Firebase test numbers.
- `PLAYSTORE_RELEASE_CUSTOMER.md` — shared build/signing/upload manual (Step 3b/3c, checklist).
- `PLAYSTORE_RELEASE_SELLER.md` — seller listing answer sheet.
- `docs/RUNBOOKS/FIREBASE_AUTH.md` — Firebase phone-OTP setup and test numbers.
- `docs/user-interaction-workflow/delivery/` — delivery end-to-end flows.
