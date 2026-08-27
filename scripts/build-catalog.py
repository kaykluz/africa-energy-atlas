#!/usr/bin/env python3
"""Build a slim, linked catalog from the existing AESM datasets."""
from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

# Where the source dataset and the output live.
#
# Both were hardcoded to the sandbox this script was first written in
# (`/tmp/aesm`, `/workspace/src/data`), which meant it could not run anywhere
# else — including a normal checkout of this repository. They are now
# overridable, in this order: CLI flag, environment variable, then the previous
# default. `--out` additionally falls back to this repo's own `src/data`, which
# is where `/workspace/src/data` pointed in that sandbox, so an unflagged run
# behaves as it always did.
_parser = argparse.ArgumentParser(
    description="Build the atlas catalog from an africa-energy-software-map checkout.",
)
_parser.add_argument(
    "--src", default=os.environ.get("AESM_SRC"),
    help="Path to an africa-energy-software-map checkout (env: AESM_SRC).",
)
_parser.add_argument(
    "--out", default=os.environ.get("ATLAS_OUT"),
    help="Directory to write catalog.json into (env: ATLAS_OUT).",
)
_args = _parser.parse_args()

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = Path(_args.src) if _args.src else Path("/tmp/aesm")
OUT = Path(_args.out) if _args.out else (
    Path("/workspace/src/data") if Path("/workspace/src/data").parent.exists()
    else REPO_ROOT / "src" / "data"
)

if not SRC.exists():
    raise SystemExit(
        f"source checkout not found: {SRC}\n"
        "Pass --src /path/to/africa-energy-software-map (or set AESM_SRC).\n"
        "This script reads the released dataset, taxonomy and organisation "
        "catalogue from that repository; it does not generate them."
    )
RELEASE = SRC / "data/releases/0.2.0/batch-001"
SNAP = SRC / "web/generated/registry-snapshot.json"
ORG_CAT = SRC / "web/generated/organisation-catalogue.json"
TAX = SRC / "data/taxonomy.json"
COUNTRIES_PATH = SRC / "data/african-countries.json"
CLASSIFICATIONS = SRC / "data/landscape/classifications.json"
BRAND = SRC / "data/brand-assets/organisations.json"


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = value.encode("ascii", "ignore").decode("ascii")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "item"


def norm_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = value.encode("ascii", "ignore").decode("ascii")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return value.strip()


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def clip(text: str | None, n: int = 280) -> str:
    text = (text or "").strip()
    if len(text) <= n:
        return text
    cut = text[: n - 1].rsplit(" ", 1)[0]
    return cut + "…"


# --- country resolution -------------------------------------------------

african = load_json(COUNTRIES_PATH)
ISO_NAME = {c["iso2"]: c["name"] for c in african}

NAME_TO_ISO: dict[str, str] = {}


def add_alias(name: str, iso: str) -> None:
    key = norm_name(name)
    if key:
        NAME_TO_ISO[key] = iso


for iso, name in ISO_NAME.items():
    add_alias(name, iso)
    add_alias(iso, iso)

EXTRA = {
    "CI": ["Cote d'Ivoire", "Ivory Coast", "Cote dIvoire"],
    "CD": ["DRC", "Congo DRC", "Congo-Kinshasa", "DR Congo", "D.R. Congo"],
    "CG": ["Congo-Brazzaville", "Congo Republic"],
    "GM": ["Gambia"],
    "SZ": ["Swaziland"],
    "CV": ["Cape Verde"],
    "TZ": ["Tanzania"],
    "NG": ["Nigeria"],
    "KE": ["Kenya"],
    "ZA": ["South Africa", "RSA"],
    "EG": ["Egypt"],
    "GH": ["Ghana"],
    "UG": ["Uganda"],
    "SN": ["Senegal"],
    "MA": ["Morocco"],
    "ET": ["Ethiopia"],
    "RW": ["Rwanda"],
    "MZ": ["Mozambique"],
    "AO": ["Angola"],
    "CM": ["Cameroon"],
    "ZW": ["Zimbabwe"],
    "ZM": ["Zambia"],
    "MW": ["Malawi"],
    "ML": ["Mali"],
    "BF": ["Burkina Faso"],
    "BJ": ["Benin"],
    "TG": ["Togo"],
    "NE": ["Niger"],
    "TD": ["Chad"],
    "SS": ["South Sudan"],
    "SD": ["Sudan"],
    "LY": ["Libya"],
    "TN": ["Tunisia"],
    "DZ": ["Algeria"],
    "NA": ["Namibia"],
    "BW": ["Botswana"],
    "LS": ["Lesotho"],
    "MG": ["Madagascar"],
    "MU": ["Mauritius"],
    "SC": ["Seychelles"],
    "SO": ["Somalia"],
    "SL": ["Sierra Leone"],
    "LR": ["Liberia"],
    "GN": ["Guinea"],
    "GW": ["Guinea Bissau"],
    "GQ": ["Equatorial Guinea"],
    "GA": ["Gabon"],
    "CG": ["Republic of Congo"],
    "BI": ["Burundi"],
    "DJ": ["Djibouti"],
    "ER": ["Eritrea"],
    "KM": ["Comoros"],
    "ST": ["Sao Tome and Principe", "Sao Tome"],
    "MR": ["Mauritania"],
}
for iso, names in EXTRA.items():
    for n in names:
        add_alias(n, iso)

WORLD = {
    "united states": "US",
    "usa": "US",
    "us": "US",
    "united kingdom": "GB",
    "uk": "GB",
    "great britain": "GB",
    "england": "GB",
    "germany": "DE",
    "france": "FR",
    "china": "CN",
    "switzerland": "CH",
    "netherlands": "NL",
    "india": "IN",
    "spain": "ES",
    "norway": "NO",
    "canada": "CA",
    "denmark": "DK",
    "australia": "AU",
    "israel": "IL",
    "sweden": "SE",
    "slovenia": "SI",
    "ireland": "IE",
    "slovakia": "SK",
    "austria": "AT",
    "new zealand": "NZ",
    "finland": "FI",
    "belgium": "BE",
    "italy": "IT",
    "japan": "JP",
    "qatar": "QA",
    "taiwan": "TW",
    "poland": "PL",
    "uae": "AE",
    "united arab emirates": "AE",
    "mexico": "MX",
    "bulgaria": "BG",
    "lithuania": "LT",
    "cambodia": "KH",
    "singapore": "SG",
    "brazil": "BR",
    "portugal": "PT",
    "south korea": "KR",
    "korea": "KR",
    "turkey": "TR",
    "czech republic": "CZ",
    "czechia": "CZ",
}
NAME_TO_ISO.update(WORLD)

AFRICA_WIDE = {
    "africa",
    "african",
    "sub saharan africa",
    "subsaharan africa",
    "continent",
    "pan african",
    "africa wide",
    "africa-wide",
}
REGIONS = {
    "east africa": "east",
    "west africa": "west",
    "north africa": "north",
    "southern africa": "southern",
    "central africa": "central",
    "sahel": "sahel",
    "global": "global",
    "international": "global",
    "eu": "global",
    "middle east": "global",
}

AFRICAN_ISO = set(ISO_NAME.keys())


def parse_geos(values) -> tuple[list[str], bool, list[str]]:
    countries: list[str] = []
    regions: list[str] = []
    africa_wide = False
    for raw in values or []:
        for part in re.split(r"[/,]| and ", str(raw)):
            key = norm_name(part)
            if not key:
                continue
            if key in AFRICA_WIDE:
                africa_wide = True
                continue
            if key in REGIONS:
                regions.append(REGIONS[key])
                continue
            iso = NAME_TO_ISO.get(key)
            if iso:
                countries.append(iso)
    # unique preserve order
    seen = set()
    out = []
    for iso in countries:
        if iso not in seen:
            seen.add(iso)
            out.append(iso)
    return out, africa_wide, list(dict.fromkeys(regions))


# --- load sources -------------------------------------------------------

taxonomy = load_json(TAX)
snapshot = load_json(SNAP)
org_cat = load_json(ORG_CAT)
class_items = {c["itemId"]: c for c in load_json(CLASSIFICATIONS)["items"]}

landscape_items = []
for fp in sorted(glob.glob(str(SRC / "data/landscape/shards/*.json"))):
    shard = load_json(Path(fp))
    landscape_items.extend(shard.get("items") or [])

brand_by_org = {}
if BRAND.exists():
    for a in load_json(BRAND).get("assets") or []:
        brand_by_org[a.get("organisationId")] = a.get("localPath")

reviewed_products = snapshot["products"]
reviewed_orgs = snapshot["organisations"]
deployments = snapshot["deployments"]
sources = snapshot["sources"]
assertions = snapshot["assertions"]

stage_by_id = {s["id"]: s for s in snapshot["stages"]}
cat_by_id = {c["id"]: c for c in snapshot["categories"]}
# taxonomy stages include categories
stage_of_category = {}
for st in taxonomy["stages"]:
    for cat in st["categories"]:
        stage_of_category[cat["id"]] = st["id"]
for cat in taxonomy.get("cross_cutting") or []:
    stage_of_category[cat["id"]] = "stage_cross_cutting"

function_by_id = {f["id"]: f for f in taxonomy.get("functions") or []}
sector_by_id = {s["id"]: s for s in taxonomy.get("sectors") or []}

REL_LABEL = {
    "energy_native": "Built for energy",
    "energy_applied": "Applied in energy",
    "enabling_infrastructure": "Enabling infrastructure",
    "operator_owned": "Operator-owned",
    "public_research": "Public and research",
    "unclassified": "To classify",
}

ROLE_NORM = {
    "software/data": "software",
    "software": "software",
    "operator": "operator",
    "developer": "developer",
    "oem": "oem",
    "epc": "epc",
    "financier": "financier",
    "enabler": "enabler",
    "public institution": "public",
}


def role_id(raw: str) -> str:
    key = (raw or "").strip().lower()
    return ROLE_NORM.get(key, slugify(raw) if raw else "other")


# --- companies ----------------------------------------------------------

companies: dict[str, dict] = {}
company_by_norm: dict[str, str] = {}
used_slugs: set[str] = set()


def unique_slug(base: str) -> str:
    s = slugify(base)
    if s not in used_slugs:
        used_slugs.add(s)
        return s
    i = 2
    while f"{s}-{i}" in used_slugs:
        i += 1
    used_slugs.add(f"{s}-{i}")
    return f"{s}-{i}"


def add_company(rec: dict) -> str:
    nid = rec["id"]
    if nid in companies:
        # merge sparse fields
        existing = companies[nid]
        for k, v in rec.items():
            if k in ("countries", "roles", "productIds"):
                existing[k] = list(dict.fromkeys([*(existing.get(k) or []), *(v or [])]))
            elif v and not existing.get(k):
                existing[k] = v
        return nid
    name = rec["name"]
    key = norm_name(name)
    if key in company_by_norm:
        existing_id = company_by_norm[key]
        add_company({**rec, "id": existing_id})
        return existing_id
    rec.setdefault("slug", unique_slug(name))
    rec.setdefault("roles", [])
    rec.setdefault("countries", [])
    rec.setdefault("productIds", [])
    rec.setdefault("tier", "catalogue")
    rec.setdefault("africaWide", False)
    companies[nid] = rec
    if key:
        company_by_norm[key] = nid
    return nid


# reviewed orgs
for org in reviewed_orgs:
    countries, africa_wide, _ = parse_geos(
        [org.get("countryOfOriginIso2") or "", org.get("headquartersCountryIso2") or ""]
    )
    hq = org.get("headquartersCountryIso2") or org.get("countryOfOriginIso2") or ""
    add_company(
        {
            "id": org["id"],
            "name": org["name"],
            "slug": org.get("slug") or unique_slug(org["name"]),
            "summary": clip(org.get("description"), 220),
            "website": org.get("website") or "",
            "role": "software",
            "roles": ["software"],
            "hq": hq,
            "origin": org.get("countryOfOriginIso2") or "",
            "africaBuilt": org.get("originClassification") == "africa_built",
            "countries": [c for c in countries if c in AFRICAN_ISO],
            "africaWide": africa_wide,
            "tier": "reviewed",
            "lifecycle": org.get("lifecycleStatus") or "active",
            "logo": brand_by_org.get(org["id"]) or "",
            "sourceUrl": org.get("website") or "",
        }
    )
    used_slugs.add(org.get("slug") or slugify(org["name"]))

# landscape organisations
for item in landscape_items:
    if item.get("kind") != "organisation":
        continue
    countries, africa_wide, _ = parse_geos(item.get("geographies"))
    cls = class_items.get(item["id"], {})
    add_company(
        {
            "id": item["id"],
            "name": item["name"],
            "summary": clip(item.get("summaryAsSubmitted"), 220),
            "website": (item.get("websiteAsSubmitted") or (item.get("sourceUrls") or [""])[0]),
            "role": "software",
            "roles": ["software"],
            "hq": next((c for c in countries if c not in AFRICAN_ISO), "")
            or next((c for c in countries if c in AFRICAN_ISO), ""),
            "countries": [c for c in countries if c in AFRICAN_ISO],
            "africaWide": africa_wide,
            "tier": "landscape",
            "lifecycle": item.get("statusAsSubmitted") or "active",
            "sourceUrl": (item.get("sourceUrls") or [""])[0],
            "relationship": cls.get("energyRelationship") or "",
        }
    )

# ecosystem catalogue
for rec in org_cat.get("records") or []:
    countries, africa_wide, _ = parse_geos(rec.get("countriesActive"))
    hq_list, _, _ = parse_geos([rec.get("headquartersCountry") or ""])
    hq = hq_list[0] if hq_list else ""
    if hq and hq in AFRICAN_ISO and hq not in countries:
        countries = [hq, *countries]
    role = role_id(rec.get("primaryRole") or rec.get("organisationType") or "")
    extra_roles = [role_id(r) for r in (rec.get("roles") or []) if role_id(r)]
    cid = rec["id"]
    # if name matches a reviewed/landscape company, merge
    add_company(
        {
            "id": cid,
            "name": rec["name"],
            "summary": clip(rec.get("description") or rec.get("projectFocus"), 220),
            "website": rec.get("website") or "",
            "role": role,
            "roles": list(dict.fromkeys([role, *extra_roles])),
            "hq": hq,
            "hqCity": rec.get("headquartersCity") or "",
            "africaBuilt": bool(rec.get("africaHeadquartered")),
            "countries": [c for c in countries if c in AFRICAN_ISO],
            "africaWide": africa_wide,
            "tier": "reviewed" if rec.get("reviewState") == "reviewed" else "catalogue",
            "lifecycle": rec.get("lifecycle") or "",
            "segments": (rec.get("segments") or [])[:4],
            "sourceUrl": rec.get("sourceUrl") or rec.get("website") or "",
        }
    )


# --- software -----------------------------------------------------------

software: dict[str, dict] = {}
software_by_norm: dict[str, str] = {}
software_slugs: set[str] = set()


def unique_sw_slug(base: str) -> str:
    s = slugify(base)
    if s not in software_slugs:
        software_slugs.add(s)
        return s
    i = 2
    while f"{s}-{i}" in software_slugs:
        i += 1
    software_slugs.add(f"{s}-{i}")
    return f"{s}-{i}"


def stages_for(category_ids, function_ids, explicit):
    out = list(explicit or [])
    for cid in category_ids or []:
        sid = stage_of_category.get(cid) or cat_by_id.get(cid, {}).get("stageId")
        if sid:
            out.append(sid)
    for fid in function_ids or []:
        fn = function_by_id.get(fid) or {}
        out.extend(fn.get("stageIds") or [])
    # drop empty / unique
    seen = []
    for s in out:
        if s and s not in seen:
            seen.append(s)
    return seen


# reviewed products first
reviewed_by_slug = {}
for p in reviewed_products:
    countries = list(p.get("deploymentCountries") or [])
    company_id = p.get("organisationId")
    if company_id in companies:
        companies[company_id].setdefault("productIds", [])
        if p["id"] not in companies[company_id]["productIds"]:
            companies[company_id]["productIds"].append(p["id"])
        # add deployment countries onto company
        for c in countries:
            if c in AFRICAN_ISO and c not in companies[company_id]["countries"]:
                companies[company_id]["countries"].append(c)
    rec = {
        "id": p["id"],
        "slug": p["slug"],
        "name": p["name"],
        "summary": clip(p.get("description"), 240),
        "companyId": company_id,
        "companyName": p.get("organisation") or "",
        "website": p.get("website") or "",
        "categoryId": p.get("categoryId") or "",
        "categoryIds": [p["categoryId"]] if p.get("categoryId") else [],
        "stageIds": [p["stageId"]] if p.get("stageId") else stages_for([p.get("categoryId")], [], []),
        "functionIds": [],
        "sectorIds": [],
        "relationship": "energy_native",
        "countries": [c for c in countries if c in AFRICAN_ISO],
        "africaWide": False,
        "reviewed": True,
        "origin": p.get("originClassification") or "",
        "africaBuilt": p.get("originClassification") == "africa_built",
        "access": p.get("accessModel") or "",
        "lifecycle": p.get("lifecycleStatus") or "active",
        "openSourceUrl": p.get("openSourceUrl") or "",
        "capabilities": p.get("capabilities") or [],
        "evidence": p.get("evidenceStatuses") or [],
        "kind": "product",
        "lastChecked": p.get("lastCheckedAt") or "",
        "logo": brand_by_org.get(company_id) or "",
    }
    software[p["id"]] = rec
    software_by_norm[norm_name(p["name"])] = p["id"]
    software_slugs.add(p["slug"])
    reviewed_by_slug[p["slug"]] = p["id"]

# landscape products / public tools
for item in landscape_items:
    if item.get("kind") not in ("product", "public_tool"):
        continue
    cls = class_items.get(item["id"], {})
    function_ids = cls.get("functionIds") or []
    relationship = cls.get("energyRelationship") or "unclassified"
    countries, africa_wide, _ = parse_geos(item.get("geographies"))
    countries = [c for c in countries if c in AFRICAN_ISO]
    name = item["name"]
    key = norm_name(name)
    parent = item.get("parent") or ""
    company_id = company_by_norm.get(norm_name(parent)) if parent else None
    if parent and not company_id:
        company_id = add_company(
            {
                "id": f"co_{slugify(parent)[:40]}",
                "name": parent,
                "summary": "",
                "website": "",
                "role": "software",
                "roles": ["software"],
                "hq": "",
                "countries": list(countries),
                "africaWide": africa_wide,
                "tier": "landscape",
            }
        )

    canonical = item.get("canonicalHref") or ""
    reviewed_id = None
    if canonical.startswith("/products/"):
        reviewed_id = reviewed_by_slug.get(canonical.split("/")[-1])
    if not reviewed_id and key in software_by_norm:
        reviewed_id = software_by_norm[key]

    if reviewed_id:
        rec = software[reviewed_id]
        rec["functionIds"] = list(dict.fromkeys([*(rec.get("functionIds") or []), *function_ids]))
        rec["categoryIds"] = list(dict.fromkeys([*(rec.get("categoryIds") or []), *(item.get("categoryIds") or [])]))
        rec["sectorIds"] = list(dict.fromkeys([*(rec.get("sectorIds") or []), *(item.get("sectorIds") or [])]))
        rec["stageIds"] = stages_for(rec["categoryIds"], rec["functionIds"], rec.get("stageIds"))
        rec["countries"] = list(dict.fromkeys([*(rec.get("countries") or []), *countries]))
        rec["africaWide"] = rec.get("africaWide") or africa_wide
        rec["landscapeId"] = item["id"]
        if not rec.get("website"):
            rec["website"] = item.get("websiteAsSubmitted") or (item.get("sourceUrls") or [""])[0]
        if company_id and not rec.get("companyId"):
            rec["companyId"] = company_id
        if company_id:
            companies[company_id].setdefault("productIds", [])
            if reviewed_id not in companies[company_id]["productIds"]:
                companies[company_id]["productIds"].append(reviewed_id)
        continue

    sid = item["id"]
    rec = {
        "id": sid,
        "slug": unique_sw_slug(name),
        "name": name,
        "summary": clip(item.get("summaryAsSubmitted"), 240),
        "companyId": company_id or "",
        "companyName": parent,
        "website": item.get("websiteAsSubmitted") or (item.get("sourceUrls") or [""])[0] or "",
        "categoryId": (item.get("categoryIds") or [""])[0],
        "categoryIds": item.get("categoryIds") or [],
        "functionIds": function_ids,
        "sectorIds": item.get("sectorIds") or [],
        "stageIds": stages_for(item.get("categoryIds"), function_ids, item.get("stageIds")),
        "relationship": relationship,
        "countries": countries,
        "africaWide": africa_wide or (not countries),
        "reviewed": False,
        "origin": "",
        "africaBuilt": False,
        "access": item.get("commercialModelAsSubmitted") or "",
        "lifecycle": item.get("statusAsSubmitted") or "active",
        "openSourceUrl": "",
        "capabilities": (item.get("segmentsAsSubmitted") or [])[:6],
        "evidence": [],
        "kind": item.get("kind") or "product",
        "lastChecked": item.get("asOfDate") or "",
        "logo": "",
        "sourceUrl": (item.get("sourceUrls") or [""])[0],
    }
    # if no named African country and tagged Africa, africaWide
    if not rec["countries"] and not rec["africaWide"]:
        rec["africaWide"] = True
    software[sid] = rec
    software_by_norm[key] = sid
    if company_id:
        companies[company_id].setdefault("productIds", [])
        if sid not in companies[company_id]["productIds"]:
            companies[company_id]["productIds"].append(sid)
        for c in countries:
            if c in AFRICAN_ISO and c not in companies[company_id]["countries"]:
                companies[company_id]["countries"].append(c)


# --- deployments & sources (reviewed only) ------------------------------

dep_out = []
for d in deployments:
    dep_out.append(
        {
            "id": d["id"],
            "softwareId": d["productId"],
            "country": d["countryIso2"],
            "area": d.get("subnationalArea") or "",
            "customer": d.get("customerName") or "",
            "status": d.get("lifecycleStatus") or "",
            "year": d.get("startedYear") or "",
            "evidence": d.get("evidenceStatus") or "",
            "sourceId": d.get("sourceId") or "",
        }
    )

# attach a few sources per reviewed software via assertions
source_by_id = {s["id"]: s for s in sources}
software_sources: dict[str, list[str]] = defaultdict(list)
dep_by_product = defaultdict(list)
for d in deployments:
    dep_by_product[d["productId"]].append(d["id"])

for a in assertions:
    subj = a.get("subjectId")
    src = a.get("sourceId")
    if not src:
        continue
    if subj in software:
        if src not in software_sources[subj]:
            software_sources[subj].append(src)
    else:
        # deployment subject
        for pid, dids in dep_by_product.items():
            if subj in dids and src not in software_sources[pid]:
                software_sources[pid].append(src)

source_out = []
used_sources = set()
for sid, src_ids in software_sources.items():
    for src_id in src_ids[:6]:
        used_sources.add(src_id)
        software[sid].setdefault("sourceIds", [])
        if src_id not in software[sid]["sourceIds"]:
            software[sid]["sourceIds"].append(src_id)

for s in sources:
    if s["id"] in used_sources:
        source_out.append(
            {
                "id": s["id"],
                "url": s.get("url") or "",
                "title": s.get("title") or s.get("publisher") or "Source",
                "publisher": s.get("publisher") or "",
                "independence": s.get("independenceClass") or "",
                "retrieved": s.get("retrievedAt") or "",
            }
        )


# --- country stats ------------------------------------------------------

country_software: dict[str, set[str]] = defaultdict(set)
country_companies: dict[str, set[str]] = defaultdict(set)
country_deployments: dict[str, int] = defaultdict(int)

for sw in software.values():
    for c in sw.get("countries") or []:
        if c in AFRICAN_ISO:
            country_software[c].add(sw["id"])
    # do NOT paint africa-wide onto every country
for co in companies.values():
    for c in co.get("countries") or []:
        if c in AFRICAN_ISO:
            country_companies[c].add(co["id"])
    hq = co.get("hq")
    if hq in AFRICAN_ISO:
        country_companies[hq].add(co["id"])
for d in dep_out:
    if d["country"] in AFRICAN_ISO:
        country_deployments[d["country"]] += 1
        country_software[d["country"]].add(d["softwareId"])

country_stats = []
for iso, name in ISO_NAME.items():
    country_stats.append(
        {
            "iso2": iso,
            "name": name,
            "software": len(country_software[iso]),
            "companies": len(country_companies[iso]),
            "deployments": country_deployments[iso],
        }
    )
country_stats.sort(key=lambda x: (-x["software"] - x["companies"], x["name"]))


# --- taxonomy slim ------------------------------------------------------

stages_out = []
for st in taxonomy["stages"]:
    stages_out.append(
        {
            "id": st["id"],
            "name": st["name"],
            "order": st["order"],
            "categories": [{"id": c["id"], "name": c["name"]} for c in st["categories"]],
        }
    )
stages_out.append(
    {
        "id": "stage_cross_cutting",
        "name": "Cross-cutting",
        "order": 7,
        "categories": [{"id": c["id"], "name": c["name"]} for c in taxonomy.get("cross_cutting") or []],
    }
)

functions_out = [
    {
        "id": f["id"],
        "name": f["name"],
        "stageIds": f.get("stageIds") or [],
    }
    for f in taxonomy.get("functions") or []
]
sectors_out = [{"id": s["id"], "name": s["name"]} for s in taxonomy.get("sectors") or []]
relationships_out = [
    {"id": r["id"], "name": r["name"]} for r in taxonomy.get("energy_relationships") or []
]

# drop empty companies without name
company_list = [c for c in companies.values() if c.get("name")]
software_list = [s for s in software.values() if s.get("name")]

# counts
africa_wide_software = sum(1 for s in software_list if s.get("africaWide"))
reviewed_software = sum(1 for s in software_list if s.get("reviewed"))

catalog = {
    "version": "0.3.0",
    "asOf": snapshot["release"]["date"],
    "releaseLabel": snapshot["release"].get("status") or "Reviewed beta",
    "counts": {
        "software": len(software_list),
        "reviewedSoftware": reviewed_software,
        "companies": len(company_list),
        "deployments": len(dep_out),
        "sources": len(source_out),
        "countriesWithSoftware": sum(1 for c in country_stats if c["software"] > 0),
        "countriesWithCompanies": sum(1 for c in country_stats if c["companies"] > 0),
        "africaWideSoftware": africa_wide_software,
    },
    "stages": stages_out,
    "functions": functions_out,
    "sectors": sectors_out,
    "relationships": relationships_out,
    "countries": [{"iso2": c["iso2"], "name": c["name"]} for c in african],
    "countryStats": country_stats,
    "software": software_list,
    "companies": company_list,
    "deployments": dep_out,
    "sources": source_out,
}

OUT.mkdir(parents=True, exist_ok=True)
out_path = OUT / "catalog.json"
out_path.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")))
print(
    f"wrote {out_path} ({out_path.stat().st_size/1024:.0f} KB) "
    f"software={len(software_list)} companies={len(company_list)} "
    f"reviewed={reviewed_software} africaWide={africa_wide_software}"
)
print("top countries", country_stats[:8])
print("software by stage:")
from collections import Counter
stc = Counter()
for s in software_list:
    for sid in s.get("stageIds") or ["none"]:
        stc[sid] += 1
print(stc)
print("company roles", Counter(c.get("role") for c in company_list))
