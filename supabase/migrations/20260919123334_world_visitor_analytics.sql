-- Browser roles cannot read or write analytics; the Edge Function validates all access.
create schema if not exists analytics_private;
revoke all on schema analytics_private from public, anon, authenticated;
create table analytics_private.visits (
  id uuid primary key,
  visitor_id uuid not null,
  token_hash text not null,
  sequence integer not null default -1,
  name text check (char_length(name) between 1 and 24),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  visible boolean not null default true,
  entered_world boolean not null default false,
  areas text[] not null default '{}',
  device text not null check (device in ('mobile', 'tablet', 'desktop')),
  language text not null default '',
  timezone text not null default '',
  referrer_host text not null default ''
);
create index visits_started_at_idx on analytics_private.visits (started_at desc);
create index visits_visitor_id_idx on analytics_private.visits (visitor_id);
create index visits_last_seen_at_idx on analytics_private.visits (last_seen_at desc);
create table analytics_private.admin_access (
  id boolean primary key default true check (id),
  password_hash text not null
);
create table analytics_private.rate_limits (
  bucket text primary key,
  count integer not null default 1,
  expires_at timestamptz not null
);
create index rate_limits_expiry_idx on analytics_private.rate_limits(expires_at);
alter table analytics_private.visits enable row level security;
alter table analytics_private.admin_access enable row level security;
alter table analytics_private.rate_limits enable row level security;
revoke all on all tables in schema analytics_private from public, anon, authenticated;
