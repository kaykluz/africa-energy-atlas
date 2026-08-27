import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  canonicalUrl,
  defaultTier,
  deriveEvidenceStatus,
  isSelfPublished,
  robotsAllows,
} from "./evidence.ts";

const sup = (sourceTier: number, selfPublished = false, relation: "supports" | "contradicts" | "context" = "supports") =>
  ({ sourceTier, selfPublished, relation });

test("volume never raises status: a hundred tier-7 links stay public_source", () => {
  const many = Array.from({ length: 100 }, () => sup(7));
  assert.equal(deriveEvidenceStatus(many), "public_source");
});

test("one tier-1 source outweighs any number of weak ones", () => {
  assert.equal(deriveEvidenceStatus([sup(7), sup(6), sup(1)]), "independently_evidenced");
});

test("only self-published material is a provider claim", () => {
  assert.equal(deriveEvidenceStatus([sup(6, true), sup(6, true)]), "provider_claim_only");
});

test("a self-published tier-1 lookalike does not count as independent", () => {
  // A company reposting a regulator notice on its own blog is still the company.
  assert.equal(deriveEvidenceStatus([sup(1, true)]), "provider_claim_only");
});

test("context and contradicts never move status up", () => {
  assert.equal(deriveEvidenceStatus([sup(1, false, "context")]), "provider_claim_only");
  assert.equal(deriveEvidenceStatus([sup(1, false, "contradicts")]), "provider_claim_only");
});

test("no supports at all is a provider claim", () => {
  assert.equal(deriveEvidenceStatus([]), "provider_claim_only");
});

test("canonical urls kill tracking noise and unify hosts", () => {
  assert.equal(
    canonicalUrl("https://www.Example.com:443/news/story/?utm_source=x&fbclid=abc&page=2#top"),
    "https://example.com/news/story?page=2",
  );
  assert.equal(canonicalUrl("http://example.com:80/a/"), "http://example.com/a");
  assert.equal(canonicalUrl("not a url"), "");
  assert.equal(canonicalUrl("ftp://example.com/x"), "");
});

test("query parameters are order-stable", () => {
  assert.equal(canonicalUrl("https://a.com/p?b=2&a=1"), canonicalUrl("https://a.com/p?a=1&b=2"));
});

test("self-published covers subdomains but not lookalikes", () => {
  assert.ok(isSelfPublished("https://blog.acme.com/post", "https://www.acme.com"));
  assert.ok(isSelfPublished("https://acme.com/about", "https://acme.com"));
  assert.ok(!isSelfPublished("https://notacme.com/x", "https://acme.com"));
  assert.ok(!isSelfPublished("https://acme.com.evil.com/x", "https://acme.com"));
});

test("robots: a disallow for * blocks us, longest match wins", () => {
  const txt = "User-agent: *\nDisallow: /private\nAllow: /private/press";
  assert.ok(!robotsAllows(txt, "/private/data"));
  assert.ok(robotsAllows(txt, "/private/press/2026"));
  assert.ok(robotsAllows(txt, "/public"));
});

test("robots: a group naming us specifically overrides *", () => {
  const txt = "User-agent: *\nDisallow: /\n\nUser-agent: AfricaEnergyAtlasBot\nDisallow: /admin";
  assert.ok(robotsAllows(txt, "/registers"));
  assert.ok(!robotsAllows(txt, "/admin/x"));
});

test("robots: empty file allows, empty Disallow allows", () => {
  assert.ok(robotsAllows("", "/anything"));
  assert.ok(robotsAllows("User-agent: *\nDisallow:", "/anything"));
});

test("robots: blanket disallow blocks everything", () => {
  assert.ok(!robotsAllows("User-agent: *\nDisallow: /", "/"));
});

test("default tiers follow the docs/04 hierarchy", () => {
  assert.equal(defaultTier("regulator_filing"), 1);
  assert.equal(defaultTier("news"), 5);
  assert.equal(defaultTier("company_site"), 6);
  assert.equal(defaultTier("directory"), 7);
  assert.equal(defaultTier("whatever"), 7);
});
