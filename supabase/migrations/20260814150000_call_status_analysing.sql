-- Intermediate status while AI grades a finished call.
-- Flow: queued → in_progress → analysing → completed | awaiting_review

alter type public.call_status add value if not exists 'analysing';
