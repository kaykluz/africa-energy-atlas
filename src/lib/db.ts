import { pendingMigrations } from "../../scripts/migration-plan.mjs";
import { getRunner, type SqliteBackend } from "./sqlite.server";
import { toPositional } from "./sql-text";

/**
 * App SQL — **server-only**, backed by SQLite (Cloudflare D1 in production,
 * `node:sqlite` in plain `vite dev`). See `./sqlite.server` for the split.
 *
 * The `Sql` surface is unchanged from the Postgres original, so call sites keep
 * writing `$1`-style placeholders and tagged templates:
 *
 *   const sql = await getSql();
 *   const rows = await sql`select * from contributions where id = ${id}`;
 *   const rows2 = await sql.query("select * from contributions where id = $1", [id]);
 *
 * Schema lives in `migrations/*.sql` and is applied once per isolate before the
 * first query — define tables there, never inline in a server function.
 */

/** Which database backend is active. */
export type DbSource = SqliteBackend;

/**
 * Minimal shared SQL surface. Both the tagged-template and `.query()` forms
 * resolve to an array of row objects.
 */
export interface Sql {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
}

export { toPositional };

/** True for statements whose rows we want back. */
function returnsRows(sql: string): boolean {
  return /^\s*(select|with|pragma|explain)\b/i.test(sql);
}

function toSql(): Sql {
  const run = async <T>(text: string, params: readonly unknown[]): Promise<T[]> => {
    const { runner } = await getRunner();
    const compiled = toPositional(text, params);
    if (returnsRows(compiled.sql)) {
      return runner.all<T>(compiled.sql, compiled.params);
    }
    await runner.run(compiled.sql, compiled.params);
    return [] as T[];
  };

  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;

  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    run<T>(text, params);

  return sql;
}

/**
 * Apply `migrations/*.sql` once per isolate.
 *
 * SQL is inlined by the bundler via `import.meta.glob` — a Worker has no
 * filesystem to read from at runtime. The glob does not descend, so the
 * Better Auth schema under `migrations/auth/` stays out unless it is copied up.
 *
 * Every migration is written to be idempotent (`create ... if not exists`) and
 * the bookkeeping insert is `or ignore`, so two isolates racing a cold start
 * cannot fail each other.
 */
async function migrate(): Promise<void> {
  const { runner } = await getRunner();
  const migrations = import.meta.glob("/migrations/*.sql", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  await runner.exec(
    "create table if not exists _migrations (" +
      "name text primary key, " +
      "applied_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
  );

  const done = (
    await runner.all<{ name: string }>("select name from _migrations", [])
  ).map((r) => r.name);

  for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
    await runner.exec(migrations[path]);
    await runner.run("insert or ignore into _migrations (name) values (?)", [name]);
  }
}

const globalRef = globalThis as typeof globalThis & {
  __atlasSqlPromise__?: Promise<Sql>;
};

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only — call getSql() from a createServerFn handler " +
        "or a server route loader, never from client code.",
    );
  }
  await migrate();
  return toSql();
}

/**
 * Get the shared, **server-only** SQL client with `migrations/*.sql` applied.
 * Memoized — safe to call per request. A failed init is not memoized.
 */
export function getSql(): Promise<Sql> {
  globalRef.__atlasSqlPromise__ ??= createSql().catch((err) => {
    globalRef.__atlasSqlPromise__ = undefined;
    throw err;
  });
  return globalRef.__atlasSqlPromise__;
}

/** Finish DB bootstrap (open + migrate) before serving traffic. Idempotent. */
export function ensureDbReady(): Promise<void> {
  return getSql().then(() => undefined);
}

/** Which backend is serving — `"d1"` deployed, `"node"` in plain `vite dev`. */
export async function dbSource(): Promise<DbSource> {
  return (await getRunner()).backend;
}
