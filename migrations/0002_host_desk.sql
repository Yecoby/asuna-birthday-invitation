-- Host Desk schema: RSVP inbox + invitation countdown settings.
--
-- These tables hold PRIVATE organiser data. They are reached only through
-- server functions guarded by `requireHost()` (see src/lib/hosts.server.ts):
-- a request must carry a valid Better Auth session AND that session's verified
-- email must be in the authorized-host allowlist. Nothing here is read by the
-- public invitation, and no client ever talks to Postgres directly.
--
-- Deliberately NO `user_id` column on rsvps: replies belong to the event
-- (shared by every authorized host), not to one account — so adding a second
-- host later needs no data migration.
--
-- `id` is supplied by the server (crypto.randomUUID), and `submitted_at` is the
-- server's clock — never a client-supplied id or timestamp.

create table if not exists rsvps (
  id text not null primary key,
  guest_name text not null,
  attendance text not null check (attendance in ('attending', 'not-attending')),
  attendees integer not null default 0,
  contact text not null default '',
  message text not null default '',
  submitted_at timestamptz not null default now()
);

create index if not exists rsvps_submitted_at_idx on rsvps (submitted_at desc);

-- One shared row per setting key (the countdown timer target/enabled flag).
create table if not exists host_settings (
  key text not null primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
