-- Enrichment: observations, assertions and the support edges between them.
-- SQLite dialect (Cloudflare D1).
--
-- The model in one line: an OBSERVATION is an artefact we fetched (a page, a
-- filing, an article); an ASSERTION is a dated claim about a subject; a
-- SUPPORT edge ties one observation to one assertion. Observations accumulate
-- without limit; assertions stay disciplined, because their evidence_status is
-- DERIVED from the tiers of their supporting observations and volume alone can
-- never raise it (docs/04 in the dataset repository: tiers 5-8 are discovery,
-- only tiers 1-3 establish independent evidence).

create table if not exists observations (
  id text primary key,
  subject_type text not null,             -- organisation | product | project
  subject_id text not null default '',    -- '' = unattached pool, awaiting review
  url text not null,
  canonical_url text not null default '',
  url_hash text not null,                 -- sha256 of canonical_url (dedupe key)
  kind text not null default 'other',     -- company_site | news | press_release |
                                          -- regulator_filing | tender | directory |
                                          -- report | registry | social | other
  source_tier integer not null default 7, -- 1..8 per docs/04; 7 = aggregator default
  publisher text not null default '',
  published_at text not null default '',
  title text not null default '',
  excerpt text not null default '',       -- QUOTED text only, never generated prose
  content_hash text not null default '',  -- change detection; '' until first parse
  http_status integer not null default 0,
  state text not null default 'live',     -- live | moved | dead | blocked
  robots_ok integer not null default 1,
  first_fetched text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_fetched text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One row per (subject, canonical URL): re-fetches update, never duplicate.
create unique index if not exists observations_subject_url_uidx
  on observations (subject_type, subject_id, url_hash);

create index if not exists observations_subject_idx
  on observations (subject_type, subject_id, last_fetched desc);

-- The crawler's work queue: stalest first.
create index if not exists observations_staleness_idx
  on observations (kind, last_fetched);

create table if not exists assertions (
  id text primary key,
  subject_type text not null,
  subject_id text not null,
  predicate text not null,                -- hq_country | has_role | operates_in |
                                          -- distributes_for | website | project_party | ...
  value text not null,
  unit text not null default '',
  as_of text not null default '',
  valid_from text not null default '',
  valid_to text not null default '',
  evidence_status text not null default 'provider_claim_only',
  first_seen text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_confirmed text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  superseded_by text not null default '', -- corrections chain; history survives
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists assertions_subject_idx
  on assertions (subject_type, subject_id, predicate);

-- A live fact is unique per (subject, predicate, value); superseded rows keep
-- their history without blocking the correction.
create unique index if not exists assertions_live_uidx
  on assertions (subject_type, subject_id, predicate, value)
  where superseded_by = '';

create table if not exists assertion_supports (
  assertion_id text not null,
  observation_id text not null,
  relation text not null default 'supports',  -- supports | contradicts | context
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (assertion_id, observation_id)
);

create index if not exists assertion_supports_observation_idx
  on assertion_supports (observation_id);
