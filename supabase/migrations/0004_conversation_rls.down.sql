-- Paired rollback for 0004_conversation_rls.sql.
-- Drops only the policies; RLS itself stays enabled (0003 owns that).
-- Not applied automatically; run manually in the Supabase SQL editor or via `supabase db push` if needed.

drop policy if exists session_events_update_own on session_events;
drop policy if exists session_events_insert_own on session_events;
drop policy if exists session_events_select_own on session_events;

drop policy if exists eve_sessions_update_own on eve_sessions;
drop policy if exists eve_sessions_insert_own on eve_sessions;
drop policy if exists eve_sessions_select_own on eve_sessions;

drop policy if exists conversations_delete_own on conversations;
drop policy if exists conversations_update_own on conversations;
drop policy if exists conversations_insert_own on conversations;
drop policy if exists conversations_select_own on conversations;
