#!/usr/bin/env node
/**
 * Enrichment crawler — runs in GitHub Actions, writes to production D1 over
 * the Cloudflare REST API.
 *
 * Why CI and not a Worker: Cloudflare Pages has no cron triggers, and Workers
 * cap subrequests and CPU in ways hostile to polite crawling. A weekly Actions
 * run has none of those limits, full Node, and the repository checkout — which
 * also gives it `src/data/catalog.json` for free.
 *
 * What one run does:
 *   1. Collect subjects: catalogue companies and queued organisation
 *      candidates that carry a website.
 *   2. Take the stalest N (never-fetched first).
 *   3. For each, honour robots.txt, fetch the homepage with an identified
 *      user agent, and upsert one `company_site` observation: title, quoted
 *      description, content hash, HTTP state.
 *   4. Report new / changed / blocked / dead counts.
 *
 * It only observes. It never writes assertions, never edits a company record,
 * and never marks anything reviewed — extraction into claims is a separate,
 * human-gated step.
 *
 *   CLOUDFLARE_API_TOKEN   D1 read/write token (repo secret)
 *   CLOUDFLARE_ACCOUNT_ID  account id (repo secret)
 *   D1_DATABASE_ID         optional; defaults to the production database
 *   ENRICH_LIMIT           subjects per run (default 250)
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalUrl, hostOf, robotsAllows } from "../src/lib/evidence.ts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "AfricaEnergyAtlasBot/1.0 (+https://map.kaykluz.com/about)";
const LIMIT = Number(process.env.ENRICH_LIMIT || 250);
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DB = process.env.D1_DATABASE_ID || "a2985853-cb0f-420b-b175-fc443916c147";

if (!ACCOUNT || !TOKEN) {
  console.error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.");
  process.exit(1);
}

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const now = () => new Date().toISOString();

/** One parameterised statement against D1 over REST. */
async function d1(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB}/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  const body = await res.json();
  if (!res.ok || body.success === false) {
    throw new Error(`D1 ${res.status}: ${JSON.stringify(body.errors ?? body).slice(0, 300)}`);
  }
  return body.result?.[0]?.results ?? [];
}

// ── subjects ────────────────────────────────────────────────────────────────

function catalogSubjects() {
  const catalog = JSON.parse(readFileSync(join(REPO, "src/data/catalog.json"), "utf8"));
  return (catalog.companies ?? [])
    .filter((c) => c.website)
    .map((c) => ({ id: c.id, name: c.name, website: c.website }));
}

async function candidateSubjects() {
  const rows = await d1(
    `select id, name, website from organisation_candidates
     where website <> '' and status not in ('rejected', 'duplicate')`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, website: r.website }));
}

// ── fetching ────────────────────────────────────────────────────────────────

const robotsCache = new Map();

/** true = may fetch; false = disallowed or robots endpoint errored (be polite). */
async function robotsOk(url) {
  const host = hostOf(url);
  if (!host) return false;
  if (robotsCache.has(host)) {
    const txt = robotsCache.get(host);
    return txt === null ? true : txt === false ? false : robotsAllows(txt, new URL(url).pathname);
  }
  try {
    const res = await fetch(`https://${host}/robots.txt`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (res.status === 404) {
      robotsCache.set(host, null); // no robots file: allowed
      return true;
    }
    if (!res.ok) {
      robotsCache.set(host, false); // server refusing even robots.txt: stand down
      return false;
    }
    const txt = await res.text();
    robotsCache.set(host, txt);
    return robotsAllows(txt, new URL(url).pathname);
  } catch {
    robotsCache.set(host, null); // unreachable robots = site probably down; the page fetch will record that
    return true;
  }
}

function extract(html) {
  const title = (/<title[^>]*>([^<]{0,300})/i.exec(html)?.[1] ?? "").trim();
  const desc =
    (/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,400})/i.exec(html)?.[1] ??
      /<meta[^>]+content=["']([^"']{0,400})["'][^>]+name=["']description["']/i.exec(html)?.[1] ??
      "").trim();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    title,
    excerpt: [title, desc].filter(Boolean).join(" — ").slice(0, 500),
    contentHash: text ? sha256(text) : "",
  };
}

async function fetchSite(url) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    const status = res.status;
    const finalUrl = res.url || url;
    if (status === 401 || status === 403) return { status, finalUrl, state: "blocked" };
    if (status === 404 || status === 410) return { status, finalUrl, state: "dead" };
    if (!res.ok) return { status, finalUrl, state: "live" }; // 5xx: transient, keep live
    const html = await res.text();
    return { status, finalUrl, state: "live", ...extract(html) };
  } catch {
    return { status: 0, finalUrl: url, state: "error" };
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const subjects = [...catalogSubjects(), ...(await candidateSubjects())];
  const seen = new Set();
  const unique = subjects.filter((s) => {
    const key = canonicalUrl(s.website);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Staleness: never-fetched first, then oldest.
  const fetchedAt = new Map(
    (await d1(
      `select subject_id, last_fetched, http_status, state from observations
       where kind = 'company_site' and subject_type = 'organisation'`,
    )).map((r) => [r.subject_id, r]),
  );
  unique.sort((a, b) => {
    const fa = fetchedAt.get(a.id)?.last_fetched ?? "";
    const fb = fetchedAt.get(b.id)?.last_fetched ?? "";
    return fa.localeCompare(fb);
  });
  const batch = unique.slice(0, LIMIT);
  console.log(`subjects with websites: ${unique.length}; this run: ${batch.length}`);

  const stats = { fetched: 0, live: 0, blocked: 0, dead: 0, robots_denied: 0, changed: 0, added: 0 };
  const lastHostHit = new Map();

  async function politeDelay(host) {
    const prev = lastHostHit.get(host) ?? 0;
    const wait = Math.max(0, prev + 2000 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastHostHit.set(host, Date.now());
  }

  let index = 0;
  async function workerLoop() {
    while (index < batch.length) {
      const subject = batch[index++];
      const url = canonicalUrl(subject.website);
      const host = hostOf(url);
      const previous = fetchedAt.get(subject.id);

      const allowed = await robotsOk(url);
      if (!allowed) {
        stats.robots_denied++;
        await upsert(subject, url, { status: 0, finalUrl: url, state: "blocked" }, previous, 0);
        continue;
      }
      await politeDelay(host);
      const result = await fetchSite(url);
      stats.fetched++;

      // A single network error never kills a record: hosting lapses. Two
      // consecutive failed runs at least 14 days apart mark it dead.
      let state = result.state;
      if (state === "error") {
        const prevFailed = previous && Number(previous.http_status) === 0;
        const prevOld = previous && previous.last_fetched < new Date(Date.now() - 14 * 864e5).toISOString();
        state = prevFailed && prevOld ? "dead" : (previous?.state ?? "live");
      }
      if (state === "live") stats.live++;
      else if (state === "blocked") stats.blocked++;
      else if (state === "dead") stats.dead++;

      await upsert(subject, url, { ...result, state }, previous, 1);
    }
  }

  async function upsert(subject, url, result, previous, robots) {
    const urlHash = sha256(url);
    const id = `obs_${sha256(`organisation|${subject.id}|${urlHash}`).slice(0, 16)}`;
    const existing = await d1(
      `select id, content_hash from observations
       where subject_type = 'organisation' and subject_id = ? and url_hash = ?`,
      [subject.id, urlHash],
    );
    if (existing.length) {
      if (result.contentHash && existing[0].content_hash && result.contentHash !== existing[0].content_hash) {
        stats.changed++;
      }
      await d1(
        `update observations
         set last_fetched = ?, http_status = ?, state = ?, robots_ok = ?,
             title = coalesce(nullif(?, ''), title),
             excerpt = coalesce(nullif(?, ''), excerpt),
             content_hash = coalesce(nullif(?, ''), content_hash),
             canonical_url = ?
         where id = ?`,
        [now(), result.status, result.state, robots,
         result.title ?? "", result.excerpt ?? "", result.contentHash ?? "",
         canonicalUrl(result.finalUrl) || url, existing[0].id],
      );
    } else {
      stats.added++;
      await d1(
        `insert or ignore into observations
           (id, subject_type, subject_id, url, canonical_url, url_hash, kind,
            source_tier, publisher, title, excerpt, content_hash, http_status,
            state, robots_ok)
         values (?, 'organisation', ?, ?, ?, ?, 'company_site', 6, ?, ?, ?, ?, ?, ?, ?)`,
        [id, subject.id, url, canonicalUrl(result.finalUrl) || url, urlHash,
         hostOf(url), result.title ?? "", result.excerpt ?? "",
         result.contentHash ?? "", result.status, result.state, robots],
      );
    }
  }

  await Promise.all(Array.from({ length: 4 }, workerLoop));
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
