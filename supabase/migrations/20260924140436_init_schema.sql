-- Kairos initial schema: enums, tables, derived-status view, RLS and grants.
-- See PROJECT_PLAN.md section 3B.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.program_type as enum ('INTERNSHIP', 'FELLOWSHIP', 'PROGRAM', 'OTHER');
create type public.program_status as enum ('OPEN', 'CLOSED', 'UPCOMING');
create type public.deadline_type as enum ('FIXED', 'ROLLING', 'UNKNOWN');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- programs
-- ---------------------------------------------------------------------------
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nullable so community submissions survive account deletion.
  submitter_id uuid default auth.uid() references auth.users (id) on delete set null,
  url text not null check (url ~* '^https?://' and char_length(url) <= 2048),
  url_normalized text not null unique check (char_length(url_normalized) <= 2048),
  title text not null check (char_length(title) between 1 and 300),
  organization text check (char_length(organization) <= 200),
  type public.program_type not null,
  opens_at date,
  deadline date,
  deadline_type public.deadline_type not null default 'UNKNOWN',
  eligibility text[] not null default '{}' check (cardinality(eligibility) <= 30),
  location text check (char_length(location) <= 200),
  field text check (char_length(field) <= 200),
  funding text check (char_length(funding) <= 500),
  status_override public.program_status,
  is_hidden boolean not null default false,
  constraint programs_opens_before_deadline
    check (opens_at is null or deadline is null or opens_at <= deadline)
);

create index programs_deadline_idx on public.programs (deadline);
create index programs_created_at_idx on public.programs (created_at desc);
create index programs_submitter_id_idx on public.programs (submitter_id);

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

alter table public.programs enable row level security;

-- Public can read visible rows; owners can also read their own hidden rows.
create policy "programs are readable when visible or owned"
  on public.programs for select
  to anon, authenticated
  using (not is_hidden or submitter_id = (select auth.uid()));

create policy "users can insert their own programs"
  on public.programs for insert
  to authenticated
  with check (submitter_id = (select auth.uid()));

create policy "users can update their own programs"
  on public.programs for update
  to authenticated
  using (submitter_id = (select auth.uid()))
  with check (submitter_id = (select auth.uid()));

create policy "users can delete their own programs"
  on public.programs for delete
  to authenticated
  using (submitter_id = (select auth.uid()));

-- Column-level grants: clients can never set id, timestamps, submitter_id or is_hidden.
-- is_hidden is moderation-only (service role / dashboard).
revoke all on table public.programs from anon, authenticated;
grant select on table public.programs to anon, authenticated;
grant insert (
  url, url_normalized, title, organization, type, opens_at, deadline, deadline_type,
  eligibility, location, field, funding, status_override
) on table public.programs to authenticated;
grant update (
  url, url_normalized, title, organization, type, opens_at, deadline, deadline_type,
  eligibility, location, field, funding, status_override
) on table public.programs to authenticated;
grant delete on table public.programs to authenticated;

-- ---------------------------------------------------------------------------
-- programs_public: the board. Hidden rows excluded, status derived at read time.
-- security_invoker so the caller's RLS applies.
-- ---------------------------------------------------------------------------
create view public.programs_public
with (security_invoker = true)
as
select
  p.id,
  p.created_at,
  p.updated_at,
  p.submitter_id,
  p.url,
  p.title,
  p.organization,
  p.type,
  p.opens_at,
  p.deadline,
  p.deadline_type,
  p.eligibility,
  p.location,
  p.field,
  p.funding,
  p.status_override,
  coalesce(
    p.status_override,
    case
      when p.opens_at > current_date then 'UPCOMING'::public.program_status
      when p.deadline < current_date then 'CLOSED'::public.program_status
      else 'OPEN'::public.program_status
    end
  ) as status
from public.programs p
where not p.is_hidden;

revoke all on table public.programs_public from anon, authenticated;
grant select on table public.programs_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- reports: users flag bad entries; only maintainers (service role) read them.
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  program_id uuid not null references public.programs (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 1000),
  constraint reports_one_per_user unique (program_id, reporter_id)
);

create index reports_program_id_idx on public.reports (program_id);

alter table public.reports enable row level security;

create policy "users can file reports as themselves"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

revoke all on table public.reports from anon, authenticated;
grant insert (program_id, reason) on table public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- extraction_logs: rate limiting and debugging for /api/extract.
-- ---------------------------------------------------------------------------
create table public.extraction_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url_normalized text not null check (char_length(url_normalized) <= 2048),
  outcome text not null check (
    outcome in (
      'SUCCESS', 'INVALID_URL', 'BLOCKED_HOST', 'DUPLICATE', 'RATE_LIMITED',
      'FETCH_FAILED', 'UNSUPPORTED_CONTENT', 'THIN_CONTENT', 'AI_FAILED'
    )
  )
);

create index extraction_logs_user_created_idx on public.extraction_logs (user_id, created_at desc);

alter table public.extraction_logs enable row level security;

create policy "users can read their own extraction logs"
  on public.extraction_logs for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users can insert their own extraction logs"
  on public.extraction_logs for insert
  to authenticated
  with check (user_id = (select auth.uid()));

revoke all on table public.extraction_logs from anon, authenticated;
grant select on table public.extraction_logs to authenticated;
grant insert (url_normalized, outcome) on table public.extraction_logs to authenticated;
