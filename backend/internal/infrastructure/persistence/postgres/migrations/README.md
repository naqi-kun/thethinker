# Database Migrations

These SQL files are embedded into the API binary (`//go:embed migrations/*.sql` in
[`../db.go`](../db.go)) and applied on startup by [golang-migrate](https://github.com/golang-migrate/migrate).
Each migration is a pair of files:

```
<version>_<name>.up.sql     # forward migration
<version>_<name>.down.sql   # rollback
```

golang-migrate parses the **leading digits** of each filename as the migration's
`version` (a `uint`) and applies pending migrations in ascending numeric order.

## Naming convention — use timestamps for new migrations

**New migrations MUST use a 14-digit UTC timestamp prefix:** `YYYYMMDDHHmmss_name`.

```
20260613143000_add_outfit_rating.up.sql
20260613143000_add_outfit_rating.down.sql
```

Do **not** continue the old sequential `000010_*`, `000011_*` scheme.

### Why

Sequential integer prefixes (`000006_*`, `000007_*`, …) collide when two branches each
add "the next" migration independently — both pick the same number, and whichever merges
second silently shadows or conflicts with the first. Timestamps are effectively unique per
author per second, so independent branches never collide.

### This does not break the existing sequential migrations

The existing `000001`–`000009` files parse to versions `1`–`9`. A timestamp like
`20260613143000` parses to a far larger integer, so every timestamp-prefixed migration
sorts **after** all the legacy sequential ones. We intentionally **do not rename** the
existing files — renaming would change their version numbers and cause golang-migrate to
re-run them on databases that already applied them. Leave history as-is; only new files use
the new format.

## Creating a new migration

Generate the timestamped filenames, then fill in the SQL.

**PowerShell (Windows):**

```powershell
$name = 'add_outfit_rating'   # snake_case, no spaces
$ts   = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
$dir  = 'backend/internal/infrastructure/persistence/postgres/migrations'
New-Item -ItemType File "$dir/${ts}_${name}.up.sql"
New-Item -ItemType File "$dir/${ts}_${name}.down.sql"
```

**bash (Linux / Mac):**

```bash
name='add_outfit_rating'      # snake_case, no spaces
ts="$(date -u +%Y%m%d%H%M%S)"
dir='backend/internal/infrastructure/persistence/postgres/migrations'
touch "$dir/${ts}_${name}.up.sql" "$dir/${ts}_${name}.down.sql"
```

## Rules

1. Always write **both** `.up.sql` and `.down.sql`. The `down` must cleanly reverse the `up`.
2. golang-migrate's pgx driver wraps each migration in a transaction. If a migration fails
   partway, it rolls back but the version is flagged **dirty** and the app refuses to start
   until fixed. To recover, inspect `schema_migrations`, set it to the last good version,
   and clear `dirty`.
3. Never edit a migration that has already been merged/applied — add a new one instead.
4. Keep one logical change per migration.
