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
