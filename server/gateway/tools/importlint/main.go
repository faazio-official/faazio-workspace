// Command importlint enforces the monolith boundary rules from
// docs/architecture/monolith-breakdown.md §2: a context package may import
// internal/contracts, internal/platform/*, and its own package — never a sibling
// context. internal/server (composition root) and cmd/ are exempt.
//
// Usage (from server/gateway): go run ./tools/importlint
package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

const modulePrefix = "github.com/faazio/server/gateway/internal/"

var special = map[string]bool{"server": true, "platform": true, "contracts": true}

func main() {
	out, err := exec.Command("go", "list", "-f", "{{.ImportPath}}|{{join .Imports \" \"}}", "./...").Output()
	if err != nil {
		fmt.Fprintln(os.Stderr, "importlint: go list failed:", err)
		os.Exit(1)
	}

	violations := 0
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		parts := strings.SplitN(line, "|", 2)
		if len(parts) != 2 {
			continue
		}
		pkg, imports := parts[0], strings.Fields(parts[1])
		if !strings.HasPrefix(pkg, modulePrefix) {
			continue
		}
		current := contextOf(strings.TrimPrefix(pkg, modulePrefix))
		if current == "" || special[current] {
			continue // composition root / platform / contracts
		}
		for _, imp := range imports {
			if !strings.HasPrefix(imp, modulePrefix) {
				continue
			}
			target := contextOf(strings.TrimPrefix(imp, modulePrefix))
			if target == "" || target == current || special[target] {
				continue
			}
			fmt.Fprintf(os.Stderr, "importlint: %s (context %q) imports sibling context %q (%s)\n", pkg, current, target, imp)
			violations++
		}
	}
	if violations > 0 {
		fmt.Fprintf(os.Stderr, "importlint: %d boundary violation(s)\n", violations)
		os.Exit(1)
	}
	fmt.Println("importlint: ok")
}

func contextOf(rel string) string {
	if i := strings.IndexByte(rel, '/'); i >= 0 {
		return rel[:i]
	}
	return rel
}
