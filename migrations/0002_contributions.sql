-- Public contribution intake, plus the editorial columns the review workspace
-- writes. SQLite dialect (Cloudflare D1).
--
-- Consolidated on purpose: the Postgres original grew these columns through a
-- later `alter table ... add column if not exists` pass, which SQLite does not
-- support. D1 starts empty, so the table is simply declared in full here.
--
-- Timestamps are ISO-8601 TEXT (`strftime` with `%f` gives millisecond
-- precision and a trailing Z), so string ordering is chronological ordering.

create table if not exists contributions (
  id text primary key,
  kind text not null,
  name text not null,
  website text not null default '',
  country_iso2 text not null default '',
  stage_id text not null default '',
  summary text not null,
  source_url text not null default '',
  status text not null default 'received',
  note text not null default '',
  slug text not null default '',
  version integer not null default 1,
  reviewed_by_user_id text not null default '',
  reviewed_by_email text not null default '',
  reviewed_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists contributions_created_at_idx
  on contributions (created_at desc);

create index if not exists contributions_status_created_idx
  on contributions (status, created_at desc);

-- Accepted records claim a slug; everything else leaves it empty, so the
-- uniqueness rule has to skip the empty string.
create unique index if not exists contributions_slug_uidx
  on contributions (slug)
  where slug <> '';
