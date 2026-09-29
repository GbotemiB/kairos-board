-- Adds status_rank so the board can sort open, then upcoming, then closed in the
-- database (needed for consistent pagination). Enum order (OPEN, CLOSED, UPCOMING)
-- is not the display order. Columns are appended; CREATE OR REPLACE keeps grants.
create or replace view public.programs_public
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
  s.status,
  case s.status when 'OPEN' then 0 when 'UPCOMING' then 1 else 2 end as status_rank
from public.programs p
cross join lateral (
  select coalesce(
    p.status_override,
    case
      when p.opens_at > current_date then 'UPCOMING'::public.program_status
      when p.deadline < current_date then 'CLOSED'::public.program_status
      else 'OPEN'::public.program_status
    end
  ) as status
) s
where not p.is_hidden;
