/**
 * Shared seed-media constants. Keep the key prefix + MIME allowlist in sync with the gateway
 * (`internal/media/handler.go` `mintKey` + `allowedMimes`) — the backfill mints keys that the
 * gateway/media read path must recognise.
 */
export const KEY_PREFIX = 'media';

/** Upload allowlist (mirror of `allowedMimes`): web-safe raster types only. */
export const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Default asset kind/status written by the seed tooling (public, live). */
export const DEFAULT_KIND = 'PUBLIC';
export const DEFAULT_STATUS = 'ACTIVE';
export const SEED_ACTOR = 'seed';