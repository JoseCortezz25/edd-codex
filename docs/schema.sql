-- edd · full database schema (target state after migrations 0002 -> 0006)
-- Replay script for a FRESH Supabase project: the migrations below, unmodified and in order.
-- 0001_render_cache.sql is omitted on purpose: 0005 drops that table.
-- 0005 and 0006 come from PR #7 (branch feat/access-model-and-messages) and are not applied yet.
-- 0004 creates INSERT/UPDATE policies on eve_sessions and session_events that 0006 then drops; that is intentional.

-- ==================== 0002_client_brand_management.sql ====================
-- 0002_client_brand_management.sql
-- Client/brand registry + per-brand content rows.
-- Manual apply (same convention as 0001_render_cache.sql): Supabase SQL editor or `supabase db push`.
-- No ON DELETE CASCADE anywhere, deliberately: deletion is bottom-up and explicit
-- (content -> brand -> client). See proposal D5.

create table if not exists clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists clients_name_key on clients (lower(name));

create table if not exists brands (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients (id) on delete restrict,
  name       text not null,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists brands_client_name_key on brands (client_id, lower(name));
create index if not exists brands_client_id_idx on brands (client_id);

create table if not exists foundations (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands (id) on delete restrict,
  name       text not null,
  content    text not null default '',
  status     text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists foundations_brand_name_key on foundations (brand_id, lower(name));
create index if not exists foundations_brand_id_idx on foundations (brand_id);

create table if not exists frameworks (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands (id) on delete restrict,
  name       text not null,
  content    text not null default '',
  status     text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists frameworks_brand_name_key on frameworks (brand_id, lower(name));
create index if not exists frameworks_brand_id_idx on frameworks (brand_id);

create table if not exists library_assets (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands (id) on delete restrict,
  type         text not null check (type in ('logos','images','videos','icons','sounds','fonts','inbox')),
  name         text not null,            -- filename, no directory separators
  storage_path text not null unique,     -- <brand_id>/library/<type>/<name> | <brand_id>/inbox/<name>
  mime_type    text,
  byte_size    bigint,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists library_assets_brand_type_name_key
  on library_assets (brand_id, type, lower(name));
create index if not exists library_assets_brand_id_idx on library_assets (brand_id);

-- Service role bypasses RLS; this denies anon/authenticated PostgREST access by default.
alter table clients        enable row level security;
alter table brands         enable row level security;
alter table foundations    enable row level security;
alter table frameworks     enable row level security;
alter table library_assets enable row level security;

-- ==================== 0003_conversations.sql ====================
-- 0003_conversations.sql
-- Conversation traceability on top of eve sessions.
-- eve persists durable session history; the app persists the session cursor
-- (eve sessionId + streamIndex), the event log used for resume (initialEvents),
-- and queryable projections (steps/usage, tool invocations, HITL input requests).
-- One conversation chains 1..N eve sessions: eve sessions expire (default 30 days)
-- and the next message then starts a fresh session inside the same conversation.
-- Same convention as 0002: no ON DELETE CASCADE, deletion is bottom-up and explicit.

create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete restrict,
  brand_id        uuid references brands (id) on delete restrict, -- null only for client/brand setup chats
  title           text,
  status          text not null default 'active' check (status in ('active', 'archived')),
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists conversations_user_brand_recent_idx
  on conversations (user_id, brand_id, last_message_at desc);
create index if not exists conversations_brand_id_idx on conversations (brand_id);

create table if not exists eve_sessions (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references conversations (id) on delete restrict,
  parent_session_id uuid references eve_sessions (id) on delete restrict, -- subagent: parent of childSessionId
  eve_session_id    text not null unique,                                 -- eve sessionId
  stream_index      integer not null default 0,                           -- resume cursor (streamIndex)
  status            text not null default 'active'
                    check (status in ('active', 'completed', 'failed', 'expired')),
  started_at        timestamptz not null default now(),
  ended_at          timestamptz
);
create index if not exists eve_sessions_conversation_idx on eve_sessions (conversation_id, started_at desc);
create index if not exists eve_sessions_parent_idx on eve_sessions (parent_session_id);

create table if not exists session_events (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references eve_sessions (id) on delete restrict,
  event_id     text not null unique,  -- eve meta.id; dedupes overlapping replays
  stream_index integer not null,
  type         text not null,         -- message.received, action.result, step.completed, ...
  payload      jsonb not null,
  created_at   timestamptz not null default now()
);
create index if not exists session_events_session_stream_idx on session_events (session_id, stream_index);
create index if not exists session_events_type_idx on session_events (type);

create table if not exists session_steps (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references eve_sessions (id) on delete restrict,
  model         text,
  input_tokens  integer,
  output_tokens integer,
  status        text not null check (status in ('completed', 'failed')), -- step.completed | step.failed
  created_at    timestamptz not null default now()
);
create index if not exists session_steps_session_idx on session_steps (session_id);

create table if not exists tool_invocations (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references eve_sessions (id) on delete restrict,
  tool_name   text not null,  -- manage_brand, render_piece, ...
  input       jsonb not null,
  output      jsonb,
  status      text not null default 'pending' check (status in ('pending', 'success', 'error')),
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists tool_invocations_session_idx on tool_invocations (session_id);
create index if not exists tool_invocations_tool_name_idx on tool_invocations (tool_name);

create table if not exists input_requests (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references eve_sessions (id) on delete restrict,
  tool_invocation_id uuid references tool_invocations (id) on delete restrict,
  request_id         text not null unique, -- eve requestId (input.requested / input.resolved)
  kind               text not null check (kind in ('approval', 'question')),
  options            jsonb,
  answer             text,                 -- optionId or freeform text
  resolved_by        uuid references auth.users (id) on delete restrict,
  requested_at       timestamptz not null default now(),
  resolved_at        timestamptz
);
create index if not exists input_requests_session_idx on input_requests (session_id);
create index if not exists input_requests_tool_invocation_idx on input_requests (tool_invocation_id);
create index if not exists input_requests_resolved_by_idx on input_requests (resolved_by);

alter table library_assets
  add column if not exists uploaded_in_session_id uuid references eve_sessions (id) on delete restrict;
create index if not exists library_assets_uploaded_in_session_idx on library_assets (uploaded_in_session_id);

alter table conversations    enable row level security;
alter table eve_sessions     enable row level security;
alter table session_events   enable row level security;
alter table session_steps    enable row level security;
alter table tool_invocations enable row level security;
alter table input_requests   enable row level security;

-- ==================== 0004_conversation_rls.sql ====================
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

-- ==================== 0005_access_and_messages.sql ====================
-- 0005_access_and_messages.sql
-- 1. Access model: only users associated with a client may access it and its brands.
--    A user is invited either to a whole client (all its brands) via client_members,
--    or to a single brand via brand_members. Membership rows are written server-only
--    (secret key); `authenticated` can only read its own rows.
-- 2. Cross-tenant fix: conversations insert/update now also require that the referenced
--    brand is accessible to the user (brand_id is null or has_brand_access(brand_id)).
-- 3. messages: flattened user/assistant chat messages projected from session_events,
--    readable through a conversation the user owns; writes are server-only.
-- 4. render_cache is dropped (the render_piece tool no longer caches).
-- NOTE: the existing INSERT/UPDATE policies on eve_sessions and session_events (0004) are
-- deliberately NOT changed here because the web app still writes those tables directly.
-- Revoking them is a later migration (0006).
-- Same convention as 0002-0004: no ON DELETE CASCADE, an index on every FK, RLS enabled on
-- every table, `(select auth.uid())` evaluated once per statement, paired rollback in .down.sql.

-- membership ------------------------------------------------------------------

create table if not exists client_members (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients (id) on delete restrict,
  user_id    uuid not null references auth.users (id) on delete restrict,
  role       text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);
create index if not exists client_members_client_id_idx on client_members (client_id);
create index if not exists client_members_user_id_idx on client_members (user_id);

create table if not exists brand_members (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands (id) on delete restrict,
  user_id    uuid not null references auth.users (id) on delete restrict,
  role       text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (brand_id, user_id)
);
create index if not exists brand_members_brand_id_idx on brand_members (brand_id);
create index if not exists brand_members_user_id_idx on brand_members (user_id);

alter table client_members enable row level security;
alter table brand_members  enable row level security;

create policy client_members_select_own on client_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy brand_members_select_own on brand_members
  for select to authenticated
  using (user_id = (select auth.uid()));

-- access helpers --------------------------------------------------------------
-- security definer so the membership lookup is not itself filtered by RLS;
-- search_path is pinned and every name is schema-qualified.

create or replace function public.has_client_access(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.client_members cm
    where cm.client_id = p_client_id
      and cm.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_brand_access(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.brand_members bm
      where bm.brand_id = p_brand_id
        and bm.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.brands b
      join public.client_members cm on cm.client_id = b.client_id
      where b.id = p_brand_id
        and cm.user_id = (select auth.uid())
    );
$$;

revoke execute on function public.has_client_access(uuid) from public, anon;
revoke execute on function public.has_brand_access(uuid) from public, anon;
grant execute on function public.has_client_access(uuid) to authenticated;
grant execute on function public.has_brand_access(uuid) to authenticated;

-- read access to the registry (writes stay server-only) ------------------------

create policy clients_select_member on clients
  for select to authenticated
  using (public.has_client_access(id));

create policy brands_select_member on brands
  for select to authenticated
  using (public.has_brand_access(id));

create policy foundations_select_member on foundations
  for select to authenticated
  using (public.has_brand_access(brand_id));

create policy frameworks_select_member on frameworks
  for select to authenticated
  using (public.has_brand_access(brand_id));

create policy library_assets_select_member on library_assets
  for select to authenticated
  using (public.has_brand_access(brand_id));

-- conversations: close the cross-tenant hole -----------------------------------

drop policy if exists conversations_insert_own on conversations;
drop policy if exists conversations_update_own on conversations;

create policy conversations_insert_own on conversations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (brand_id is null or public.has_brand_access(brand_id))
  );

create policy conversations_update_own on conversations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (brand_id is null or public.has_brand_access(brand_id))
  );

-- messages --------------------------------------------------------------------

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete restrict,
  session_id      uuid not null references eve_sessions (id) on delete restrict,
  event_id        text not null unique,
  role            text not null check (role in ('user', 'assistant')),
  content         jsonb not null,
  stream_index    integer not null,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx on messages (conversation_id, created_at);
create index if not exists messages_session_idx on messages (session_id);

comment on table messages is
  'Chat messages projected from session_events (server-only writes). Per the eve docs: role user comes from message.received events (data.message = flattened text, data.parts = structured text/file parts); role assistant comes from message.completed events (data.message = finalized text block or null, data.finishReason). Events with data.kind = execution.background_task are runtime-authored, not user input.';
comment on column messages.event_id is
  'Source session_events.event_id (eve meta.id); unique, so re-projecting the same event is a no-op.';
comment on column messages.content is
  'Message parts (jsonb). User rows: derived from message.received data.parts / data.message. Assistant rows: derived from message.completed data.message.';

alter table messages enable row level security;

create policy messages_select_own on messages
  for select to authenticated
  using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

-- render_cache ----------------------------------------------------------------

drop table if exists public.render_cache;

-- ==================== 0006_server_only_session_writes.sql ====================
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

