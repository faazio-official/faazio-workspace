package appconfig

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidKey(t *testing.T) {
	valid := []string{"brand.primary_color", "maps.places_api_key", "a", "a.b-c_d", "region.default", "trailing-", "x" + strings.Repeat("a", 62)}
	invalid := []string{"", "Bad Key", "UPPER", "-lead", "a b", "a/b", strings.Repeat("a", 65)}
	for _, k := range valid {
		if !validKey(k) {
			t.Errorf("validKey(%q) = false, want true", k)
		}
	}
	for _, k := range invalid {
		if validKey(k) {
			t.Errorf("validKey(%q) = true, want false", k)
		}
	}
}

func TestValidCategoryAndVariant(t *testing.T) {
	for _, c := range []string{"brand", "maps", "region", "feature", "maintenance", "limits"} {
		if !validCategory(c) {
			t.Errorf("validCategory(%q) = false, want true", c)
		}
	}
	for _, c := range []string{"", "BRAND", "design", "theme"} {
		if validCategory(c) {
			t.Errorf("validCategory(%q) = true, want false", c)
		}
	}
	for _, v := range []string{"customer", "delivery", "seller", "all"} {
		if !validVariant(v) {
			t.Errorf("validVariant(%q) = false, want true", v)
		}
	}
	if validVariant("CUSTOMER") || validVariant("") || validVariant("web") {
		t.Error("validVariant accepted an invalid variant")
	}
}

func TestIsJSONNull(t *testing.T) {
	if !isJSONNull(json.RawMessage("null")) {
		t.Error("isJSONNull(null) = false, want true")
	}
	if !isJSONNull(nil) {
		t.Error("isJSONNull(empty) = false, want true")
	}
	if isJSONNull(json.RawMessage(`"x"`)) || isJSONNull(json.RawMessage("{}")) {
		t.Error("isJSONNull accepted a real value")
	}
}

func TestSnapshotOmitsSecretValue(t *testing.T) {
	secret := Row{Key: "auth.secret", Category: "limits", Value: json.RawMessage(`"topsecret"`),
		IsPublic: false, AppVariant: "all", ValueSecret: true, Description: "ops", UpdatedBy: "admin", UpdatedAt: "2026-01-01T00:00:00Z"}
	out := snapshot(secret, true)
	if s := string(out); strings.Contains(s, "topsecret") {
		t.Fatalf("audit snapshot leaked the secret: %s", s)
	}
	var v auditView
	if err := json.Unmarshal(out, &v); err != nil {
		t.Fatalf("snapshot did not unmarshal: %v", err)
	}
	if !v.ValueSecret {
		t.Error("snapshot lost value_secret flag")
	}
	if len(v.Value) != 0 {
		t.Error("secret snapshot must omit the value field")
	}

	public := Row{Key: "brand.primary_color", Category: "brand", Value: json.RawMessage(`"#4250FF"`),
		IsPublic: true, AppVariant: "all", Description: "brand", UpdatedAt: "2026-01-01T00:00:00Z"}
	out = snapshot(public, true)
	if !strings.Contains(string(out), "#4250FF") {
		t.Errorf("public snapshot lost the value: %s", out)
	}

	if string(snapshot(Row{}, false)) != "null" {
		t.Error("snapshot of a missing row must be null")
	}
}

func TestUpsertHandlerValidation(t *testing.T) {
	h := NewHandler(nil, nil) // nil repo: any attempt to hit the DB fails, so a 400 means validation ran first.
	body := `{"category":"brand","value":"\"#000\""}`

	for _, tt := range []struct {
		name string
		key  string
		body string
	}{
		{"invalid key uppercase", "BadKey", body},
		{"invalid key leading dash", "-bad", body},
		{"invalid key empty", "", body},
		{"unknown category", "brand.x", `{"category":"theme","value":"\"#000\""}`},
		{"invalid variant", "brand.x", `{"category":"brand","value":"1","appVariant":"web"}`},
		{"public plus secret", "brand.x", `{"category":"brand","value":"1","isPublic":true,"valueSecret":true}`},
		{"value too large", "brand.x", `{"category":"brand","value":"` + strings.Repeat("1", MaxValueBytes+1) + `"}`},
		{"body not json", "brand.x", `{`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPut, "/admin/app-config/"+tt.key, strings.NewReader(tt.body))
			req.SetPathValue("key", tt.key)
			rr := httptest.NewRecorder()
			h.upsert(rr, req)
			if rr.Code != http.StatusBadRequest {
				t.Fatalf("PUT %q body=%q → status %d, want 400", tt.key, tt.body, rr.Code)
			}
		})
	}
}

func TestDeleteHandlerValidation(t *testing.T) {
	h := NewHandler(nil, nil)
	req := httptest.NewRequest(http.MethodDelete, "/admin/app-config/BadKey", nil)
	req.SetPathValue("key", "BadKey")
	rr := httptest.NewRecorder()
	h.delete(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("DELETE invalid key → status %d, want 400", rr.Code)
	}
}