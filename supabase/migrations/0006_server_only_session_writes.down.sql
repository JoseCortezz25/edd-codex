-- Paired rollback for 0006_server_only_session_writes.sql.
-- Restores the exact 0004 INSERT/UPDATE policies on eve_sessions and session_events.
-- Not applied automatically; run manually in the Supabase SQL editor or via `supabase db push`.

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
