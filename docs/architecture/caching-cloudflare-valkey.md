# Faazio Caching — Cloudflare Edge + Aiven Valkey

> **Status:** PLANNED — not yet implemented. Cross-cutting cache layer that touches all five
> microservices and the CDN. Referenced by every table in `docs/architecture/db-schema.md` for
> cache-key → TTL → invalidation without re-explaining mechanics here.
> **Decision:** this plan supersedes the older **Upstash Redis** mentions in `server/README.md` /
> `docs/architecture/server-gateway-plan.md` — Aiven Valkey + Cloudflare is now the choice.

---

## 1. Two-layer architecture

| Layer | Where | What it caches | Who |
|---|---|---|---|
| **Edge (Cloudflare)** | CDN | public / anonymous GETs: compiled SDUI trees, search results, product images | HTTP(S) LB + CDN in front |
| **App cache (Aiven Valkey)** | origin side | per-key app cache: stock, sessions, idempotency, locks, precomputed recommendations | all services via gateway |

- The **gateway is the only public surface**; Cloudflare sits in front of it (WAF + DDoS + image
  caching, per AGENTS.md security posture — backend firewall accepts traffic only from Cloudflare IP
  ranges).
- Valkey is the **origin-side** per-key store (replaces Upstash Redis).

---

## 2. Cloudflare edge config

- **Cache-Control headers** (research-verified combinations):
  - `Cache-Control: public, max-age=300, stale-while-revalidate=60, stale-if-error=86400` — SDUI home
    (serve stale while revalidating; serve stale up to 24 h on origin error).
  - Search results: `public, max-age=600, stale-while-revalidate=60`.
  - Product detail: `public, max-age=86400, immutable` (24 h) with purge on edit.
- **Edge Cache TTL rules:** match on path/content-type; keep the negotiated format (JPEG `fm=jpg`,
  gzip/zstd) so Cloudflare does the compression — **no origin CPU cost**.
- **Never cache** responses with `Set-Cookie` or auth-scoped content (carts, orders, payments, PII).
- **Purge strategy:** by URL/prefix (e.g. `/sdui/home`, `/search?*`) + **event-triggered purge** from
  services (Pub/Sub → purge the affected keys).

---

## 3. Aiven Valkey config

| Concern | Config |
|---|---|
| Eviction | `allkeys-lfu` + `maxmemory 80%` — eviction is the cache's **compression-free substitute for size** |
| TTL | every key gets a TTL (see matrix §5); no unbounded keys |
| Values | **plain JSON**, no app-layer compression/encryption (CPU-cheap reads) |
| Security | TLS + ACL + private network only (AGENTS.md posture); PII keys ACL-scoped; no PII at edge |
| HA | replica + 99.99% SLA |
| Cost | Aiven free tier → Startup ~$60/mo (research-verified, scales with needs) |

---

## 4. Key taxonomy

```
faazio:v{N}:{service}:{entity}:{id}
```

- `v{N}` = **version prefix** → bump the number to instantly invalidate a whole class of keys without
  scanning.
- `{service}` = `gateway` · `search` · `cart` · `stock` · `checkout` · `reco` · `directory` · `reviews`
  · `accounts`.
- `{entity}` = `sdui` · `q` (query) · `product` · `store` · `stock` · `orders` · `reco` · `segment`.
- `{id}` = the stable slug / userIdHash / locale / path.

Examples: `faazio:v1:stock:fm-f1`, `faazio:v1:search:q:hoodie`, `faazio:v1:sdui:home:en`,
`faazio:v1:reco:<sha256>:home`.

---

## 5. TTL matrix

| Endpoint / entity | Valkey TTL | Edge TTL | Invalidation |
|---|---|---|---|
| SDUI home tree | 300 s | `public, max-age=300, swr=60` | `layout.updated` / version bump |
| Search top-query results | 600 s | `public, max-age=600` | `catalog.updated` |
| Product detail | 86400 s (24 h) | `public, max-age=86400, immutable` | `catalog.updated` |
| Stock (per product) | 30–60 s | — | stock decrement / reservation commit |
| Orders (per user, auth-scoped) | 60 s | **never** | order write |
| Recommendations (per userHash) | 3600 s (1 h) | — | `user_events` flush |
| Store directory / reviews | 86400 s (24 h) | — | edit event |
| Idempotency locks (checkout) | 300 s | — | auto-expire |

---

## 6. Invalidation event map (Pub/Sub)

| Event | Valkey keys affected | Cloudflare purge |
|---|---|---|
| `catalog.updated` | `search:q:*`, `product:{id}` | `/search?*`, product URL |
| `stock.updated` | `stock:{productId}` | — |
| `order.placed` | `checkout:orders:{userId}`, `reco:{userIdHash}` | — |
| `layout.updated` | `sdui:home:{version}` | `/sdui/home` |
| `user_events.flush` | `reco:{userIdHash}` | — |
| `store.updated` / `review.moderated` | `directory:store:{id}`, `reviews:product:{id}` | store/review URLs |

---

## 7. Per-service read/write patterns

- **Read-through:** gateway/search/recommendations read through Valkey (miss → origin → populate).
- **Write-through / write-around:** stock decrements update origin and invalidate the key.
- **Single-flight locks (checkout idempotency):** `SET faazio:v1:checkout:idem:{orderRef} 1 NX EX 300`
  prevents double-place of the same order; release on completion.

---

## 8. What NOT to cache

- **Carts** — auth-scoped, per-user, mutable.
- **Payments / order PII** — never at the edge; only short-lived auth-scoped Valkey keys.
- **Anything auth-scoped or PII-bearing** (addresses, phone, prescriptions, blood-donor health data).

---

## 9. Honest limitations

- **Nothing is built.** This is a plan; no Valkey instance, no Cloudflare rules, no cache code exist yet.
- **TTLs are starting points** — tune from real traffic (hit ratio, origin load).
- **MVP unchanged:** Aiven Valkey + Cloudflare are kept exactly as specified; only the **origin**
  swaps from `@mock` fixtures to Supabase/Mongo (`docs/architecture/mvp-backend.md`) — **no key or TTL
  change**.
- The **Upstash Redis** supersession is recorded here and in `server/README.md` /
  `server-gateway-plan.md`; the old mentions stay as history notes, not active config.
