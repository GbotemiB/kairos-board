-- Gemini quota or overload (HTTP 429/503) is logged separately from other AI failures.
alter table public.extraction_logs drop constraint extraction_logs_outcome_check;

alter table public.extraction_logs add constraint extraction_logs_outcome_check check (
  outcome in (
    'SUCCESS', 'INVALID_URL', 'BLOCKED_HOST', 'DUPLICATE', 'RATE_LIMITED',
    'FETCH_FAILED', 'UNSUPPORTED_CONTENT', 'THIN_CONTENT', 'AI_FAILED', 'AI_BUSY'
  )
);
