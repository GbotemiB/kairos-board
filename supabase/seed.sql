-- Local development seed data. Runs on `supabase db reset`.
-- All organizations and URLs are fictional. Dates are relative to today so
-- every derived status (OPEN, CLOSED, UPCOMING) is always represented.

-- Demo user: demo@kairos.local / password123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'demo@kairos.local',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"demo@kairos.local","email_verified":true}',
  'email',
  now(),
  now(),
  now()
);

insert into public.programs (
  submitter_id, url, url_normalized, title, organization, type, opens_at, deadline,
  deadline_type, eligibility, location, field, funding, status_override
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'https://example.org/research-fellowship?utm_source=newsletter',
    'https://example.org/research-fellowship',
    'Graduate Research Fellowship',
    'Example Science Foundation',
    'FELLOWSHIP', null, current_date + 30, 'FIXED',
    array['Enrolled in a master''s program', 'STEM field'],
    'Remote', 'Science', 'Monthly stipend', null
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'https://example.com/careers/data-intern',
    'https://example.com/careers/data-intern',
    'Summer Data Science Internship',
    'Example Analytics Ltd',
    'INTERNSHIP', null, current_date + 12, 'FIXED',
    array['Master''s students', 'Python experience'],
    'Berlin, Germany', 'Data Science', 'Paid', null
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'https://example.net/policy-fellows',
    'https://example.net/policy-fellows',
    'Energy Policy Fellows Program',
    'Example Policy Institute',
    'FELLOWSHIP', null, current_date - 10, 'FIXED',
    array['Master''s or PhD students', 'Interest in energy policy'],
    'Brussels, Belgium', 'Public Policy', 'Stipend + travel', null
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'https://example.edu/summer-school',
    'https://example.edu/summer-school',
    'Climate Modelling Summer School',
    'Example University',
    'PROGRAM', current_date + 20, current_date + 60, 'FIXED',
    array['Graduate students', 'Basic programming'],
    'Lisbon, Portugal', 'Climate Science', 'Tuition waived', null
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'https://example.io/jobs/ml-research-intern',
    'https://example.io/jobs/ml-research-intern',
    'Machine Learning Research Intern',
    'Example AI Lab',
    'INTERNSHIP', null, null, 'ROLLING',
    array['Master''s students in CS or related'],
    'London, UK', 'Machine Learning', 'Paid', null
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'https://example.org/open-source-mentorship',
    'https://example.org/open-source-mentorship',
    'Open Source Mentorship Program',
    'Example Open Source Collective',
    'PROGRAM', null, current_date + 45, 'FIXED',
    array['Students 18+', 'Any field'],
    'Remote', 'Software', 'Stipend', 'CLOSED'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'https://example.com/fellowships/global-health',
    'https://example.com/fellowships/global-health',
    'Global Health Fellowship',
    'Example Health Trust',
    'FELLOWSHIP', null, current_date + 90, 'FIXED',
    array['Master''s in public health or related', 'Two years of experience'],
    'Nairobi, Kenya', 'Public Health', 'Fully funded', null
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'https://example.net/urban-planning-intern',
    'https://example.net/urban-planning-intern',
    'Urban Planning Internship',
    'Example City Council',
    'INTERNSHIP', null, null, 'UNKNOWN',
    array['Master''s in urban planning or geography'],
    'Toronto, Canada', 'Urban Planning', null, null
  );
