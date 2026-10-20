// Command hash-password prints one Argon2id PHC hash for the portal credential store.
//
// It is the only supported way to create/rotate the two superadmin passwords: the hash is printed
// once to stdout and never written to git or a log. Provide the password on stdin (preferred) or in
// PORTAL_PASSWORD, and the same PORTAL_PEPPER the gateway will use.
//
//	PORTAL_PEPPER=... go run ./tools/hash-password <<< 'your-password'
//
// See docs/RUNBOOKS/PORTAL_AUTH.md.
package main

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/faazio/server/gateway/internal/portal"
)

func main() {
	password := os.Getenv("PORTAL_PASSWORD")
	if password == "" {
		raw, err := io.ReadAll(io.LimitReader(os.Stdin, 257))
		if err != nil {
			fmt.Fprintln(os.Stderr, "read password:", err)
			os.Exit(1)
		}
		password = strings.TrimRight(string(raw), "\r\n")
	}
	if password == "" || len(password) > 128 {
		fmt.Fprintln(os.Stderr, "usage: PORTAL_PEPPER=... go run ./tools/hash-password < password.txt (1-128 bytes)")
		os.Exit(1)
	}
	pepper := os.Getenv("PORTAL_PEPPER")
	if pepper == "" {
		fmt.Fprintln(os.Stderr, "warning: PORTAL_PEPPER is empty (local dev only; production must set it)")
	}
	hash, err := portal.NewHasher(pepper).Hash(password)
	if err != nil {
		fmt.Fprintln(os.Stderr, "hash:", err)
		os.Exit(1)
	}
	fmt.Println(hash)
}
