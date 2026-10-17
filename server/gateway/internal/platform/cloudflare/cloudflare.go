// Package cloudflare talks to the Cloudflare API. Its single MVP responsibility is purging cached
// object URLs (the public R2 CDN under `img.faazio.in`) when a media asset changes or is removed, so
// an immutable-key cache can still be invalidated on moderation/delete.
//
// A nil *Purger (zone id or API token unset) means "purge disabled": callers skip the call and the
// content simply expires via its Cache Rule. The API token is never logged.
package cloudflare

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// maxFilesPerPurge is the Cloudflare `purge_cache` per-request limit for the `files` selector.
const maxFilesPerPurge = 30

// defaultBaseURL is the Cloudflare API v4 root; overridable in tests.
const defaultBaseURL = "https://api.cloudflare.com/client/v4"

// Config holds the zone id + API token. Both must be set to enable purging.
type Config struct {
	ZoneID   string
	APIToken string
}

// Purger issues cache purges for a zone. Use New; a nil *Purger is a safe no-op that reports disabled.
type Purger struct {
	zoneID   string
	apiToken string
	baseURL  string
	client   *http.Client
}

// New returns a Purger, or nil when the zone id / API token are unset (purging disabled).
func New(cfg Config) *Purger {
	zoneID := strings.TrimSpace(cfg.ZoneID)
	apiToken := strings.TrimSpace(cfg.APIToken)
	if zoneID == "" || apiToken == "" {
		return nil
	}
	return &Purger{
		zoneID:   zoneID,
		apiToken: apiToken,
		baseURL:  defaultBaseURL,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
}

// Enabled reports whether the purger has credentials.
func (p *Purger) Enabled() bool { return p != nil && p.apiToken != "" }

// PurgeURLs purges the given absolute URLs from the zone cache. It chunks to the API limit and is a
// no-op for an empty list. A nil purger returns nil (disabled is not an error for best-effort callers).
func (p *Purger) PurgeURLs(ctx context.Context, urls []string) error {
	if !p.Enabled() {
		return nil
	}
	files := uniqueNonEmpty(urls)
	for start := 0; start < len(files); start += maxFilesPerPurge {
		end := start + maxFilesPerPurge
		if end > len(files) {
			end = len(files)
		}
		if err := p.purgeFiles(ctx, files[start:end]); err != nil {
			return err
		}
	}
	return nil
}

func (p *Purger) purgeFiles(ctx context.Context, files []string) error {
	body, err := json.Marshal(map[string]any{"files": files})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		p.baseURL+"/zones/"+p.zoneID+"/purge_cache", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiToken)
	req.Header.Set("Content-Type", "application/json")

	res, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = res.Body.Close() }()

	var parsed struct {
		Success bool `json:"success"`
		Errors  []struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"errors"`
	}
	_ = json.NewDecoder(res.Body).Decode(&parsed)
	if res.StatusCode < 200 || res.StatusCode >= 300 || !parsed.Success {
		return fmt.Errorf("cloudflare: purge_cache failed (status %d)", res.StatusCode)
	}
	return nil
}

func uniqueNonEmpty(urls []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(urls))
	for _, u := range urls {
		if u = strings.TrimSpace(u); u == "" {
			continue
		}
		if _, dup := seen[u]; dup {
			continue
		}
		seen[u] = struct{}{}
		out = append(out, u)
	}
	return out
}
