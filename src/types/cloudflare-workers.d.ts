/**
 * Minimal ambient types for `cloudflare:workers`.
 *
 * The module is provided by the workerd runtime (and shimmed by nitro's
 * `cloudflare-module` preset in dev), so it has no package to resolve types
 * from. Only `env` is declared, because `src/lib/env.server.ts` is the one
 * place that imports it — and it treats every value as `unknown` and narrows.
 */
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
