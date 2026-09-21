import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared Supabase client for app-runtime tools (render_piece, get_library_asset).
 *
 * This is a plain SDK client, NOT the Supabase MCP already configured in
 * `.mcp.json` — that MCP only manages bucket configuration (list/get/update),
 * it cannot upload/download files. See research/arquitectura-remota-eve-dev.md
 * §3.2. Tools run in the app runtime with full `process.env`, so credentials
 * never enter the sandbox.
 *
 * Required env vars (see `.env.example`):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase configuration: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "in the environment (see .env.example). These are app-runtime secrets, never " +
        "read from inside the sandbox.",
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}

/** Storage bucket for rendered pieces and library assets, overridable via env. */
export const CODEX_ASSETS_BUCKET = process.env.SUPABASE_ASSETS_BUCKET ?? "codex-assets";

/** Name of the render-cache table (hash -> already-uploaded URL). */
export const RENDER_CACHE_TABLE = "render_cache";

/** ~3 MiB, the point past which eve keeps an image as a file reference instead of inline bytes. */
export const INLINE_FILE_BYTE_LIMIT = 3 * 1024 * 1024;

/** Client/brand registry + per-brand content tables. See supabase/migrations/0002_*.sql. */
export const CLIENTS_TABLE = "clients";
export const BRANDS_TABLE = "brands";
export const FOUNDATIONS_TABLE = "foundations";
export const FRAMEWORKS_TABLE = "frameworks";
export const LIBRARY_ASSETS_TABLE = "library_assets";
