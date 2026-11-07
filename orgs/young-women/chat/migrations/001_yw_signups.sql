-- NOT APPLIED. Not the deployment path.
-- The Hub's live write backend is Google Apps Script, not this file.
-- Do not run this file against production.
-- Bay 6 Hub has no production database in this repository. GitHub Pages stores
-- the working Demo Mode copy in the existing localStorage key bay6-yw-chat-v4.
-- This is a prepared Postgres / Supabase sketch of the same rules as signups.js.
-- Status: unapplied. No production rows were created, changed, or deleted.
-- Remaining: create a project, review this file, apply it by hand, then point
-- config.js at that project and verify with a real ward account before calling
-- sign-ups live.

create table if not exists yw_signup_meta (
  id text primary key,
  version integer not null default 0,
  rotation_start_month text,
  rotation_start_class text,
  class_order text[] not null default array['gatherers','messengers','builders'],
  review_status text not null default 'unapplied'
);

create table if not exists yw_signup_types (
  id text primary key,
  name text not null,
  mode text not null check (mode in ('rotation', 'per-class')),
  default_capacity integer not null check (default_capacity between 1 and 12)
);

create table if not exists yw_signup_entries (
  id text primary key,
  type_id text not null references yw_signup_types(id),
  class_id text not null,
  entry_date date not null,
  capacity integer not null check (capacity between 1 and 12),
  cancelled boolean not null default false,
  exception boolean not null default false,
  topic text not null default '',
  unique (type_id, class_id, entry_date)
);

create table if not exists yw_signup_slots (
  id text primary key,
  entry_id text not null references yw_signup_entries(id) on delete cascade,
  user_id text,
  slot_version integer not null default 0
);

alter table yw_signup_entries enable row level security;
alter table yw_signup_slots enable row level security;
alter table yw_signup_meta enable row level security;
alter table yw_signup_types enable row level security;

-- Membership and leader checks belong in the database, not only in the browser.
-- Replace yw_members with the ward table when a backend is provisioned.
-- A youth may read only her class. Leaders read classes they serve.
-- Claims update one open slot and fail closed if that row changed.

create or replace function yw_claim_slot(p_slot_id text, p_expected_version integer)
returns yw_signup_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed yw_signup_slots;
begin
  -- Stub: reject until yw_members, auth.uid(), and class checks are wired.
  -- The real update is a single conditional write so two claims cannot both win:
  --   update yw_signup_slots s
  --      set user_id = auth.uid(), slot_version = slot_version + 1
  --     from yw_signup_entries e
  --    where s.id = p_slot_id
  --      and s.entry_id = e.id
  --      and s.user_id is null
  --      and s.slot_version = p_expected_version
  --      and e.cancelled = false
  --      and e.entry_date >= (timezone('America/Denver', now()))::date
  --      and exists (
  --        select 1 from yw_members m
  --         where m.user_id = auth.uid()
  --           and m.kind = 'youth'
  --           and m.status = 'active'
  --           and m.class_id = e.class_id
  --      )
  --   returning s.* into claimed;
  --   if claimed.id is null then raise exception 'conflict'; end if;
  raise exception 'NOT APPLIED: yw_claim_slot is not wired to a live membership table';
end;
$$;
