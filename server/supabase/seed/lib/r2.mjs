/**
 * Cloudflare R2 presigner for the seed tooling — AWS Signature V4 (query-string presign).
 *
 * Mirrors `server/gateway/internal/platform/r2/r2.go` byte-for-byte (region `auto`, service `s3`,
 * `X-Amz-SignedHeaders=host`, `UNSIGNED-PAYLOAD`) so a key signed here is accepted exactly like one
 * signed by the gateway. Dependency-free: uses node:crypto only (no aws-sdk, matching the gateway's
 * lightweight mandate) and Node's global fetch for the upload.
 *
 * Secrets come from the environment and are never logged.
 */
import { createHash, createHmac } from 'node:crypto';

const DEFAULT_PUBLIC_BUCKET = 'faazio-public';
const DEFAULT_PRIVATE_BUCKET = 'faazio-private';

/** Read R2 settings from the environment. Returns null when the S3 credentials are unset. */
export function r2ConfigFromEnv(env = process.env) {
  const accountId = (env.R2_ACCOUNT_ID ?? '').trim();
  const accessKeyId = (env.R2_ACCESS_KEY_ID ?? '').trim();
  const secretKey = (env.R2_SECRET_ACCESS_KEY ?? '').trim();
  if (!accountId || !accessKeyId || !secretKey) return null;
  return {
    accountId,
    accessKeyId,
    secretKey,
    publicBucket: (env.R2_PUBLIC_BUCKET ?? '').trim() || DEFAULT_PUBLIC_BUCKET,
    privateBucket: (env.R2_PRIVATE_BUCKET ?? '').trim() || DEFAULT_PRIVATE_BUCKET,
    cdnBase: (env.R2_CDN_BASE ?? '').trim().replace(/\/+$/, ''),
  };
}

/** Presign a PUT URL for bucket/key, valid for `expires` seconds (capped to (0, 300]). */
export function presignPut(cfg, bucket, key, expires = 300) {
  return presign(cfg, 'PUT', bucket, key, expires);
}

/** Build the immutable CDN URL for a public object key ('' when no CDN base/key). */
export function publicUrl(cfg, key) {
  const k = String(key ?? '').replace(/^\/+/, '').trim();
  if (!cfg?.cdnBase || !k) return '';
  return `${cfg.cdnBase}/${uriEncode(k, false)}`;
}

function presign(cfg, method, bucket, key, expires) {
  if (!cfg) throw new Error('r2: not configured');
  bucket = String(bucket ?? '').trim().replace(/^\/+|\/+$/g, '');
  key = String(key ?? '').replace(/^\/+/, '').trim();
  if (!bucket || !key) throw new Error('r2: bucket and key are required');

  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // 20060102T150405Z
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalURI = `/${bucket}/${canonicalPath(key)}`;

  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiry(expires)),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = canonicalQueryString(params);
  const canonicalHeaders = `host:${host}\n`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    hashHex(`${canonicalURI}\n${canonicalQuery}\n${canonicalHeaders}\nhost\nUNSIGNED-PAYLOAD`),
  ].join('\n');

  const signature = createHmac('sha256', signingKey(cfg.secretKey, dateStamp)).update(stringToSign).digest('hex');
  return `https://${host}${canonicalURI}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** The SigV4 HMAC chain for R2's `auto` region and the S3 service. */
function signingKey(secret, dateStamp) {
  return deriveSigningKey(secret, dateStamp, 'auto', 's3');
}

/** Generic SigV4 signing-key derivation (exported for a documentation-vector test). */
export function deriveSigningKey(secret, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function expiry(d) {
  const secs = Math.floor(Number(d));
  return secs <= 0 || secs > 300 ? 300 : secs;
}

function canonicalQueryString(params) {
  return Object.keys(params)
    .sort()
    .map((k) => `${uriEncode(k, true)}=${uriEncode(params[k], true)}`)
    .join('&');
}

function canonicalPath(key) {
  return key.split('/').map((seg) => uriEncode(seg, true)).join('/');
}

/** AWS SigV4 RFC 3986 percent-encoding: [A-Za-z0-9-_.~] pass through; '/' passes when encodeSlash=false. */
export function uriEncode(s, encodeSlash) {
  let out = '';
  for (const ch of String(s)) {
    if (/[A-Za-z0-9\-_.~]/.test(ch)) out += ch;
    else if (ch === '/' && !encodeSlash) out += ch;
    else out += '%' + Buffer.from(ch, 'utf8').toString('hex').toUpperCase();
  }
  return out;
}

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

function hashHex(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}