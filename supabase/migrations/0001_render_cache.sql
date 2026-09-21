-- Render cache for agent/tools/render_piece.ts.
-- Maps a content hash (see computeCacheHash in render_piece.ts) to the URL of
-- an already-rendered and already-uploaded image in Supabase Storage, so the
-- same HTML/width/height/format/scale combination is never re-rendered.
--
-- This file is NOT applied automatically. Run it yourself in the Supabase
-- SQL editor for the connected project, or via `supabase db push` if you use
-- the Supabase CLI.

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
