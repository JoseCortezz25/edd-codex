-- Paired rollback for 0005_access_and_messages.sql.
-- Policies that depend on the access functions are dropped before the functions,
-- and tables are dropped children before parents. Not applied automatically;
-- run manually in the Supabase SQL editor or via `supabase db push` if needed.
-- Note: rows previously in render_cache are not restored (the table is recreated empty).

-- render_cache (exactly as in 0001_render_cache.sql)
create table if not exists public.render_cache (
  hash text primary key,
  url text not null,
  width integer not null,
  height integer not null,
  format text not null,
  created_at timestamptz not null default now()
);

comment on table public.render_cache is
  'Cache of rendered pieces keyed by content hash. Written by agent/tools/render_piece.ts.';

-- messages
drop policy if exists messages_select_own on messages;
drop table if exists messages;

-- conversations: restore the exact 0004 policies
drop policy if exists conversations_update_own on conversations;
drop policy if exists conversations_insert_own on conversations;

create policy conversations_insert_own on conversations
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy conversations_update_own on conversations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- registry read policies
drop policy if exists library_assets_select_member on library_assets;
drop policy if exists frameworks_select_member on frameworks;
drop policy if exists foundations_select_member on foundations;
drop policy if exists brands_select_member on brands;
drop policy if exists clients_select_member on clients;

-- access helpers
drop function if exists public.has_brand_access(uuid);
drop function if exists public.has_client_access(uuid);

-- membership
drop policy if exists brand_members_select_own on brand_members;
drop policy if exists client_members_select_own on client_members;
drop table if exists brand_members;
drop table if exists client_members;
