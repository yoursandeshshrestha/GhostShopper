-- Terminal outcomes that should not be AI-graded.
alter type public.call_status add value if not exists 'voicemail';
alter type public.call_status add value if not exists 'line_busy';
alter type public.call_status add value if not exists 'short_call';
