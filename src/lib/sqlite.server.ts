/**
 * The one low-level SQLite surface this app runs on — **server-only**.
 *
 * Two backends, one interface:
 *   - **Cloudflare D1** when the Worker exposes a `DB` binding (deployed, and
 *     `wrangler dev`). Bindings only exist inside a request, so the binding is
 *     read lazily via `cloudflare:workers` rather than at module scope.
 *   - **`node:sqlite`** for plain `vite dev`, where nitro's `cloudflare:workers`
 *     shim resolves `env` to `process.env` and carries no D1 binding. A file on
 *     disk (`.data/atlas.sqlite`) so a dev restart keeps the queue.
 *
 * Both speak SQLite, so dev and production share one dialect — the thing the
 * previous Postgres/PGLite split could never quite guarantee.
 */

import { envBinding, envString } from "./env.server";
import { splitSqlStatements } from "./sql-text";

/** Minimal driver both backends implement. Params are positional (`?`). */
export interface SqliteRunner {
  all<T>(sql: string, params: readonly unknown[]): Promise<T[]>;
  run(sql: string, params: readonly unknown[]): Promise<{ changes: number }>;
  /** Execute a multi-statement script (migrations). No parameters. */
  exec(sql: string): Promise<void>;
}

/** Which backend is live. Surfaced so callers can explain themselves to users. */
export type SqliteBackend = "d1" | "node";

/** A D1 binding, typed structurally so no `@cloudflare/workers-types` dep is needed. */
type D1Database = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<{ meta?: { changes?: number } }>;
    };
    all<T>(): Promise<{ results: T[] }>;
    run(): Promise<{ meta?: { changes?: number } }>;
  };
  exec(sql: string): Promise<unknown>;
};

function isD1(value: unknown): value is D1Database {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as D1Database).prepare === "function"
  );
}

function d1Runner(db: D1Database): SqliteRunner {
  const stmt = (sql: string, params: readonly unknown[]) => {
    const prepared = db.prepare(sql);
    return params.length ? prepared.bind(...params) : prepared;
  };
  return {
    async all<T>(sql: string, params: readonly unknown[]) {
      const { results } = await stmt(sql, params).all<T>();
      return results ?? [];
    },
    async run(sql: string, params: readonly unknown[]) {
      const res = await stmt(sql, params).run();
      return { changes: res.meta?.changes ?? 0 };
    },
    async exec(sql) {
      // D1's `exec` takes the whole script but rejects blank/comment-only lines,
      // so hand it statements one at a time.
      for (const statement of splitSqlStatements(sql)) {
        await db.prepare(statement).run();
      }
    },
  };
}

async function nodeRunner(): Promise<Resolved> {
  const { DatabaseSync } = await import("node:sqlite");
  const { mkdirSync } = await import("node:fs");
  const { dirname, resolve } = await import("node:path");

  const file = (await envString("ATLAS_SQLITE_PATH")) ?? ".data/atlas.sqlite";
  const path = resolve(process.cwd(), file);
  mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
  db.exec("pragma journal_mode = WAL");
  db.exec("pragma foreign_keys = ON");

  // What `node:sqlite` accepts as a bound value. D1 is more forgiving, so
  // normalising here is what keeps a query behaving identically on both.
  type SqliteValue = null | number | bigint | string | Uint8Array;
  const bind = (params: readonly unknown[]): SqliteValue[] =>
    params.map((p) => {
      if (p === undefined || p === null) return null;
      if (typeof p === "boolean") return p ? 1 : 0;
      if (p instanceof Date) return p.toISOString();
      if (
        typeof p === "number" ||
        typeof p === "bigint" ||
        typeof p === "string" ||
        p instanceof Uint8Array
      ) {
        return p;
      }
      // Objects/arrays have no SQLite representation; fail loudly rather than
      // silently storing "[object Object]".
      throw new TypeError(`Cannot bind ${typeof p} to a SQLite parameter.`);
    });

  const runner: SqliteRunner = {
    async all<T>(sql: string, params: readonly unknown[]) {
      return db.prepare(sql).all(...bind(params)) as T[];
    },
    async run(sql: string, params: readonly unknown[]) {
      const res = db.prepare(sql).run(...bind(params));
      return { changes: Number(res.changes ?? 0) };
    },
    async exec(sql) {
      db.exec(sql);
    },
  };
  return { runner, backend: "node", raw: db };
}

/**
 * `raw` is the underlying handle (a D1 binding, or a `node:sqlite`
 * `DatabaseSync`). Better Auth's Kysely adapter sniffs its shape and picks
 * `D1SqliteDialect` / `NodeSqliteDialect` on its own, so auth shares this exact
 * connection rather than opening a second one.
 */
type Resolved = { runner: SqliteRunner; backend: SqliteBackend; raw: unknown };

const globalRef = globalThis as typeof globalThis & {
  __atlasSqlite__?: Promise<Resolved>;
};

/**
 * True on workerd. There is no `node:sqlite` there — nitro rewrites it to an
 * unenv shim — so the local fallback must never be reached on a Worker.
 */
function onWorkers(): boolean {
  return (
    typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers"
  );
}

async function resolveRunner(): Promise<Resolved> {
  const binding = await envBinding("DB");
  if (isD1(binding)) {
    return { runner: d1Runner(binding), backend: "d1", raw: binding };
  }
  if (typeof window !== "undefined") {
    throw new Error("SQLite is server-only — never import it from client code.");
  }
  if (onWorkers()) {
    // Falling through to `node:sqlite` here would surface as an unenv
    // "not implemented" stack with nothing pointing at the real cause.
    throw new Error(
      "No D1 binding named `DB` is attached to this Worker. Create the database " +
        "(`wrangler d1 create africa-energy-atlas`) and put the returned " +
        "`database_id` into wrangler.jsonc, then redeploy.",
    );
  }
  return nodeRunner();
}

/**
 * The shared runner. Memoized on `globalThis` so dev HMR reuses one handle
 * instead of opening a second file lock. A failed attempt is not memoized.
 */
export function getRunner(): Promise<Resolved> {
  globalRef.__atlasSqlite__ ??= resolveRunner().catch((err) => {
    globalRef.__atlasSqlite__ = undefined;
    throw err;
  });
  return globalRef.__atlasSqlite__;
}

/** Which backend answered — `"d1"` deployed, `"node"` in plain `vite dev`. */
export async function sqliteBackend(): Promise<SqliteBackend> {
  return (await getRunner()).backend;
}

/** The raw handle, for Better Auth's adapter to sniff. See `Resolved.raw`. */
export async function getRawDatabase(): Promise<unknown> {
  return (await getRunner()).raw;
}
