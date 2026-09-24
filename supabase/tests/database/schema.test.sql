-- Derived status, constraints and triggers. Run with `npm run db:test`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- ---------------------------------------------------------------------------
-- Derived status in programs_public
-- ---------------------------------------------------------------------------
insert into public.programs (url, url_normalized, title, type, opens_at, deadline, deadline_type, status_override) values
  ('https://status.test/open', 'https://status.test/open', 'Open', 'OTHER',
   null, current_date + 5, 'FIXED', null),
  ('https://status.test/closed', 'https://status.test/closed', 'Closed', 'OTHER',
   null, current_date - 1, 'FIXED', null),
  ('https://status.test/upcoming', 'https://status.test/upcoming', 'Upcoming', 'OTHER',
   current_date + 3, current_date + 30, 'FIXED', null),
  ('https://status.test/due-today', 'https://status.test/due-today', 'Due today', 'OTHER',
   null, current_date, 'FIXED', null),
  ('https://status.test/rolling', 'https://status.test/rolling', 'Rolling', 'OTHER',
   null, null, 'ROLLING', null),
  ('https://status.test/override', 'https://status.test/override', 'Override', 'OTHER',
   null, current_date + 30, 'FIXED', 'CLOSED');

select is(
  (select status::text from public.programs_public where url = 'https://status.test/open'),
  'OPEN', 'future deadline is OPEN'
);
select is(
  (select status::text from public.programs_public where url = 'https://status.test/closed'),
  'CLOSED', 'past deadline is CLOSED'
);
select is(
  (select status::text from public.programs_public where url = 'https://status.test/upcoming'),
  'UPCOMING', 'future opens_at is UPCOMING'
);
select is(
  (select status::text from public.programs_public where url = 'https://status.test/due-today'),
  'OPEN', 'deadline today is still OPEN'
);
select is(
  (select status::text from public.programs_public where url = 'https://status.test/rolling'),
  'OPEN', 'rolling deadline with no date is OPEN'
);
select is(
  (select status::text from public.programs_public where url = 'https://status.test/override'),
  'CLOSED', 'status_override wins over derived status'
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.programs (url, url_normalized, title, type)
    values ('ftp://status.test/file', 'ftp://status.test/file', 'FTP', 'OTHER')$$,
  '23514', null,
  'url must be http or https'
);
select throws_ok(
  $$insert into public.programs (url, url_normalized, title, type, opens_at, deadline)
    values ('https://status.test/bad-dates', 'https://status.test/bad-dates', 'Bad dates', 'OTHER',
            current_date + 10, current_date + 5)$$,
  '23514', null,
  'opens_at cannot be after deadline'
);
select throws_ok(
  $$insert into public.programs (url, url_normalized, title, type)
    values ('https://status.test/open?utm_source=x', 'https://status.test/open', 'Dup', 'OTHER')$$,
  '23505', null,
  'url_normalized must be unique'
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
insert into public.programs (url, url_normalized, title, type, created_at, updated_at)
values ('https://status.test/trigger', 'https://status.test/trigger', 'Trigger', 'OTHER',
        '2000-01-01', '2000-01-01');

update public.programs set title = 'Trigger renamed' where url = 'https://status.test/trigger';

select is(
  (select updated_at from public.programs where url = 'https://status.test/trigger'),
  now(),
  'updated_at is refreshed on update'
);

select * from finish();
rollback;
