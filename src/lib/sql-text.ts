/**
 * Pure SQL text helpers, with no imports of their own.
 *
 * Kept dependency-free so they can be unit-tested under plain `node --test`
 * without dragging in the database modules (and the Vite-only
 * `import.meta.glob` inside them).
 */

/**
 * Rewrite Postgres `$n` placeholders to SQLite's positional `?`.
 *
 * `$n` may repeat or appear out of order, so the parameter array is rebuilt in
 * order of appearance rather than passed through. Quote-aware: a `$1` inside a
 * string literal or quoted identifier is data, not a placeholder.
 */
export function toPositional(
  text: string,
  params: readonly unknown[],
): { sql: string; params: unknown[] } {
  const out: unknown[] = [];
  let sql = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      sql += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      sql += ch;
      continue;
    }
    if (ch === "$" && !inSingle && !inDouble) {
      let j = i + 1;
      let digits = "";
      while (j < text.length && text[j] >= "0" && text[j] <= "9") {
        digits += text[j];
        j += 1;
      }
      if (digits) {
        const index = Number(digits) - 1;
        if (index < 0 || index >= params.length) {
          throw new Error(
            `SQL placeholder $${digits} has no matching parameter (got ${params.length}).`,
          );
        }
        out.push(params[index]);
        sql += "?";
        i = j - 1;
        continue;
      }
    }
    sql += ch;
  }
  return { sql, params: out };
}

/** Remove `--` and block comments. For emptiness checks only. */
export function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Split a migration script into individual statements.
 *
 * Quote- and comment-aware, so a `;` inside a string literal or a `--` comment
 * does not cut a statement in half. Fragments that are only comments or
 * whitespace are dropped — D1 rejects those.
 */
export function splitSqlStatements(script: string): string[] {
  const out: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < script.length; i += 1) {
    const ch = script[i];
    const next = script[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      current += ch;
      continue;
    }
    if (inBlockComment) {
      current += ch;
      if (ch === "*" && next === "/") {
        current += next;
        i += 1;
        inBlockComment = false;
      }
      continue;
    }
    if (!inSingle && !inDouble) {
      if (ch === "-" && next === "-") {
        inLineComment = true;
        current += ch;
        continue;
      }
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        current += ch + next;
        i += 1;
        continue;
      }
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }
    if (ch === ";" && !inSingle && !inDouble) {
      if (current.trim()) out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out.filter((s) => stripSqlComments(s).trim().length > 0);
}
