// FCMSender delivers pushes straight from the gateway to Firebase Cloud Messaging (HTTP v1),
// authenticated with a server-side service account. No separate PUSH_WEBHOOK_URL relay is needed;
// the drain worker treats it like any other Sender. It never logs the token or the payload.
package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const (
	// fcmScope is the OAuth2 scope required to authorize FCM HTTP v1 sends.
	fcmScope = "https://www.googleapis.com/auth/firebase.messaging"
	// fcmEndpointTemplate is the FCM HTTP v1 send endpoint, per project.
	fcmEndpointTemplate = "https://fcm.googleapis.com/v1/projects/%s/messages:send"
	// fcmMaxErrorBody caps how much of a non-2xx response is surfaced in the error so a long/garbled
	// body cannot bloat the row state.
	fcmMaxErrorBody = 1024
)

// FCMSender delivers one push message to an FCM registration token via the HTTP v1 API. Safe for
// concurrent use (the oauth2 token source and http.Client are concurrency-safe). The token travels
// only in the request body.
type FCMSender struct {
	projectID  string
	endpoint   string
	httpClient *http.Client
	tokenSrc   oauth2.TokenSource
}

// NewFCMSender builds a sender calling FCM HTTP v1 directly. Mirroring NewWebhookSender, an empty
// project id or service account yields a nil Sender (worker stays disabled, admin drain returns
// 503 push_unconfigured). A non-nil error means the service account JSON is malformed — the caller
// should log one loud line and fall back rather than silently disabling pushes.
func NewFCMSender(projectID string, serviceAccountJSON []byte) (Sender, error) {
	if projectID == "" || len(bytes.TrimSpace(serviceAccountJSON)) == 0 {
		return nil, nil
	}
	conf, err := google.JWTConfigFromJSON(serviceAccountJSON, fcmScope)
	if err != nil {
		return nil, fmt.Errorf("fcm: parse service account: %w", err)
	}
	return &FCMSender{
		projectID:  projectID,
		endpoint:   fmt.Sprintf(fcmEndpointTemplate, projectID),
		httpClient: &http.Client{Timeout: 10 * time.Second},
		tokenSrc:   conf.TokenSource(context.Background()),
	}, nil
}

// Send delivers one message. A non-2xx response is an error so the outbox row becomes FAILED and
// retries (same contract as WebhookSender). The `data` blob is flattened to FCM's string-only data
// map; a malformed blob is dropped silently so the notification copy still delivers.
func (s *FCMSender) Send(ctx context.Context, token, title, body string, data []byte) error {
	if s == nil || s.projectID == "" {
		return errors.New("push FCM not configured")
	}
	tok, err := s.tokenSrc.Token()
	if err != nil {
		return fmt.Errorf("fcm: oauth token: %w", err)
	}

	message := map[string]any{"token": token}
	if title != "" || body != "" {
		message["notification"] = map[string]string{"title": title, "body": body}
	}
	if d := fcmStringData(data); len(d) > 0 {
		message["data"] = d
	}
	b, err := json.Marshal(map[string]any{"message": message})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)

	res, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("fcm: request: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(io.LimitReader(res.Body, fcmMaxErrorBody))
		return fmt.Errorf("fcm: status %d: %s", res.StatusCode, string(bodyBytes))
	}
	_, _ = io.Copy(io.Discard, res.Body)
	return nil
}

// fcmStringData flattens the outbox data JSON (created from map[string]any at enqueue time) into
// FCM's string-only data map so the request is always accepted by the HTTP v1 API. Numbers and
// booleans are stringified; nested objects are compact-JSON strings.
func fcmStringData(raw []byte) map[string]string {
	if len(raw) == 0 {
		return nil
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var obj map[string]any
	if err := dec.Decode(&obj); err != nil {
		return nil
	}
	out := make(map[string]string, len(obj))
	for k, v := range obj {
		switch t := v.(type) {
		case string:
			out[k] = t
		case json.Number:
			out[k] = t.String()
		case float64:
			out[k] = strconv.FormatFloat(t, 'f', -1, 64)
		case bool:
			out[k] = strconv.FormatBool(t)
		case nil:
			out[k] = ""
		default:
			if b, err := json.Marshal(t); err == nil {
				out[k] = string(b)
			}
		}
	}
	return out
}
