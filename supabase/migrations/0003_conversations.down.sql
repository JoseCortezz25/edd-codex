-- Paired rollback for 0003_conversations.sql.
-- Drops in FK order (children before parents). Not applied automatically;
-- run manually in the Supabase SQL editor or via `supabase db push` if needed.

alter table library_assets drop column if exists uploaded_in_session_id;

drop table if exists input_requests;
drop table if exists tool_invocations;
drop table if exists session_steps;
drop table if exists session_events;
drop table if exists eve_sessions;
drop table if exists conversations;
