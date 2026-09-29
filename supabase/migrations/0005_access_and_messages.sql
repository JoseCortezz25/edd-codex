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
