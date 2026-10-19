// Package r2 mints Cloudflare R2 presigned URLs (AWS Signature V4, query-string presign) and builds
// public CDN URLs. It is domain-free platform code so every context (media registry, pharma Rx, seller
// KYC) can share one signing path without a cross-context import.
//
// Why a hand-rolled signer and not aws-sdk-go-v2/service/s3: the SDK's current release requires the Go
// 1.24 toolchain (this module pins go 1.22) and pulls ~10 modules into the gateway, against the
// AGENTS.md "lightweight / no unused deps" mandate. Query-string SigV4 is a small, well-specified
// algorithm; the HMAC chain is unit-tested against the AWS documentation vector.
//
// Secrets are read from the environment only and never logged. A nil *Signer (credentials unset) means
// "media disabled": callers return 503 instead of minting unsigned/broken URLs.
package r2

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ErrDisabled is returned when R2 credentials are not configured.
var ErrDisabled = errors.New("r2 not configured")

// httpClient is the shared client for server-initiated object operations (GC deletes). Bytes never
// proxy through the gateway in normal upload/read flows — only a server-side delete is initiated here.
var httpClient = &http.Client{Timeout: 15 * time.Second}

// Config holds R2 credentials + bucket/domain settings.
type Config struct {
	AccountID     string
	AccessKeyID   string
	SecretKey     string
	PublicBucket  string
	PrivateBucket string
	// CDNBase is the custom domain in front of the public bucket, e.g. https://img.faazio.in. Optional:
	// when empty, public objects are served through PublicBase + /assets/{key}.
	CDNBase string
	// PublicBase is the gateway's own public origin (e.g. https://gateway.faazio.com). When CDNBase is
	// unset but this is set, public object URLs are built as PublicBase/assets/{key} and the gateway
	// 302-redirects them to a short-lived presigned GET.
	PublicBase string
}

// Signer presigns R2 requests. Use New; a nil *Signer is a safe no-op that reports ErrDisabled.
type Signer struct {
	accountID     string
	accessKeyID   string
	secretKey     string
	publicBucket  string
	privateBucket string
	cdnBase       string
	publicBase    string
	now           func() time.Time
}

// New returns a Signer, or nil when account id/access key/secret are unset (media disabled).
func New(cfg Config) *Signer {
	cfg.AccountID = strings.TrimSpace(cfg.AccountID)
	cfg.AccessKeyID = strings.TrimSpace(cfg.AccessKeyID)
	cfg.SecretKey = strings.TrimSpace(cfg.SecretKey)
	if cfg.AccountID == "" || cfg.AccessKeyID == "" || cfg.SecretKey == "" {
		return nil
	}
	if cfg.PublicBucket == "" {
		cfg.PublicBucket = "faazio-public"
	}
	if cfg.PrivateBucket == "" {
		cfg.PrivateBucket = "faazio-private"
	}
	return &Signer{
		accountID:     cfg.AccountID,
		accessKeyID:   cfg.AccessKeyID,
		secretKey:     cfg.SecretKey,
		publicBucket:  cfg.PublicBucket,
		privateBucket: cfg.PrivateBucket,
		cdnBase:       strings.TrimRight(strings.TrimSpace(cfg.CDNBase), "/"),
		publicBase:    strings.TrimRight(strings.TrimSpace(cfg.PublicBase), "/"),
		now:           time.Now,
	}
}

// Enabled reports whether the signer has credentials.
func (s *Signer) Enabled() bool { return s != nil && s.secretKey != "" }

// PublicBucket returns the public bucket name (empty when disabled).
func (s *Signer) PublicBucket() string {
	if s == nil {
		return ""
	}
	return s.publicBucket
}

// PrivateBucket returns the private bucket name (empty when disabled).
func (s *Signer) PrivateBucket() string {
	if s == nil {
		return ""
	}
	return s.privateBucket
}

// BucketFor maps an asset kind to its bucket name.
func (s *Signer) BucketFor(private bool) string {
	if private {
		return s.PrivateBucket()
	}
	return s.PublicBucket()
}

// PublicURL builds the browser-usable URL for a public object key. Returns "" when no public origin is
// configured or key is empty. With a CDN custom domain the URL is immutable and edge-cacheable; without
// one it is the gateway's stable /assets/{key} path, which 302-redirects to a short-lived presigned GET.
func (s *Signer) PublicURL(key string) string {
	key = strings.TrimLeft(strings.TrimSpace(key), "/")
	if s == nil || key == "" {
		return ""
	}
	switch {
	case s.cdnBase != "":
		return s.cdnBase + "/" + uriEncode(key, false)
	case s.publicBase != "":
		return s.publicBase + "/assets/" + uriEncode(key, false)
	default:
		return ""
	}
}

// MediaBase returns the prefix that readers append "/"+key to for public object URLs: the CDN custom
// domain when configured, else the gateway's own /assets route, else "" (public media unresolvable).
func (s *Signer) MediaBase() string {
	if s == nil {
		return ""
	}
	if s.cdnBase != "" {
		return s.cdnBase
	}
	if s.publicBase != "" {
		return s.publicBase + "/assets"
	}
	return ""
}

// PublicOrigin returns the origin used by the ads poster host allow-list: the CDN custom domain when
// configured, else the gateway's public base, else "" (any https host accepted — media disabled).
func (s *Signer) PublicOrigin() string {
	if s == nil {
		return ""
	}
	if s.cdnBase != "" {
		return s.cdnBase
	}
	return s.publicBase
}

// PresignPut returns a short-lived presigned PUT URL for bucket/key. The client uploads the bytes
// directly to R2; binary never proxies through the gateway.
func (s *Signer) PresignPut(_ context.Context, bucket, key string, expires time.Duration) (string, error) {
	return s.presign("PUT", bucket, key, expires)
}

// PresignGet returns a short-lived presigned GET URL. Used for private objects (Rx/KYC) and, when no
// CDN custom domain is configured, for public objects served through the gateway's /assets redirect.
func (s *Signer) PresignGet(_ context.Context, bucket, key string, expires time.Duration) (string, error) {
	return s.presign("GET", bucket, key, expires)
}

// PresignDelete returns a short-lived presigned DELETE URL (GC of orphaned objects).
func (s *Signer) PresignDelete(_ context.Context, bucket, key string, expires time.Duration) (string, error) {
	return s.presign("DELETE", bucket, key, expires)
}

// DeleteObject removes an object from R2 by issuing a presigned DELETE. It is the one server-initiated
// object write (the media GC sweeper); a nil signer returns ErrDisabled. A 404 is treated as success
// (idempotent — the object is already gone).
func (s *Signer) DeleteObject(ctx context.Context, bucket, key string) error {
	url, err := s.PresignDelete(ctx, bucket, key, time.Minute)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return err
	}
	res, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode == http.StatusNotFound {
		return nil
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("r2: delete object returned %d", res.StatusCode)
	}
	return nil
}

// Expiry caps a requested TTL to (0, 300s] and applies the 300s default — presigned URLs are always
// short-lived (AGENTS.md security).
func Expiry(d time.Duration) int {
	secs := int(d / time.Second)
	if secs <= 0 || secs > 300 {
		return 300
	}
	return secs
}

func (s *Signer) presign(method, bucket, key string, expires time.Duration) (string, error) {
	if !s.Enabled() {
		return "", ErrDisabled
	}
	bucket = strings.Trim(strings.TrimSpace(bucket), "/")
	key = strings.TrimLeft(strings.TrimSpace(key), "/")
	if bucket == "" || key == "" {
		return "", errors.New("r2: bucket and key are required")
	}
	host := s.accountID + ".r2.cloudflarestorage.com"
	now := s.now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	scope := dateStamp + "/auto/s3/aws4_request"

	canonicalURI := "/" + bucket + "/" + canonicalPath(key)

	params := map[string]string{
		"X-Amz-Algorithm":     "AWS4-HMAC-SHA256",
		"X-Amz-Credential":    s.accessKeyID + "/" + scope,
		"X-Amz-Date":          amzDate,
		"X-Amz-Expires":       strconv.Itoa(Expiry(expires)),
		"X-Amz-SignedHeaders": "host",
	}
	canonicalQuery := canonicalQueryString(params)

	canonicalHeaders := "host:" + host + "\n"
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		hashHex([]byte(canonicalURI + "\n" + canonicalQuery + "\n" + canonicalHeaders + "\n" + "host" + "\n" + "UNSIGNED-PAYLOAD")),
	}, "\n")

	signature := hex.EncodeToString(hmacSHA256(s.signingKey(dateStamp), []byte(stringToSign)))

	return "https://" + host + canonicalURI + "?" + canonicalQuery + "&X-Amz-Signature=" + signature, nil
}

// signingKey derives the SigV4 signing key (HMAC chain) for R2's `auto` region and the S3 service.
func (s *Signer) signingKey(dateStamp string) []byte {
	return deriveSigningKey(s.secretKey, dateStamp, "auto", "s3")
}

// deriveSigningKey is the generic SigV4 HMAC chain (exposed for the AWS documentation vector test).
func deriveSigningKey(secret, dateStamp, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), []byte(dateStamp))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(service))
	return hmacSHA256(kService, []byte("aws4_request"))
}

func canonicalQueryString(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, uriEncode(k, true)+"="+uriEncode(params[k], true))
	}
	return strings.Join(parts, "&")
}

// canonicalPath URI-encodes each segment of an object key but preserves the separating slashes.
func canonicalPath(key string) string {
	segs := strings.Split(key, "/")
	for i, seg := range segs {
		segs[i] = uriEncode(seg, true)
	}
	return strings.Join(segs, "/")
}

// uriEncode implements the AWS SigV4 RFC 3986 percent-encoding. Unreserved bytes [A-Za-z0-9-_.~] pass
// through; when encodeSlash is false a '/' passes through too.
func uriEncode(s string, encodeSlash bool) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c >= '0' && c <= '9', c == '-', c == '_', c == '.', c == '~':
			b.WriteByte(c)
		case c == '/' && !encodeSlash:
			b.WriteByte(c)
		default:
			b.WriteString("%")
			b.WriteString(strings.ToUpper(hex.EncodeToString([]byte{c})))
		}
	}
	return b.String()
}

func hmacSHA256(key, data []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	return mac.Sum(nil)
}

func hashHex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
