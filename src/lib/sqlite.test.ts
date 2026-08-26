import { strict as assert } from "node:assert";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { splitSqlStatements, toPositional } from "./sql-text.ts";

/**
 * Runs the REAL `migrations/*.sql` against a real SQLite database, then
 * exercises the query shapes the app actually issues.
 *
 * This is the regression net for the Postgres → SQLite port: a `timestamptz`
 * default or a `::int` cast left behind anywhere in the schema fails here
 * rather than on the deployed Worker.
 */

const migrationsDir = join(
  fileURLToPath(new URL("../../", import.meta.url)),
  "migrations",
);

let db: DatabaseSync;

/** Issue a query the way `src/lib/db.ts` does — `$n` in, positional out. */
function run(text: string, params: readonly unknown[] = []) {
  const compiled = toPositional(text, params);
  const stmt = db.prepare(compiled.sql);
  return /^\s*(select|with|pragma)\b/i.test(compiled.sql)
    ? stmt.all(...(compiled.params as never[]))
    : (stmt.run(...(compiled.params as never[])), []);
}

before(() => {
  db = new DatabaseSync(join(mkdtempSync(join(tmpdir(), "atlas-")), "test.sqlite"));
  db.exec("pragma foreign_keys = ON");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  assert.ok(files.length >= 3, "expected the auth, contributions and review migrations");
  for (const file of files) {
    for (const statement of splitSqlStatements(
      readFileSync(join(migrationsDir, file), "utf8"),
    )) {
      db.exec(statement);
    }
  }
});

after(() => db?.close());

test("every migration applies cleanly to SQLite", () => {
  const tables = db
    .prepare("select name from sqlite_master where type = 'table' order by name")
    .all()
    .map((r) => String((r as { name: string }).name));
  for (const expected of [
    "account",
    "contribution_audit",
    "contribution_submit_events",
    "contributions",
    "session",
    "user",
    "verification",
  ]) {
    assert.ok(tables.includes(expected), `missing table: ${expected}`);
  }
});

test("a contribution insert fills its defaults", () => {
  run(
    `insert into contributions (id, kind, name, summary, status, version)
     values ($1, $2, $3, $4, $5, $6)`,
    ["c_1", "software", "Test Product", "A summary long enough to pass.", "received", 1],
  );
  const rows = run("select * from contributions where id = $1", ["c_1"]) as Array<
    Record<string, unknown>
  >;
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.status, "received");
  assert.equal(row.website, "");
  assert.equal(row.slug, "");
  assert.equal(row.version, 1);
  assert.equal(row.reviewed_at, null);
  // The default must be an ISO-8601 instant, because the app compares these as
  // strings and hands them to `new Date(...)`.
  assert.match(String(row.created_at), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test("timestamps sort chronologically as plain strings", () => {
  run(
    `insert into contributions (id, kind, name, summary, created_at)
     values ($1, 'company', 'Older', 'An older submission entry.', $2)`,
    ["c_old", "2020-01-01T00:00:00.000Z"],
  );
  const rows = run(
    "select id from contributions order by created_at desc",
  ) as Array<{ id: string }>;
  assert.equal(rows[rows.length - 1].id, "c_old");
});

test("the slug index allows many blanks but only one of each real slug", () => {
  run(
    `insert into contributions (id, kind, name, summary) values ($1, 'software', 'B', 'Another summary here.')`,
    ["c_2"],
  );
  // Two rows now hold slug '' — the partial index must not treat that as a clash.
  run("update contributions set slug = $1 where id = $2", ["taken", "c_1"]);
  assert.throws(
    () => run("update contributions set slug = $1 where id = $2", ["taken", "c_2"]),
    /UNIQUE/i,
    "a duplicate non-empty slug must be rejected",
  );
});

test("the rate-limit window query counts without a cast", () => {
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  run("insert into contribution_submit_events (id, ip_hash) values ($1, $2)", [
    "r_1",
    "hash-a",
  ]);
  run(
    "insert into contribution_submit_events (id, ip_hash, created_at) values ($1, $2, $3)",
    ["r_2", "hash-a", "2020-01-01T00:00:00.000Z"],
  );
  const rows = run(
    `select count(*) as n from contribution_submit_events
     where ip_hash = $1 and created_at >= $2`,
    ["hash-a", cutoff],
  ) as Array<{ n: number }>;
  // Only the fresh row is inside the window; the 2020 one has aged out.
  assert.equal(Number(rows[0].n), 1);
});

test("an audit row records the decision transition", () => {
  run(
    `insert into contribution_audit
       (id, contribution_id, actor_user_id, actor_email, action, from_status, to_status, note)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    ["a_1", "c_1", "u_1", "editor@example.org", "accept", "received", "accepted", ""],
  );
  const rows = run("select * from contribution_audit where id = $1", ["a_1"]) as Array<
    Record<string, unknown>
  >;
  assert.equal(rows[0].to_status, "accepted");
  assert.match(String(rows[0].created_at), /^\d{4}-\d{2}-\d{2}T/);
});

test("deleting a user cascades to their sessions", () => {
  const now = new Date().toISOString();
  run(
    `insert into "user" ("id","name","email","emailVerified","createdAt","updatedAt")
     values ($1,$2,$3,$4,$5,$5)`,
    ["u_1", "Editor", "editor@example.org", 1, now],
  );
  run(
    `insert into "session" ("id","expiresAt","token","createdAt","updatedAt","userId")
     values ($1,$2,$3,$4,$4,$5)`,
    ["s_1", now, "tok_1", now, "u_1"],
  );
  run('delete from "user" where "id" = $1', ["u_1"]);
  const sessions = run('select * from "session" where "userId" = $1', ["u_1"]);
  assert.equal(sessions.length, 0);
});
