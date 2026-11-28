package sdui

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// SDUI layout control plane (schema 1.2).
//
// A layout is the versioned, district-targeted payload a screen renders: one header theme plus an
// ordered widget list with explicit schedules. It is validated here — strictly — before it is
// stored, because a malformed payload crashes the bare React Native renderer. The Go check is the
// source of truth; the portal's Zod schema mirrors these rules for inline feedback only.

// SchemaVersion is the only payload contract this build accepts.
const SchemaVersion = "1.2"

// LayoutTTLSeconds is the Valkey/cache TTL for a compiled screen layout.
const LayoutTTLSeconds = 60

// MaxPayloadBytes caps a stored payload (jsonb).
const MaxPayloadBytes = 256 * 1024

// Verticals are the app verticals a layout can target.
var Verticals = []string{"home", "food", "mart", "grocery", "pharma"}

// Screens are the SDUI screens a layout can target.
var Screens = []string{"home", "category_landing"}

// Slots are the fixed slots a widget may occupy on a screen.
var Slots = []string{"top_header_theme", "hero_banner", "quick_filter_pills", "spotlight_rail"}

// WidgetTypes are the renderer-registered widget types (see WidgetRenderer.tsx on mobile).
var WidgetTypes = []string{"HERO_PROMO_BANNER", "SPOTLIGHT_RAIL", "QUICK_FILTER_PILLS", "OFFER_STRIP"}

var (
	hexColorRe   = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
	widgetIDRe   = regexp.MustCompile(`^[a-z0-9][a-z0-9_]{2,63}$`)
	couponRe     = regexp.MustCompile(`^[A-Z0-9]{3,24}$`)
	aspectRatios = map[string]bool{"16:10": true, "16:9": true, "1:1": true, "4:3": true, "3:2": true, "2:3": true, "9:16": true}
	mediaKinds   = map[string]bool{"image": true, "lottie": true, "video": true}
	expireActs   = map[string]bool{"SWAP_TO_FALLBACK": true, "LOCK_OVERLAY": true}
	actionTypes  = map[string]bool{"DEEP_LINK": true, "NONE": true}
	statusStyles = map[string]bool{"light": true, "dark": true}
)

// HeaderTheme tints the native top area (status bar, header surface, search bar) to match the hero.
type HeaderTheme struct {
	BackgroundHex  string `json:"background_hex"`
	SearchBarBgHex string `json:"search_bar_bg_hex"`
	StatusBarStyle string `json:"status_bar_style"`
}

// WidgetMedia is the optional banner asset. `url` is an immutable CDN URL; `fallback_image_url`
// is shown when a Lottie/video asset fails to load.
type WidgetMedia struct {
	Kind             string `json:"kind"`
	URL              string `json:"url"`
	FallbackImageURL string `json:"fallback_image_url,omitempty"`
	AspectRatio      string `json:"aspect_ratio"`
}

// WidgetSchedule is the exact-second window. `on_expire_action` runs on the client the moment the
// server-adjusted clock passes `expires_at_utc`.
type WidgetSchedule struct {
	StartsAtUTC      string `json:"starts_at_utc"`
	ExpiresAtUTC     string `json:"expires_at_utc"`
	OnExpireAction   string `json:"on_expire_action"`
	FallbackWidgetID string `json:"fallback_widget_id,omitempty"`
}

// WidgetAction is what a tap does. `auto_apply_coupon` is still re-checked server-side at checkout.
type WidgetAction struct {
	Type            string `json:"type"`
	Route           string `json:"route,omitempty"`
	AutoApplyCoupon string `json:"auto_apply_coupon,omitempty"`
}

// WidgetCopy is the typographic content for a code-rendered banner (no media required).
type WidgetCopy struct {
	Eyebrow        string `json:"eyebrow,omitempty"`
	Headline       string `json:"headline,omitempty"`
	AccentHeadline string `json:"accent_headline,omitempty"`
	Body           string `json:"body,omitempty"`
	CodeLabel      string `json:"code_label,omitempty"`
	Code           string `json:"code,omitempty"`
	CTA            string `json:"cta,omitempty"`
}

// Widget is one ordered unit on a screen.
type Widget struct {
	WidgetID string          `json:"widget_id"`
	Type     string          `json:"type"`
	Slot     string          `json:"slot"`
	Priority int             `json:"priority"`
	Media    *WidgetMedia    `json:"media,omitempty"`
	Schedule *WidgetSchedule `json:"schedule,omitempty"`
	Action   *WidgetAction   `json:"action,omitempty"`
	Copy     *WidgetCopy     `json:"copy,omitempty"`
}

// Payload is the stored/validated layout body (everything except server-injected envelope fields).
type Payload struct {
	SchemaVersion string      `json:"schema_version"`
	HeaderTheme   HeaderTheme `json:"header_theme"`
	Widgets       []Widget    `json:"widgets"`
}

// FieldError is one validation failure, addressed by a JSON path so the portal can point at a field.
type FieldError struct {
	Path    string `json:"path"`
	Message string `json:"message"`
}

func (e FieldError) Error() string { return e.Path + ": " + e.Message }

// ValidationError carries every field error from one payload.
type ValidationError struct {
	Errors []FieldError `json:"errors"`
}

func (v *ValidationError) Error() string {
	if len(v.Errors) == 0 {
		return "sdui: invalid payload"
	}
	return fmt.Sprintf("sdui: %d validation error(s): %s", len(v.Errors), v.Errors[0].Error())
}

// DecodePayload parses a raw layout body with unknown fields rejected (strict contract) and returns
// the decoded payload plus any field errors. A syntax error is reported as a FieldError on `$`.
func DecodePayload(raw []byte) (*Payload, *ValidationError) {
	if len(raw) == 0 {
		return nil, &ValidationError{Errors: []FieldError{{Path: "$", Message: "payload is empty"}}}
	}
	if len(raw) > MaxPayloadBytes {
		return nil, &ValidationError{Errors: []FieldError{{Path: "$", Message: "payload exceeds 256 KiB"}}}
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var p Payload
	if err := dec.Decode(&p); err != nil {
		return nil, &ValidationError{Errors: []FieldError{{Path: "$", Message: "malformed JSON: " + err.Error()}}}
	}
	if dec.More() {
		return nil, &ValidationError{Errors: []FieldError{{Path: "$", Message: "trailing data after the layout object"}}}
	}
	if verr := p.Validate(); verr != nil {
		return &p, verr
	}
	return &p, nil
}

// Validate enforces the complete schema-1.2 contract.
func (p *Payload) Validate() *ValidationError {
	var errs []FieldError
	add := func(path, msg string) { errs = append(errs, FieldError{Path: path, Message: msg}) }

	if p.SchemaVersion != SchemaVersion {
		add("schema_version", "must be "+SchemaVersion)
	}
	if !hexColorRe.MatchString(p.HeaderTheme.BackgroundHex) {
		add("header_theme.background_hex", "must be a #RRGGBB hex colour")
	}
	if !hexColorRe.MatchString(p.HeaderTheme.SearchBarBgHex) {
		add("header_theme.search_bar_bg_hex", "must be a #RRGGBB hex colour")
	}
	if !statusStyles[p.HeaderTheme.StatusBarStyle] {
		add("header_theme.status_bar_style", "must be light or dark")
	}

	if len(p.Widgets) == 0 {
		add("widgets", "at least one widget is required")
	}
	if len(p.Widgets) > 30 {
		add("widgets", "at most 30 widgets per layout")
	}

	ids := make(map[string]int, len(p.Widgets))
	priorities := make(map[int]string, len(p.Widgets))
	for i, w := range p.Widgets {
		base := fmt.Sprintf("widgets[%d]", i)
		if !widgetIDRe.MatchString(w.WidgetID) {
			add(base+".widget_id", "must be lower-case letters, digits or underscores (3-64 chars)")
		} else if prev, dup := ids[w.WidgetID]; dup {
			add(base+".widget_id", fmt.Sprintf("duplicate of %s", fmt.Sprintf("widgets[%d].widget_id", prev)))
		} else {
			ids[w.WidgetID] = i
		}
		if !contains(WidgetTypes, w.Type) {
			add(base+".type", "unknown widget type "+w.Type)
		}
		if !contains(Slots, w.Slot) {
			add(base+".slot", "unknown slot "+w.Slot)
		}
		if w.Priority < 1 {
			add(base+".priority", "must be 1 or greater")
		} else if prev, dup := priorities[w.Priority]; dup {
			add(base+".priority", fmt.Sprintf("duplicate of %s", prev))
		} else {
			priorities[w.Priority] = base + ".priority"
		}

		if w.Media != nil {
			if !mediaKinds[w.Media.Kind] {
				add(base+".media.kind", "must be image, lottie or video")
			}
			if w.Media.URL != "" && !strings.HasPrefix(w.Media.URL, "https://") {
				add(base+".media.url", "must be an https:// CDN URL")
			}
			if w.Media.FallbackImageURL != "" && !strings.HasPrefix(w.Media.FallbackImageURL, "https://") {
				add(base+".media.fallback_image_url", "must be an https:// CDN URL")
			}
			if w.Media.AspectRatio != "" && !aspectRatios[w.Media.AspectRatio] {
				add(base+".media.aspect_ratio", "unsupported aspect ratio")
			}
		}

		if w.Schedule != nil {
			start, serr := time.Parse(time.RFC3339, w.Schedule.StartsAtUTC)
			if serr != nil {
				add(base+".schedule.starts_at_utc", "must be an RFC3339 UTC timestamp")
			}
			exp, eerr := time.Parse(time.RFC3339, w.Schedule.ExpiresAtUTC)
			if eerr != nil {
				add(base+".schedule.expires_at_utc", "must be an RFC3339 UTC timestamp")
			}
			if serr == nil && eerr == nil && !exp.After(start) {
				add(base+".schedule.expires_at_utc", "must be after starts_at_utc")
			}
			if !expireActs[w.Schedule.OnExpireAction] {
				add(base+".schedule.on_expire_action", "must be SWAP_TO_FALLBACK or LOCK_OVERLAY")
			}
			if w.Schedule.OnExpireAction == "SWAP_TO_FALLBACK" && strings.TrimSpace(w.Schedule.FallbackWidgetID) == "" {
				add(base+".schedule.fallback_widget_id", "required when on_expire_action is SWAP_TO_FALLBACK")
			}
		}

		if w.Action != nil {
			if !actionTypes[w.Action.Type] {
				add(base+".action.type", "must be DEEP_LINK or NONE")
			}
			if w.Action.Type == "DEEP_LINK" && !strings.HasPrefix(w.Action.Route, "faazio://") {
				add(base+".action.route", "must start with faazio://")
			}
			if w.Action.AutoApplyCoupon != "" && !couponRe.MatchString(w.Action.AutoApplyCoupon) {
				add(base+".action.auto_apply_coupon", "must be 3-24 upper-case letters or digits")
			}
		}

		if w.Copy != nil {
			caps := map[string]int{
				"eyebrow": 32, "headline": 60, "accent_headline": 12,
				"body": 120, "code_label": 12, "code": 24, "cta": 28,
			}
			vals := map[string]string{
				"eyebrow": w.Copy.Eyebrow, "headline": w.Copy.Headline, "accent_headline": w.Copy.AccentHeadline,
				"body": w.Copy.Body, "code_label": w.Copy.CodeLabel, "code": w.Copy.Code, "cta": w.Copy.CTA,
			}
			for field, limit := range caps {
				if len(vals[field]) > limit {
					add(base+".copy."+field, fmt.Sprintf("must be %d characters or fewer", limit))
				}
			}
			if w.Copy.CTA == "" && (w.Type == "HERO_PROMO_BANNER" || w.Type == "OFFER_STRIP") {
				add(base+".copy.cta", "required for "+w.Type)
			}
		} else if w.Type == "HERO_PROMO_BANNER" {
			add(base+".copy", "HERO_PROMO_BANNER needs copy (eyebrow, headline and cta)")
		}
	}

	// Fallback ids are resolved only after every widget id is known.
	for i, w := range p.Widgets {
		if w.Schedule == nil || w.Schedule.OnExpireAction != "SWAP_TO_FALLBACK" {
			continue
		}
		fb := strings.TrimSpace(w.Schedule.FallbackWidgetID)
		if fb == "" {
			continue
		}
		if fb == w.WidgetID {
			add(fmt.Sprintf("widgets[%d].schedule.fallback_widget_id", i), "cannot point at itself")
		} else if _, ok := ids[fb]; !ok {
			add(fmt.Sprintf("widgets[%d].schedule.fallback_widget_id", i), "fallback widget "+fb+" is not in this layout")
		}
	}

	if len(errs) > 0 {
		return &ValidationError{Errors: errs}
	}
	return nil
}

// AsValidationError reports whether err is a payload validation failure.
func AsValidationError(err error) (*ValidationError, bool) {
	var ve *ValidationError
	if errors.As(err, &ve) {
		return ve, true
	}
	return nil, false
}

func contains(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}
