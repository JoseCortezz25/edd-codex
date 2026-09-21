-- Paired rollback for 0002_client_brand_management.sql.
-- Drops in FK order (children before parents). Not applied automatically;
-- run manually in the Supabase SQL editor or via `supabase db push` if needed.

drop table if exists library_assets;
drop table if exists frameworks;
drop table if exists foundations;
drop table if exists brands;
drop table if exists clients;
