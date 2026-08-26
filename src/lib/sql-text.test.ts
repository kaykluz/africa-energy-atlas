import { strict as assert } from "node:assert";
import { test } from "node:test";
import { splitSqlStatements, toPositional } from "./sql-text.ts";

/**
 * `toPositional` is the seam between call sites (which still write Postgres-style
 * `$n`) and SQLite (which only takes positional `?`). Getting the parameter
 * ORDER wrong here silently swaps column values, so the reordering cases matter
 * more than the happy path.
 */

test("rewrites $n placeholders in order", () => {
  const { sql, params } = toPositional("select * from t where a = $1 and b = $2", [
    "A",
    "B",
  ]);
  assert.equal(sql, "select * from t where a = ? and b = ?");
  assert.deepEqual(params, ["A", "B"]);
});

test("rebuilds parameters in order of appearance, not declaration", () => {
  const { sql, params } = toPositional("select * from t where a = $2 and b = $1", [
    "first",
    "second",
  ]);
  assert.equal(sql, "select * from t where a = ? and b = ?");
  assert.deepEqual(params, ["second", "first"]);
});

test("repeats a parameter that is referenced twice", () => {
  const { sql, params } = toPositional(
    "select * from t where a = $1 or b = $1",
    ["x"],
  );
  assert.equal(sql, "select * from t where a = ? or b = ?");
  assert.deepEqual(params, ["x", "x"]);
});

test("handles multi-digit placeholders", () => {
  const values = Array.from({ length: 12 }, (_, i) => i);
  const { sql, params } = toPositional("select $11, $12", values);
  assert.equal(sql, "select ?, ?");
  assert.deepEqual(params, [10, 11]);
});

test("leaves a $n inside a string literal alone", () => {
  const { sql, params } = toPositional("select '$1' as literal, $1 as bound", ["v"]);
  assert.equal(sql, "select '$1' as literal, ? as bound");
  assert.deepEqual(params, ["v"]);
});

test("leaves a $n inside a quoted identifier alone", () => {
  const { sql, params } = toPositional('select "$1" from t where a = $1', ["v"]);
  assert.equal(sql, 'select "$1" from t where a = ?');
  assert.deepEqual(params, ["v"]);
});

test("a bare $ that is not a placeholder passes through", () => {
  const { sql, params } = toPositional("select 'US$' as cur", []);
  assert.equal(sql, "select 'US$' as cur");
  assert.deepEqual(params, []);
});

test("throws when a placeholder has no matching parameter", () => {
  assert.throws(
    () => toPositional("select $2", ["only-one"]),
    /placeholder \$2 has no matching parameter/,
  );
});

// ── splitSqlStatements ──────────────────────────────────────────────────────
// D1 has no multi-statement `exec` we can trust, so migrations are split here.
// A bad split silently drops half a schema, so the quoting cases are the point.

test("splits a script on semicolons", () => {
  assert.deepEqual(splitSqlStatements("create table a (x text); create table b (y text);"), [
    "create table a (x text)",
    "create table b (y text)",
  ]);
});

test("does not split on a semicolon inside a string literal", () => {
  const out = splitSqlStatements("insert into t values ('a;b'); select 1;");
  assert.deepEqual(out, ["insert into t values ('a;b')", "select 1"]);
});

test("does not split on a semicolon inside a line comment", () => {
  const out = splitSqlStatements("-- one; two\ncreate table a (x text);");
  assert.equal(out.length, 1);
  assert.match(out[0], /create table a/);
});

test("drops comment-only and empty fragments", () => {
  assert.deepEqual(splitSqlStatements("-- just a note\n\n   \n"), []);
});

test("keeps a trailing statement with no terminating semicolon", () => {
  assert.deepEqual(splitSqlStatements("select 1"), ["select 1"]);
});

test("preserves quoted identifiers containing a semicolon", () => {
  const out = splitSqlStatements('create table "od;d" (x text);');
  assert.deepEqual(out, ['create table "od;d" (x text)']);
});
