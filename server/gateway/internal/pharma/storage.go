package pharma

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// ErrStorageDisabled is returned when Supabase Storage credentials are not configured.
var ErrStorageDisabled = errors.New("storage not configured")

// Storage mints Supabase Storage signed URLs (service_role). It never logs keys or object contents.
type Storage struct {
	baseURL string
	key     string
	bucket  string
	client  *http.Client
}

// NewStorage returns a Storage client, or nil when the URL/key are unset (storage disabled).
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

// SignUpload asks Storage for a signed upload URL for objectPath (private bucket).
func (s *Storage) SignUpload(ctx context.Context, objectPath string) (string, error) {
	if s == nil {
		return "", ErrStorageDisabled
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