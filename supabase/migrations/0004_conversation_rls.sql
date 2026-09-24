-- 0004_conversation_rls.sql
-- RLS policies so the web app (cookie session, `authenticated` role, publishable key)
-- can read and write its own conversations directly under RLS.
-- conversations: owned rows only (user_id = auth.uid()).
-- eve_sessions / session_events: reachable only through a conversation the user owns.
-- session_steps, tool_invocations and input_requests keep RLS enabled with no policies
-- (server-only via the secret key for now).
-- `(select auth.uid())` is evaluated once per statement instead of once per row.
-- Same convention as 0002/0003: no ON DELETE CASCADE; paired rollback in .down.sql.

-- conversations ---------------------------------------------------------------

create policy conversations_select_own on conversations
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy conversations_insert_own on conversations
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy conversations_update_own on conversations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy conversations_delete_own on conversations
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- eve_sessions ----------------------------------------------------------------

create policy eve_sessions_select_own on eve_sessions
  for select to authenticated
  using (
    exists (
      select 1 from conversations c
      where c.id = eve_sessions.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy eve_sessions_insert_own on eve_sessions
  for insert to authenticated
  with check (
    exists (
      select 1 from conversations c
      where c.id = eve_sessions.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy eve_sessions_update_own on eve_sessions
  for update to authenticated
  using (
    exists (
      select 1 from conversations c
      where c.id = eve_sessions.conversation_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from conversations c
      where c.id = eve_sessions.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

-- session_events --------------------------------------------------------------

create policy session_events_select_own on session_events
  for select to authenticated
  using (
    exists (
      select 1
      from eve_sessions s
      join conversations c on c.id = s.conversation_id
      where s.id = session_events.session_id
        and c.user_id = (select auth.uid())
    )
  );

create policy session_events_insert_own on session_events
  for insert to authenticated
  with check (
    exists (
      select 1
      from eve_sessions s
      join conversations c on c.id = s.conversation_id
      where s.id = session_events.session_id
        and c.user_id = (select auth.uid())
    )
  );

create policy session_events_update_own on session_events
  for update to authenticated
  using (
    exists (
      select 1
      from eve_sessions s
      join conversations c on c.id = s.conversation_id
      where s.id = session_events.session_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from eve_sessions s
      join conversations c on c.id = s.conversation_id
      where s.id = session_events.session_id
        and c.user_id = (select auth.uid())
    )
  );
