-- CIOMS private career records (D4).
-- One row per record; the full record is a versioned JSON document so the
-- browser and the backend share one schema (career-store.js SCHEMA = 3).
-- Row-level security: a signed-in user can only ever see or change rows
-- where user_id = auth.uid(). The anon role has no access.

create table if not exists public.career_records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 80),
  kind       text        not null check (kind in ('opportunity', 'devplan')),
  schema     smallint    not null default 3,
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint career_records_size check (pg_column_size(data) < 512000)
);

create index if not exists career_records_user_updated on public.career_records (user_id, updated_at desc);

alter table public.career_records enable row level security;
alter table public.career_records force row level security;

revoke all on public.career_records from anon;
grant select, insert, update, delete on public.career_records to authenticated;

drop policy if exists "own rows: select" on public.career_records;
drop policy if exists "own rows: insert" on public.career_records;
drop policy if exists "own rows: update" on public.career_records;
drop policy if exists "own rows: delete" on public.career_records;

create policy "own rows: select" on public.career_records
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows: insert" on public.career_records
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows: update" on public.career_records
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows: delete" on public.career_records
  for delete to authenticated using (user_id = (select auth.uid()));

-- Audit trail: every change is appended here (who, what, when), so the
-- application history survives edits and deletions.
create table if not exists public.career_record_audit (
  audit_id   bigint generated always as identity primary key,
  user_id    uuid        not null,
  id         text        not null,
  kind       text        not null,
  op         text        not null,
  deleted    boolean     not null,
  changed_at timestamptz not null default now()
);
alter table public.career_record_audit enable row level security;
revoke all on public.career_record_audit from anon;
grant select on public.career_record_audit to authenticated;
drop policy if exists "own audit: select" on public.career_record_audit;
create policy "own audit: select" on public.career_record_audit
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.career_records_audit_fn()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.career_record_audit (user_id, id, kind, op, deleted) values (old.user_id, old.id, old.kind, tg_op, true);
    return old;
  end if;
  insert into public.career_record_audit (user_id, id, kind, op, deleted) values (new.user_id, new.id, new.kind, tg_op, new.deleted);
  return new;
end $$;

drop trigger if exists career_records_audit on public.career_records;
create trigger career_records_audit after insert or update or delete on public.career_records
  for each row execute function public.career_records_audit_fn();
