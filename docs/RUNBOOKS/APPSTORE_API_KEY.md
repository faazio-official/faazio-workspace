# App Store Connect API key (.p8) — plain-English setup

> **Purpose:** Complete, human-operated guide for generating the App Store Connect API key that the **iOS release pipeline** uses to upload your app to TestFlight.
>
> The Codemagic workflow (`codemagic.yaml`) calls Apple's App Store Connect API with this key. Nobody builds the `.ipa` locally, so the key is created **once** in your browser, on any machine (Linux, Mac, or Windows).

## What you will produce

| Item | What it is | Where it goes |
|---|---|---|
| `AuthKey_....p8` file | The private API key. **Download it exactly once.** | `client/mobile/keystore/AuthKey_....p8` (never committed) |
| **Key ID** (e.g. `A1B2C3D4E5`) | Public identifier for the key. | Codemagic variable `APPSTORE_API_KEY_ID` |
| **Issuer ID** (e.g. `abc12345-...`) | Identifies your Apple Developer team. | Codemagic variable `APPSTORE_ISSUER_ID` |
| `.p8` **contents** (the full file body) | The private key itself — treat as a secret. | Codemagic secret `APPSTORE_API_PRIVATE_KEY` |

## Pre-requisites

- [ ] An Apple Developer account with **App Manager** role (or the account owner can create the key for you).
- [ ] A modern browser — Chrome, Edge, or Safari.
- [ ] No `.p12`/certificate or provisioning profile needed for this step. Those are separate and are documented on their own pages.

## Steps

1. Open **https://appstoreconnect.apple.com** in your browser.
2. **Sign in** with your Apple Developer account.
3. In the **top-right corner**, click your name/avatar → **Users and Access**.
4. Click the **Keys** tab at the top of the page.
5. Click the **+ (plus)** button → **Create Key**.
6. Give the key a name, e.g. **Faazio CI Key**.
7. Under **Role**, select **App Manager**. (Do **not** pick Developer or Admin unless you have a specific reason — App Manager is the minimum role that lets this key upload builds to TestFlight.)
8. Click **Generate**.
9. On the next screen, **click "Download API Key" immediately**. This downloads a file ending in `.p8` (e.g. `AuthKey_A1B2C3D4E5.p8`). **You only get this file once** — if you close the page without downloading it, you must create a new key.
10. Move the `.p8` file somewhere safe that is **not committed to git**, e.g. `client/mobile/keystore/AuthKey_....p8`.
11. **Copy the Key ID** (looks like `A1B2C3D4E5`) and save it.
12. **Copy the Issuer ID** (looks like `abc12345-...`) and save it.
13. In Codemagic, open the Faazio app → **Environment variables** → group `faazio_ios_release` and add:
    - `APPSTORE_API_KEY_ID` → value: the Key ID
    - `APPSTORE_ISSUER_ID` → value: the Issuer ID
    - `APPSTORE_API_PRIVATE_KEY` → value: the **whole contents** of the `.p8` file, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines (mark it **Secret**)

## Checkpoint 5 — do you have everything?

- ✅ **Yes** — you have the `.p8` file downloaded, plus the Key ID and Issuer ID copied. Add all three to the Codemagic group `faazio_ios_release`, then continue to the iOS release workflow.
- ❌ **No** — go back and create the key again. You cannot re-download the same `.p8`.

## What NOT to do

- Never commit the `.p8` file, its contents, Key ID, or Issuer ID to git.
- Never share the `.p8` contents. Only the API key ID and Issuer ID are meant to be copied into config or CI.
- If you close the page before downloading the `.p8`, you cannot get it back — create a new key instead.

## How Codemagic uses this

`codemagic.yaml` reads the key from the `faazio_ios_release` group and hands it to the App Store
Connect publishing step:

| `codemagic.yaml` field | Value |
|---|---|
| `issuer_id` | `$APPSTORE_ISSUER_ID` |
| `key_id` | `$APPSTORE_API_KEY_ID` |
| `api_key` | `$APPSTORE_API_PRIVATE_KEY` |

## Failure triage

| Symptom | Likely cause | Fix |
|---|---|---|
| TestFlight upload fails with an auth error | Key is missing, wrong role, or secrets don't match | Regenerate the key, re-add `APPSTORE_API_PRIVATE_KEY` + `APPSTORE_API_KEY_ID` + `APPSTORE_ISSUER_ID` |
| "Unknown team or host" / invalid issuer | `APPSTORE_TEAM_ID` doesn't match the team that owns the key | Set `APPSTORE_TEAM_ID` to your Apple Developer Team ID (10-char) |
| Key doesn't appear in the Keys tab | Wrong user account signed in | Sign in with the account that owns the Developer Program membership |

