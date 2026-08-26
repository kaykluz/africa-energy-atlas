-- Audit trail for editorial decisions, and the hashed-IP throttle for public
-- intake. SQLite dialect (Cloudflare D1).

create table if not exists contribution_audit (
  id text primary key,
  contribution_id text not null,
  actor_user_id text not null,
  actor_email text not null,
  action text not null,
  from_status text not null default '',
  to_status text not null,
  note text not null default '',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists contribution_audit_contribution_idx
  on contribution_audit (contribution_id, created_at desc);

-- Hashed submitter IPs only — used to throttle public intake. Never returned
-- to clients, and never reversible to an address.
create table if not exists contribution_submit_events (
  id text primary key,
  ip_hash text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists contribution_submit_events_ip_created_idx
  on contribution_submit_events (ip_hash, created_at desc);
