import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  companyPresence,
  presenceDetail,
  presenceShortLabel,
  productLogo,
  softwarePresence,
} from "./presence.ts";

const company = (over: Record<string, unknown> = {}) =>
  ({
    id: "c", name: "N", slug: "n", summary: "", website: "", role: "epc", roles: ["epc"],
    hq: "", countries: [], africaWide: false, origin: "", africaBuilt: false,
    tier: "catalogue", lifecycle: "active", sourceUrl: "", productIds: [], ...over,
  }) as never;

const software = (over: Record<string, unknown> = {}) =>
  ({ id: "s", name: "S", slug: "s", countries: [], africaWide: false, logo: "", ...over }) as never;

test("a named country is the strongest reason", () => {
  assert.deepEqual(companyPresence(company({ countries: ["NG"] }), "NG"), ["named"]);
});

test("headquarters and named activity both show", () => {
  assert.deepEqual(
    companyPresence(company({ countries: ["NG"], hq: "NG" }), "NG"),
    ["named", "headquarters"],
  );
});

test("Africa-wide never joins a named reason", () => {
  // The weakest claim must not ride alongside a specific one, or a general
  // continental tag reads as though it corroborates the named country.
  assert.deepEqual(
    companyPresence(company({ countries: ["NG"], africaWide: true }), "NG"),
    ["named"],
  );
});

test("Africa-wide stands alone when nothing else applies", () => {
  assert.deepEqual(companyPresence(company({ africaWide: true }), "KE"), ["africa_wide"]);
});

test("country of origin counts even without recorded activity", () => {
  assert.deepEqual(companyPresence(company({ origin: "GH" }), "GH"), ["origin"]);
});

test("a company unconnected to the country has no reason", () => {
  assert.deepEqual(companyPresence(company({ countries: ["NG"] }), "KE"), []);
});

test("software presence follows the same rule", () => {
  assert.deepEqual(softwarePresence(software({ countries: ["ZA"] }), "ZA"), ["named"]);
  assert.deepEqual(softwarePresence(software({ africaWide: true }), "ZA"), ["africa_wide"]);
});

test("labels stay short, and collapse past two", () => {
  assert.equal(presenceShortLabel([]), "Listed");
  assert.equal(presenceShortLabel(["named"]), "Named activity");
  assert.equal(presenceShortLabel(["named", "headquarters"]), "Named activity · HQ");
  assert.equal(presenceShortLabel(["named", "headquarters", "origin"]), "Named activity +2");
});

test("the detail text spells every reason out", () => {
  assert.match(presenceDetail(["named", "headquarters"]), /names activity.*Headquartered/s);
  assert.equal(presenceDetail([]), "Listed in the directory for this country");
});

test("a product falls back to its owner's logo before initials", () => {
  assert.equal(productLogo(software({ logo: "/own.png" }), "/owner.png"), "/own.png");
  assert.equal(productLogo(software(), "/owner.png"), "/owner.png");
  assert.equal(productLogo(software()), "");
});
