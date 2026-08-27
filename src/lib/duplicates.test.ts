import { strict as assert } from "node:assert";
import { test } from "node:test";
import { domainOf, editDistance, findDuplicates, looseName, strictName } from "./duplicates.ts";

const c = (id: string, name: string, countries: string[] = ["NG"], website = "") =>
  ({ id, name, countries, website });

test("legal forms are not part of the name", () => {
  assert.equal(strictName("Eauxwel Nigeria Limited"), "eauxwel nigeria");
  assert.equal(strictName("Affordable Power Solutions (PTY) LTD"), "affordable power solutions");
});

test("strict keeps geography, so distinct firms stay distinct", () => {
  // The rule that matters: these are two companies and must never collide.
  assert.notEqual(strictName("Solar Africa (Pty) Ltd"), strictName("Solar Corporation"));
});

test("loose drops country words, which is how Nig. meets Nigeria", () => {
  assert.equal(looseName("Eauxwel Nigeria Limited"), "eauxwel");
  assert.equal(looseName("Eauxwell Nig. Ltd"), "eauxwell");
});

test("the real pair from the live queue is found", () => {
  const a = c("1", "Eauxwel Nigeria Limited");
  const b = c("2", "Eauxwell Nig. Ltd");
  const [match] = findDuplicates(a, [b]);
  assert.equal(match?.otherId, "2");
  assert.equal(match?.reason, "near_name");
});

test("Solar Africa and Solar Corporation are NOT suggested", () => {
  // Both reduce to "solar" under the loose rule. The length guard is what
  // stops that becoming a merge that deletes a real company.
  const found = findDuplicates(c("1", "Solar Africa (Pty) Ltd"), [c("2", "Solar Corporation")]);
  assert.deepEqual(found, []);
});

test("short lookalike names are never matched fuzzily", () => {
  assert.deepEqual(findDuplicates(c("1", "EZ Solar"), [c("2", "JC Solar")]), []);
  assert.deepEqual(findDuplicates(c("1", "GX Energy"), [c("2", "HT Energy Ltd")]), []);
});

test("a shared website is a suggestion, not proof", () => {
  // Luken Solar and U Can Solar really do share lukensolar.co.za in the queue.
  // It is surfaced because an editor should look, not because it is settled.
  const [match] = findDuplicates(
    c("1", "Luken Solar", ["ZA"], "https://lukensolar.co.za"),
    [c("2", "U Can Solar (Pty) Ltd.", ["ZA"], "https://www.lukensolar.co.za/")],
  );
  assert.equal(match?.reason, "same_website");
});

test("the same name in two countries is not a duplicate", () => {
  assert.deepEqual(
    findDuplicates(c("1", "Solar Works", ["NG"]), [c("2", "Solar Works", ["KE"])]),
    [],
  );
});

test("a name that differs only by legal form is a duplicate", () => {
  const [match] = findDuplicates(
    c("1", "PSI Engineering Uganda Limited", ["UG"]),
    [c("2", "PSI ENGINEERING", ["UG"])],
  );
  assert.equal(match?.reason, "same_name");
});

test("edit distance bails out on very different lengths", () => {
  assert.equal(editDistance("abc", "abcdefgh"), 99);
  assert.equal(editDistance("eauxwel", "eauxwell"), 1);
  assert.equal(editDistance("same", "same"), 0);
});

test("domains are compared without www or scheme", () => {
  assert.equal(domainOf("https://www.Example.co.ke/path"), "example.co.ke");
  assert.equal(domainOf("not a url"), "");
});
