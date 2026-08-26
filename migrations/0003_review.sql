-- Editorial moderation for public contributions.
-- Pending rows stay private. Only `accepted` software/company rows are public.

alter table contributions add column if not exists status text not null default 'received';
alter table contributions add column if not exists note text not null default '';
alter table contributions add column if not exists slug text not null default '';
alter table contributions add column if not exists version integer not null default 1;
alter table contributions add column if not exists reviewed_by_user_id text not null default '';
alter table contributions add column if not exists reviewed_by_email text not null default '';
alter table contributions add column if not exists reviewed_at timestamptz;

create index if not exists contributions_status_created_idx
  on contributions (status, created_at desc);

create unique index if not exists contributions_slug_uidx
  on contributions (slug)
  where slug <> '';

create table if not exists contribution_audit (
  id text primary key,
  contribution_id text not null,
  actor_user_id text not null,
  actor_email text not null,
  action text not null,
  from_status text not null default '',
  to_status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists contribution_audit_contribution_idx
  on contribution_audit (contribution_id, created_at desc);

-- Hashed submitter IPs only — used to throttle public intake. Not returned to clients.
create table if not exists contribution_submit_events (
  id text primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists contribution_submit_events_ip_created_idx
  on contribution_submit_events (ip_hash, created_at desc);
