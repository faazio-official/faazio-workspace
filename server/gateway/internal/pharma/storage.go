package pharma

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/faazio/server/gateway/internal/platform/r2"
)

// ErrStorageDisabled is returned when Supabase Storage credentials are not configured.
var ErrStorageDisabled = errors.New("storage not configured")

// Storage mints signed URLs for prescription images. It prefers the shared R2 private bucket (one
// binary backend, one signing path) and falls back to Supabase Storage when R2 is unconfigured. It
// never logs keys or object contents.
type Storage struct {
	baseURL string
	key     string
	bucket  string
	client  *http.Client

	// r2 signs the private bucket directly (AWS SigV4). Nil when R2 is disabled.
	r2       *r2.Signer
	r2Bucket string
}

// NewStorage returns a Supabase Storage client, or nil when the URL/key are unset (storage disabled).
func NewStorage(baseURL, serviceKey, bucket string) *Storage {
	if strings.TrimSpace(baseURL) == "" || strings.TrimSpace(serviceKey) == "" {
		return nil
	}
	if bucket == "" {
		bucket = "prescriptions"
	}
	return &Storage{
		baseURL: strings.TrimRight(baseURL, "/"),
		key:     serviceKey,
		bucket:  bucket,
		client:  &http.Client{Timeout: 5 * time.Second},
	}
}

// NewR2Storage returns an R2-backed Storage, or nil when the signer is disabled. The private bucket is
// where Rx images live; they are never edge-cached and only reachable via short-lived presigned GETs.
func NewR2Storage(signer *r2.Signer) *Storage {
	if !signer.Enabled() {
		return nil
	}
	return &Storage{r2: signer, r2Bucket: signer.PrivateBucket()}
}

// SignUpload asks Storage for a signed upload URL for objectPath (private bucket).
func (s *Storage) SignUpload(ctx context.Context, objectPath string) (string, error) {
	if s == nil {
		return "", ErrStorageDisabled
	}
	if s.r2.Enabled() {
		return s.r2.PresignPut(ctx, s.r2Bucket, objectPath, 300*time.Second)
	}
	endpoint := fmt.Sprintf("%s/storage/v1/object/upload/sign/%s/%s", s.baseURL, s.bucket, objectPath)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.key)
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("storage sign upload: status %d", resp.StatusCode)
	}
	var out struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.URL == "" {
		return "", errors.New("storage returned no url")
	}
	if strings.HasPrefix(out.URL, "http") {
		return out.URL, nil
	}
	return s.baseURL + out.URL, nil
}

// SignDownload asks Storage for a short-lived signed download URL for objectPath (private bucket).
// Used by the owner/vendor projections to render Rx images without ever making the bucket public.
func (s *Storage) SignDownload(ctx context.Context, objectPath string, expiresIn int) (string, error) {
	if s == nil {
		return "", ErrStorageDisabled
	}
	if s.r2.Enabled() {
		secs := expiresIn
		if secs <= 0 || secs > 3600 {
			secs = 300
		}
		return s.r2.PresignGet(ctx, s.r2Bucket, objectPath, time.Duration(secs)*time.Second)
	}
	if expiresIn <= 0 || expiresIn > 3600 {
		expiresIn = 300
	}
	endpoint := fmt.Sprintf("%s/storage/v1/object/sign/%s/%s", s.baseURL, s.bucket, objectPath)
	body, _ := json.Marshal(map[string]int{"expiresIn": expiresIn})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("storage sign download: status %d", resp.StatusCode)
	}
	var out struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.SignedURL == "" {
		return "", errors.New("storage returned no signed url")
	}
	if strings.HasPrefix(out.SignedURL, "http") {
		return out.SignedURL, nil
	}
	// Supabase returns a path like "/object/sign/..."; prefix the storage host for a usable URL.
	path := out.SignedURL
	if !strings.HasPrefix(path, "/storage/v1") {
		path = "/storage/v1" + path
	}
	return s.baseURL + path, nil
}
