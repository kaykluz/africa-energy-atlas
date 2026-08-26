/**
 * Server environment access — **server-only**.
 *
 * On Cloudflare Workers, secrets and bindings live on the per-request `env`
 * object, not on `process.env`, and they are not readable at module scope. The
 * `cloudflare:workers` module is externalised by nitro's `cloudflare-module`
 * preset (and shimmed to `process.env` in plain `vite dev`), so it is the one
 * import that resolves in both places.
 *
 * Everything here is async and lazy for that reason: read config inside a
 * handler, never at import time.
 */

export type ServerEnv = Record<string, unknown>;

let cached: ServerEnv | undefined;

/**
 * The Worker environment merged over `process.env`.
 *
 * `process.env` is the base so plain Node contexts (tests, `scripts/`) still
 * work; the Worker's own bindings win where both define a key.
 */
export async function serverEnv(): Promise<ServerEnv> {
  if (cached) return cached;
  const base: ServerEnv =
    typeof process !== "undefined" && process.env ? { ...process.env } : {};
  try {
    const mod = (await import("cloudflare:workers")) as { env?: ServerEnv };
    if (mod.env) Object.assign(base, mod.env);
  } catch {
    // Not under workerd and no shim — `process.env` alone is correct.
  }
  cached = base;
  return base;
}

/** Read one string setting. Empty / whitespace-only is treated as unset. */
export async function envString(key: string): Promise<string | undefined> {
  const value = (await serverEnv())[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Read a binding (D1, KV, …) — anything that is not a plain string. */
export async function envBinding<T = unknown>(key: string): Promise<T | undefined> {
  const value = (await serverEnv())[key];
  return value && typeof value !== "string" ? (value as T) : undefined;
}

/**
 * Test seam: drop the memoized environment.
 *
 * The merge is cached because it runs on every auth call and the underlying
 * values never change within an isolate.
 */
export function resetServerEnvCache(): void {
  cached = undefined;
}
