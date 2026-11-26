package r2

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"
)

// Live probe (RUN_LIVE_R2=1): presign a PUT and send 1 byte, printing the real status. Not part of
// the normal suite; used to confirm whether a presigned upload is rejected (e.g. 403).
func TestLivePresignPut(t *testing.T) {
	if os.Getenv("RUN_LIVE_R2") != "1" {
		t.Skip("set RUN_LIVE_R2=1 to probe the real bucket")
	}
	s := New(Config{
		AccountID:     os.Getenv("R2_ACCOUNT_ID"),
		AccessKeyID:   os.Getenv("R2_ACCESS_KEY_ID"),
		SecretKey:     os.Getenv("R2_SECRET_ACCESS_KEY"),
		PublicBucket:  os.Getenv("R2_PUBLIC_BUCKET"),
		PrivateBucket: os.Getenv("R2_PRIVATE_BUCKET"),
		CDNBase:       os.Getenv("R2_CDN_BASE"),
	})
	if !s.Enabled() {
		t.Fatal("signer disabled: R2 env not set")
	}
	bucket := s.PrivateBucket()
	key := fmt.Sprintf("zz-probe/%d.txt", time.Now().UnixNano())
	url, err := s.PresignPut(context.Background(), bucket, key, 5*time.Minute)
	if err != nil {
		t.Fatalf("presign: %v", err)
	}
	t.Logf("PUT %s/%s", bucket, key)
	req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader([]byte("x")))
	req.Header.Set("Content-Type", "application/octet-stream")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("put: %v", err)
	}
	defer res.Body.Close()
	t.Logf("status=%d", res.StatusCode)
	buf := make([]byte, 512)
	n, _ := res.Body.Read(buf)
	t.Logf("body=%s", string(buf[:n]))
	if res.StatusCode >= 300 {
		t.Fatalf("presigned PUT rejected: %d", res.StatusCode)
	}
	// GET on a missing key: a valid signature yields 404 NoSuchKey; a bad one yields 403.
	getURL, _ := s.PresignGet(context.Background(), bucket, "zz-probe/does-not-exist.txt", 5*time.Minute)
	gres, err := http.Get(getURL)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer gres.Body.Close()
	t.Logf("GET status=%d (400/403 would be a signature bug; 404 is expected)", gres.StatusCode)
	if gres.StatusCode == 403 {
		t.Fatalf("presigned GET rejected: 403")
	}
	_ = s.DeleteObject(context.Background(), bucket, key)
}
