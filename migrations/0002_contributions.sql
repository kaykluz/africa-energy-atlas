create table if not exists contributions (
  id text primary key,
  kind text not null,
  name text not null,
  website text not null default '',
  country_iso2 text not null default '',
  stage_id text not null default '',
  summary text not null,
  source_url text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists contributions_created_at_idx on contributions (created_at desc);
