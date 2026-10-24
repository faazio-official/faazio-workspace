package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// DefaultBaseURL is the Weather Union (Zomato giveback) current-weather endpoint.
const DefaultBaseURL = "https://www.weatherunion.com/gw/weather/external/v0/get_weather_data"

// API is the weather provider seam (a fake in tests, Weather Union in production).
type API interface {
	Enabled() bool
	Raining(ctx context.Context, lat, lng float64) (bool, error)
}

// Client is the minimal Weather Union HTTP client. It is disabled (Enabled=false) when the key is
// unset, so local/dev runs never make a network call and checkout degrades to "not raining".
type Client struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

// NewClient builds a Weather Union client. An empty baseURL falls back to the official endpoint.
func NewClient(baseURL, apiKey string) *Client {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = DefaultBaseURL
	}
	return &Client{
		baseURL: strings.TrimSpace(baseURL),
		apiKey:  strings.TrimSpace(apiKey),
		http:    &http.Client{Timeout: 6 * time.Second},
	}
}

// Enabled reports whether a key is configured.
func (c *Client) Enabled() bool { return c != nil && c.apiKey != "" && c.baseURL != "" }

type observation struct {
	RainIntensity float64 `json:"rain_intensity"`
}

type payload struct {
	Status              string      `json:"status"`
	Message             string      `json:"message"`
	DeviceType          int         `json:"device_type"`
	LocalityWeatherData observation `json:"locality_weather_data"`
}

// Raining reports whether the locality is raining right now (rain_intensity > 0 mm/min).
func (c *Client) Raining(ctx context.Context, lat, lng float64) (bool, error) {
	if !c.Enabled() {
		return false, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url(lat, lng), nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("x-zomato-api-key", c.apiKey)
	req.Header.Set("accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return false, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("weather: http %d", resp.StatusCode)
	}

	var p payload
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&p); err != nil {
		return false, fmt.Errorf("weather: decode: %w", err)
	}
	if p.Status != "" && !strings.EqualFold(p.Status, "success") {
		return false, fmt.Errorf("weather: %s: %s", p.Status, p.Message)
	}
	return p.LocalityWeatherData.RainIntensity > 0, nil
}

func (c *Client) url(lat, lng float64) string {
	sep := "?"
	if strings.Contains(c.baseURL, "?") {
		sep = "&"
	}
	return c.baseURL + sep +
		"latitude=" + strconv.FormatFloat(lat, 'f', 6, 64) +
		"&longitude=" + strconv.FormatFloat(lng, 'f', 6, 64)
}
