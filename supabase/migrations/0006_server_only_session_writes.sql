-- 0006_server_only_session_writes.sql
-- Session history becomes append-only from the client's point of view: `authenticated`
-- keeps SELECT on eve_sessions and session_events, but can no longer INSERT or UPDATE them.
-- Writes go through the server with the secret key (service role bypasses RLS), after the
-- server action has verified the caller owns the conversation.
-- Without this a user could rewrite the `payload` of their own event log, which defeats
-- the point of traceability.
-- APPLY ONLY AFTER the web app (codex-agent-page) writes these tables server-side;
-- applying it earlier breaks chat persistence.
-- Same convention as 0002-0005: paired rollback in .down.sql.

drop policy if exists eve_sessions_insert_own on eve_sessions;
drop policy if exists eve_sessions_update_own on eve_sessions;
drop policy if exists session_events_insert_own on session_events;
drop policy if exists session_events_update_own on session_events;
