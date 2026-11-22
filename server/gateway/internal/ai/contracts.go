package ai

import "context"

// AIRequest represents a request to the Grok AI API.
type AIRequest struct {
	Model    string         `json:"model,omitempty"`
	Messages []ChatMessage  `json:"messages"`
	Stream   bool           `json:"stream,omitempty"`
	Temperature float64     `json:"temperature,omitempty"`
	MaxTokens   *int         `json:"max_tokens,omitempty"`
}

// ChatMessage represents a single message in the chat conversation.
type ChatMessage struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	ToolCalls any    `json:"tool_calls,omitempty"`
}

// AIResponse represents the response from the Grok AI API.
type AIResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   Usage  `json:"usage"`
}

// Choice represents a choice in the AI response.
type Choice struct {
	Index   int      `json:"index"`
	Message ChatMessage `json:"message"`
	Logprobs any      `json:"logprobs,omitempty"`
	FinishReason string `json:"finish_reason"`
}

// Usage represents token usage information.
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// AIConfig holds the configuration for the AI gateway.
type AIConfig struct {
	BaseURL    string
	APIKey     string
	ModelID    string
}

// AIContract defines the interface for AI gateway operations.
type AIContract interface {
	ProxyRequest(ctx context.Context, req *AIRequest) (*AIResponse, error)
	ModelID() string
}