package ai

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
)

// Handler proxies AI requests to the Grok API.
type Handler struct {
	config *AIConfig
}

// NewHandler creates a new AI gateway handler.
func NewHandler(config *AIConfig) *Handler {
	return &Handler{config: config}
}

// NewConfig creates a AIConfig from the given parameters.
func NewConfig(baseURL, apiKey, modelID string) *AIConfig {
	return &AIConfig{
		BaseURL:    baseURL,
		APIKey:     apiKey,
		ModelID:    modelID,
	}
}

// ProxyRequest proxies the AI request to the Grok API.
func (h *Handler) ProxyRequest(ctx context.Context, req *AIRequest) (*AIResponse, error) {
	// Prepare the request to Grok API
	grokReq, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	grokURL := h.config.BaseURL + "/v1/chat/completions"

	httpReq, err := http.NewRequestWithContext(ctx, "POST", grokURL, strings.NewReader(string(grokReq)))
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+h.config.APIKey)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, &apiError{
			status:  resp.StatusCode,
			message: string(body),
		}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var grokResp AIResponse
	if err := json.Unmarshal(body, &grokResp); err != nil {
		return nil, err
	}

	return &grokResp, nil
}

// ModelID returns the model ID configured for this gateway.
func (h *Handler) ModelID() string {
	return h.config.ModelID
}

// apiError represents an API error response.
type apiError struct {
	status  int
	message string
}

func (e *apiError) Error() string {
	return e.message
}

// ErrAPI returns an API error wrapping the status and message.
func ErrAPI(status int, message string) error {
	return &apiError{status: status, message: message}
}

// IsAPIError checks if an error is an API error.
func IsAPIError(err error) bool {
	var apiErr *apiError
	return errors.As(err, &apiErr)
}