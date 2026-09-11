package learning

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestSchoolDirectoryMigrationRoundTripPostgres(t *testing.T) {
	pool, _ := openPaginationIntegrationRepository(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO schools(urn,name) VALUES('directory-migration','Migration school'); INSERT INTO classes(school_id,name,year_group) SELECT id,'Preserved class',3 FROM schools WHERE urn='directory-migration'; INSERT INTO learning_groups(class_id,name) SELECT id,'Preserved group' FROM classes WHERE name='Preserved class'`); err != nil {
		t.Fatal(err)
	}
	check := func(want int) {
		t.Helper()
		var indexes, classes, groups int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM pg_indexes WHERE schemaname=current_schema() AND indexname IN ('classes_school_directory_keyset_idx','learning_groups_school_directory_keyset_idx')`).Scan(&indexes); err != nil {
			t.Fatal(err)
		}
		if err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM classes WHERE name='Preserved class'),(SELECT count(*) FROM learning_groups WHERE name='Preserved group')`).Scan(&classes, &groups); err != nil {
			t.Fatal(err)
		}
		if indexes != want || classes != 1 || groups != 1 {
			t.Fatalf("migration changed data or wrong index state: indexes=%d classes=%d groups=%d", indexes, classes, groups)
		}
	}
	check(2)
	for _, direction := range []string{"up", "down", "down", "up", "up"} {
		raw, err := os.ReadFile(filepath.Join("..", "..", "migrations", "0059_school_directory_keyset."+direction+".sql"))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, string(raw)); err != nil {
			t.Fatal(err)
		}
		want := 2
		if direction == "down" {
			want = 0
		}
		check(want)
	}
}
