package auth

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const testFirebaseProject = "faazio-test"

func testCertificate(t *testing.T) (*rsa.PrivateKey, string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "securetoken.google.com"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	return key, string(pemBytes)
}

func signRS256(t *testing.T, key *rsa.PrivateKey, kid string, claims map[string]any) string {
	t.Helper()
	headerBytes, err := json.Marshal(map[string]string{"alg": "RS256", "typ": "JWT", "kid": kid})
	if err != nil {
		t.Fatal(err)
	}
	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		t.Fatal(err)
	}
	signingInput := base64.RawURLEncoding.EncodeToString(headerBytes) + "." + base64.RawURLEncoding.EncodeToString(payloadBytes)
	digest := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		t.Fatal(err)
	}
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(sig)
}

func testVerifier(t *testing.T, cert string) *FirebaseVerifier {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Cache-Control", "max-age=3600")
		_ = json.NewEncoder(w).Encode(map[string]string{"test-kid": cert})
	}))
	t.Cleanup(server.Close)
	v := NewFirebaseVerifier(testFirebaseProject)
	v.keysURL = server.URL
	v.client = server.Client()
	return v
}

func validFirebaseClaims() map[string]any {
	now := time.Now()
	return map[string]any{
		"iss":          "https://securetoken.google.com/" + testFirebaseProject,
		"aud":          testFirebaseProject,
		"sub":          "firebase-uid-1",
		"user_id":      "firebase-uid-1",
		"iat":          now.Unix(),
		"exp":          now.Add(time.Hour).Unix(),
		"phone_number": "+919000000001",
		"email":        "otp@example.com",
		"app_role":     "seller",
	}
}

func TestFirebaseVerify(t *testing.T) {
	key, cert := testCertificate(t)
	verifier := testVerifier(t, cert)
	token := signRS256(t, key, "test-kid", validFirebaseClaims())

	claims, err := verifier.Verify(context.Background(), token)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if claims.Sub != "firebase-uid-1" {
		t.Fatalf("Sub = %q", claims.Sub)
	}
	if claims.Phone != "+919000000001" || claims.Email != "otp@example.com" {
		t.Fatalf("phone/email = %q/%q", claims.Phone, claims.Email)
	}
	if claims.appRole() != RoleSeller {
		t.Fatalf("appRole = %q", claims.appRole())
	}
}

func TestFirebaseVerifyRejectsInvalidTokens(t *testing.T) {
	key, cert := testCertificate(t)
	verifier := testVerifier(t, cert)

	cases := map[string]func(map[string]any){
		"wrong issuer":   func(c map[string]any) { c["iss"] = "https://securetoken.google.com/other" },
		"wrong audience": func(c map[string]any) { c["aud"] = "other" },
		"expired":        func(c map[string]any) { c["exp"] = time.Now().Add(-time.Hour).Unix() },
		"no subject":     func(c map[string]any) { delete(c, "sub"); delete(c, "user_id") },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			claims := validFirebaseClaims()
			mutate(claims)
			if _, err := verifier.Verify(context.Background(), signRS256(t, key, "test-kid", claims)); err == nil {
				t.Fatal("expected verification failure")
			}
		})
	}

	t.Run("wrong key", func(t *testing.T) {
		other, _ := testCertificate(t)
		if _, err := verifier.Verify(context.Background(), signRS256(t, other, "test-kid", validFirebaseClaims())); err == nil {
			t.Fatal("expected verification failure")
		}
	})

	t.Run("unknown kid", func(t *testing.T) {
		if _, err := verifier.Verify(context.Background(), signRS256(t, key, "other-kid", validFirebaseClaims())); err == nil {
			t.Fatal("expected verification failure")
		}
	})
}

func TestMiddlewareFirebaseToken(t *testing.T) {
	key, cert := testCertificate(t)
	verifier := testVerifier(t, cert)
	token := signRS256(t, key, "test-kid", validFirebaseClaims())

	var got string
	h := Middleware(Config{
		Firebase: verifier,
		Resolver: resolverFunc(func(_ context.Context, uid string) (string, error) {
			if uid != "firebase-uid-1" {
				t.Errorf("resolver got %q", uid)
			}
			return "u-abc", nil
		}),
	})(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) { got = UserID(r.Context()) }))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	h.ServeHTTP(httptest.NewRecorder(), req)
	if got != "u-abc" {
		t.Fatalf("UserID = %q, want u-abc", got)
	}
}
