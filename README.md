# Faazio SuperApp

Bare React Native superapp. All active work lives in `client/mobile/`.

## Start

```bash
cd client/mobile
npm install
gh workflow run android-debug.yml -f app=customer   # CI build; native Gradle is CI-only
```

Verify: `npm run ts:check` and `npm run check:boundaries` (run from `client/mobile/`).

## Docs

- [docs/README.md](docs/README.md) — index + reading order
- [docs/DEVELOPER_ONBOARDING.md](docs/DEVELOPER_ONBOARDING.md) — getting started
- `data/DATA_CONTROL.md` — data ownership & status matrix
- [PAGE_CATALOG.md](PAGE_CATALOG.md) — every screen/path
