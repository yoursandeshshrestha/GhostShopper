-- Allow operators to hang up a live call from GhostShopper.
alter type public.call_status add value if not exists 'cancelled';
