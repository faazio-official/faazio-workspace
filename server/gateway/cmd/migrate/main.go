// Command migrate applies Faazio Supabase SQL migrations/seed from a developer terminal.
//
// It authenticates with DATABASE_URL from the git-ignored server/gateway/.env and connects with
// pgx — no psql and no Docker. Render never runs migrations (distroless image); see
// docs/RUNBOOKS/DATABASE_MIGRATIONS.md.
//
// Statements are sent one at a time over the simple query protocol (autocommit), matching psql,
// because some migrations use CREATE INDEX CONCURRENTLY, which cannot run inside a transaction
// block. Files that carry their own BEGIN/COMMIT (the seed) still batch as intended.
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

func main() {
	envPath := flag.String("env", "", "path to the .env file holding DATABASE_URL")
	timeout := flag.Duration("timeout", 10*time.Minute, "overall timeout for applying all files")
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "usage: migrate -env <path> <file.sql> [more.sql ...]\n")
		flag.PrintDefaults()
	}
	flag.Parse()

	files := flag.Args()
	if len(files) == 0 {
		flag.Usage()
		os.Exit(2)
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		if *envPath == "" {
			log.Fatal("migrate: DATABASE_URL unset and no -env supplied")
		}
		v, err := readEnvValue(*envPath, "DATABASE_URL")
		if err != nil {
			log.Fatalf("migrate: %v", err)
		}
		dbURL = v
	}

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		log.Fatalf("migrate: connect: %v", err)
	}
	defer func() { _ = conn.Close(context.Background()) }()

	total := 0
	for _, file := range files {
		n, err := applyFile(ctx, conn, file)
		if err != nil {
			log.Fatalf("migrate: %s: %v", file, err)
		}
		total += n
	}
	fmt.Printf("✓ applied %d statement(s) from %d file(s)\n", total, len(files))
}

func applyFile(ctx context.Context, conn *pgx.Conn, path string) (int, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	stmts := splitStatements(string(raw))
	fmt.Printf("→ %s (%d statements)\n", path, len(stmts))
	for i, stmt := range stmts {
		if _, err := conn.PgConn().Exec(ctx, stmt).ReadAll(); err != nil {
			return i, fmt.Errorf("statement %d: %w", i+1, err)
		}
	}
	return len(stmts), nil
}

// readEnvValue returns key from the process environment when set, else from the .env file.
func readEnvValue(path, key string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		k, v, ok := strings.Cut(line, "=")
		if !ok || strings.TrimSpace(k) != key {
			continue
		}
		v = strings.TrimSpace(v)
		if len(v) >= 2 {
			if (v[0] == '"' && v[len(v)-1] == '"') || (v[0] == '\'' && v[len(v)-1] == '\'') {
				v = v[1 : len(v)-1]
			}
		}
		if v == "" {
			return "", fmt.Errorf("%s is empty in %s", key, path)
		}
		return v, nil
	}
	if err := sc.Err(); err != nil {
		return "", err
	}
	return "", fmt.Errorf("%s not found in %s", key, path)
}

// splitStatements splits a script at top-level semicolons while preserving quoted strings,
// double-quoted identifiers, dollar-quoted bodies and comments.
func splitStatements(sql string) []string {
	var (
		stmts []string
		b     strings.Builder
	)
	n := len(sql)
	for i := 0; i < n; {
		c := sql[i]
		switch {
		case c == '-' && i+1 < n && sql[i+1] == '-':
			j := strings.IndexByte(sql[i:], '\n')
			if j < 0 {
				b.WriteString(sql[i:])
				i = n
			} else {
				b.WriteString(sql[i : i+j+1])
				i += j + 1
			}
		case c == '/' && i+1 < n && sql[i+1] == '*':
			depth := 1
			b.WriteString("/*")
			i += 2
			for i < n && depth > 0 {
				if i+1 < n && sql[i] == '/' && sql[i+1] == '*' {
					depth++
					b.WriteString("/*")
					i += 2
				} else if i+1 < n && sql[i] == '*' && sql[i+1] == '/' {
					depth--
					b.WriteString("*/")
					i += 2
				} else {
					b.WriteByte(sql[i])
					i++
				}
			}
		case c == '\'':
			b.WriteByte(c)
			i++
			for i < n {
				if sql[i] == '\\' && i+1 < n {
					b.WriteByte(sql[i])
					b.WriteByte(sql[i+1])
					i += 2
					continue
				}
				if sql[i] == '\'' {
					b.WriteByte('\'')
					i++
					if i < n && sql[i] == '\'' {
						b.WriteByte('\'')
						i++
						continue
					}
					break
				}
				b.WriteByte(sql[i])
				i++
			}
		case c == '"':
			b.WriteByte(c)
			i++
			for i < n {
				if sql[i] == '"' {
					b.WriteByte('"')
					i++
					if i < n && sql[i] == '"' {
						b.WriteByte('"')
						i++
						continue
					}
					break
				}
				b.WriteByte(sql[i])
				i++
			}
		case c == '$':
			if end := dollarTagEnd(sql, i); end > 0 {
				tag := sql[i:end]
				b.WriteString(tag)
				i = end
				if closeIdx := strings.Index(sql[i:], tag); closeIdx < 0 {
					b.WriteString(sql[i:])
					i = n
				} else {
					b.WriteString(sql[i : i+closeIdx+len(tag)])
					i += closeIdx + len(tag)
				}
			} else {
				b.WriteByte(c)
				i++
			}
		case c == ';':
			if s := strings.TrimSpace(b.String()); s != "" {
				stmts = append(stmts, s)
			}
			b.Reset()
			i++
		default:
			b.WriteByte(c)
			i++
		}
	}
	if s := strings.TrimSpace(b.String()); s != "" {
		stmts = append(stmts, s)
	}
	return stmts
}

// dollarTagEnd returns the index just past an opening dollar-quote tag at src[start] ('$'), or -1
// when src[start:] is not a dollar-quote opener (e.g. a $1 positional parameter).
func dollarTagEnd(src string, start int) int {
	n := len(src)
	if start >= n || src[start] != '$' {
		return -1
	}
	i := start + 1
	if i < n && src[i] == '$' {
		return i + 1
	}
	if i >= n || !isTagStart(src[i]) {
		return -1
	}
	i++
	for i < n && isTagChar(src[i]) {
		i++
	}
	if i < n && src[i] == '$' {
		return i + 1
	}
	return -1
}

func isTagStart(c byte) bool {
	return c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

func isTagChar(c byte) bool {
	return isTagStart(c) || (c >= '0' && c <= '9')
}
