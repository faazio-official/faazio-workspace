package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSplitStatements(t *testing.T) {
	cases := []struct {
		name     string
		sql      string
		want     int
		contains string
	}{
		{name: "two statements", sql: "select 1; select 2;", want: 2},
		{name: "semicolon in string", sql: "insert into t values ('a;b');", want: 1, contains: "'a;b'"},
		{name: "doubled quote", sql: "select 'it''s; ok';", want: 1},
		{name: "dollar body", sql: "do $$ begin perform 1; end $$; select 1;", want: 2, contains: "begin perform 1; end"},
		{name: "tagged dollar body", sql: "do $body$ select ';'; $body$;", want: 1, contains: "$body$"},
		{name: "line comment", sql: "-- hi ;\nselect 1;", want: 1},
		{name: "block comment", sql: "/* a ; b */ select 1;", want: 1},
		{name: "nested block comment", sql: "/* a /* b ; */ c */ select 1;", want: 1},
		{name: "positional param is not a dollar tag", sql: "select $1;", want: 1, contains: "$1"},
		{name: "concurrently", sql: "create index concurrently if not exists i on t(a);", want: 1},
		{name: "trailing whitespace only", sql: "select 1;\n\n", want: 1},
		{name: "quoted identifier with semicolon", sql: `select "a;b" from t;`, want: 1, contains: `"a;b"`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := splitStatements(tc.sql)
			if len(got) != tc.want {
				t.Fatalf("got %d statements %q, want %d", len(got), got, tc.want)
			}
			if tc.contains != "" && !strings.Contains(strings.Join(got, "\n"), tc.contains) {
				t.Fatalf("statements %q missing %q", got, tc.contains)
			}
		})
	}
}

func TestReadEnvValue(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	content := "# comment\nFOO=bar\nexport DATABASE_URL=\"postgres://u:p@h:5432/db?sslmode=require\"\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := readEnvValue(path, "DATABASE_URL")
	if err != nil {
		t.Fatal(err)
	}
	if want := "postgres://u:p@h:5432/db?sslmode=require"; got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}
