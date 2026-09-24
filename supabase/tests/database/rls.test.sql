-- Row Level Security and column grant tests. Run with `npm run db:test`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres, bypassing RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@test.local');

insert into public.programs (id, submitter_id, url, url_normalized, title, type, is_hidden) values
  ('a0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
   'https://test.local/alice-visible', 'https://test.local/alice-visible', 'Alice visible', 'INTERNSHIP', false),
  ('a0000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001',
   'https://test.local/alice-hidden', 'https://test.local/alice-hidden', 'Alice hidden', 'INTERNSHIP', true),
  ('b0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002',
   'https://test.local/bob-visible', 'https://test.local/bob-visible', 'Bob visible', 'FELLOWSHIP', false);

-- ---------------------------------------------------------------------------
-- Anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;

select is(
  (select count(*)::int from public.programs where url_normalized like 'https://test.local/%'),
  2,
  'anon sees only visible programs'
);
select is(
  (select count(*)::int from public.programs_public where url like 'https://test.local/%'),
  2,
  'anon board excludes hidden programs'
);
select throws_ok(
  $$insert into public.programs (url, url_normalized, title, type)
    values ('https://test.local/anon', 'https://test.local/anon', 'Anon', 'OTHER')$$,
  '42501', null,
  'anon cannot insert programs'
);
select throws_ok(
  $$delete from public.programs where id = 'b0000000-0000-0000-0000-00000000000b'$$,
  '42501', null,
  'anon cannot delete programs'
);
select throws_ok($$select * from public.reports$$, '42501', null, 'anon cannot read reports');
select throws_ok(
  $$select * from public.extraction_logs$$, '42501', null, 'anon cannot read extraction logs'
);

reset role;

-- ---------------------------------------------------------------------------
-- Alice (authenticated owner)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.programs where url_normalized like 'https://test.local/%'),
  3,
  'owner also sees their own hidden program'
);
select is(
  (select count(*)::int from public.programs_public where url like 'https://test.local/%'),
  2,
  'board excludes hidden programs even for the owner'
);

select lives_ok(
  $$insert into public.programs (url, url_normalized, title, type)
    values ('https://test.local/alice-new', 'https://test.local/alice-new', 'Alice new', 'PROGRAM')$$,
  'user can insert a program'
);
select is(
  (select submitter_id from public.programs where url_normalized = 'https://test.local/alice-new'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'submitter_id defaults to the current user'
);
select throws_ok(
  $$insert into public.programs (submitter_id, url, url_normalized, title, type)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'https://test.local/spoof',
            'https://test.local/spoof', 'Spoof', 'OTHER')$$,
  '42501', null,
  'user cannot set submitter_id on insert'
);
select throws_ok(
  $$insert into public.programs (url, url_normalized, title, type, is_hidden)
    values ('https://test.local/hide', 'https://test.local/hide', 'Hide', 'OTHER', true)$$,
  '42501', null,
  'user cannot set is_hidden on insert'
);

select lives_ok(
  $$update public.programs set title = 'Alice renamed'
    where id = 'a0000000-0000-0000-0000-00000000000a'$$,
  'owner can update their own program'
);
select is(
  (select title from public.programs where id = 'a0000000-0000-0000-0000-00000000000a'),
  'Alice renamed',
  'owner update is applied'
);
select throws_ok(
  $$update public.programs set is_hidden = false
    where id = 'a0000000-0000-0000-0000-00000000000b'$$,
  '42501', null,
  'owner cannot unhide a moderated program'
);
select throws_ok(
  $$update public.programs set submitter_id = 'bbbbbbbb-0000-0000-0000-000000000002'
    where id = 'a0000000-0000-0000-0000-00000000000a'$$,
  '42501', null,
  'owner cannot transfer ownership'
);

-- RLS silently filters these to zero rows; verified as postgres below.
update public.programs set title = 'Hijacked' where id = 'b0000000-0000-0000-0000-00000000000b';
delete from public.programs where id = 'b0000000-0000-0000-0000-00000000000b';

select lives_ok(
  $$delete from public.programs where url_normalized = 'https://test.local/alice-new'$$,
  'owner can delete their own program'
);
select is(
  (select count(*)::int from public.programs where url_normalized = 'https://test.local/alice-new'),
  0,
  'owner delete is applied'
);

-- Reports
select lives_ok(
  $$insert into public.reports (program_id, reason)
    values ('b0000000-0000-0000-0000-00000000000b', 'Broken link')$$,
  'user can report a program'
);
select throws_ok(
  $$insert into public.reports (program_id, reason)
    values ('b0000000-0000-0000-0000-00000000000b', 'Broken link again')$$,
  '23505', null,
  'user cannot report the same program twice'
);
select throws_ok(
  $$insert into public.reports (program_id, reporter_id, reason)
    values ('a0000000-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000002', 'Spoof')$$,
  '42501', null,
  'user cannot file a report as someone else'
);
select throws_ok($$select * from public.reports$$, '42501', null, 'user cannot read reports');

-- Extraction logs
select lives_ok(
  $$insert into public.extraction_logs (url_normalized, outcome)
    values ('https://test.local/extract', 'SUCCESS')$$,
  'user can write an extraction log'
);
select is(
  (select count(*)::int from public.extraction_logs where url_normalized like 'https://test.local/%'),
  1,
  'user can read their own extraction logs'
);

reset role;

-- ---------------------------------------------------------------------------
-- Verify Alice's writes to Bob's program were filtered out
-- ---------------------------------------------------------------------------
select is(
  (select title from public.programs where id = 'b0000000-0000-0000-0000-00000000000b'),
  'Bob visible',
  'user cannot update another user''s program'
);
select is(
  (select count(*)::int from public.programs where id = 'b0000000-0000-0000-0000-00000000000b'),
  1,
  'user cannot delete another user''s program'
);

-- ---------------------------------------------------------------------------
-- Bob (another authenticated user)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.extraction_logs where url_normalized like 'https://test.local/%'),
  0,
  'users cannot read other users'' extraction logs'
);
select is(
  (select count(*)::int from public.programs where url_normalized like 'https://test.local/%'),
  2,
  'users cannot see other users'' hidden programs'
);

reset role;

select * from finish();
rollback;
