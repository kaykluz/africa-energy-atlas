import { createHash, randomBytes } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_SUBMITS = 5;

function clientIp(): string {
  const request = getRequest();
  if (!request) return "unknown";
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 128);
  return "unknown";
}

function ipHash(ip: string): string {
  const pepper = process.env.BETTER_AUTH_SECRET?.trim() || "preview-rate-pepper";
  return createHash("sha256").update(`${pepper}:${ip}`).digest("hex");
}

export function isHoneypot(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function isSafePublicHttpUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value) return true;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local")
  ) {
    return false;
  }
  if (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
  if (/^::ffff:(10\.|127\.|169\.254\.|192\.168\.)/.test(host)) return false;
  return true;
}

export async function enforceContributeRateLimit(): Promise<void> {
  const sql = await getSql();
  const hash = ipHash(clientIp());
  // Timestamps are stored as ISO-8601 text, so lexical comparison IS
  // chronological comparison — no cast needed, and it uses the index.
  const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
  await sql`delete from contribution_submit_events where created_at < ${cutoff}`;
  const rows = await sql<{ n: number }>`
    select count(*) as n
    from contribution_submit_events
    where ip_hash = ${hash} and created_at >= ${cutoff}
  `;
  const n = Number(rows[0]?.n ?? 0);
  if (n >= MAX_SUBMITS) {
    throw new Error("Too many submissions from this network. Try again in a few minutes.");
  }
  const id = `r_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  await sql`
    insert into contribution_submit_events (id, ip_hash)
    values (${id}, ${hash})
  `;
}
