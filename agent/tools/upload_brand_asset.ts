import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  ASSET_DESTINATIONS,
  LIBRARY_ASSET_TYPES,
  planBrandAssetUpload,
} from "#lib/brand-asset-path";
import {
  BRANDS_TABLE,
  CODEX_ASSETS_BUCKET,
  LIBRARY_ASSETS_TABLE,
  getSupabaseClient,
} from "#lib/supabase";

/**
 * Saves a file from the sandbox (typically a chat upload staged by eve at
 * /workspace/attachments/<sha16>/<name>) into a brand's asset library:
 * uploads the bytes to the Supabase Storage bucket and registers the
 * `library_assets` row (see supabase/migrations/0002_client_brand_management.sql).
 *
 * Duplicate policy: fail, never overwrite. `storage_path` is unique and the
 * brand/type/lower(name) index too, so an existing asset is reported back with
 * a clear error and the caller picks another name (or deletes the old one).
 * The storage upload also runs with `upsert: false`, so an orphaned object
 * under the same key is never silently replaced.
 */

const ASSET_COLUMNS =
  "id,brand_id,type,name,storage_path,mime_type,byte_size,created_at,updated_at";

interface LibraryAssetRow {
  id: string;
  brand_id: string;
  type: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  byte_size: number | null;
  created_at: string;
  updated_at: string;
}

const inputSchema = z.object({
  brand_id: z
    .uuid()
    .describe("Brand that owns the asset (from manage_brand list/get)."),
  sandbox_path: z
    .string()
    .min(1)
    .describe(
      "Path of the file inside the sandbox, e.g. the attachment path given in the user's " +
        'message ("/workspace/attachments/<hash>/logo.svg"). Relative paths resolve from /workspace.',
    ),
  destination: z
    .enum(ASSET_DESTINATIONS)
    .default("library")
    .describe(
      '"library" files it under its type; "inbox" parks it unclassified.',
    ),
  type: z
    .enum(LIBRARY_ASSET_TYPES)
    .optional()
    .describe(
      'Asset category. Required when destination is "library"; ignored for "inbox".',
    ),
  name: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe(
      "Filename to store it as (no folders). Defaults to the sandbox file's name.",
    ),
});

export default defineTool({
  description:
    "Save a file from the sandbox (e.g. an image the user attached) into a brand's asset " +
    "library in Supabase: uploads it to storage and registers it as a library asset. Only use " +
    "when the user asks to save/upload an asset to a brand. Fails if an asset with the same " +
    "name already exists for that brand and type.",
  inputSchema,
  label: {
    start: ({ destination, type }) =>
      `Upload brand asset to ${destination === "inbox" ? "inbox" : `library/${type ?? "?"}`}`,
  },
  async execute(input, ctx) {
    const plan = planBrandAssetUpload({
      brandId: input.brand_id,
      sandboxPath: input.sandbox_path,
      destination: input.destination,
      type: input.type,
      name: input.name,
    });
    const db = getSupabaseClient();

    const { data: brand, error: brandError } = await db
      .from(BRANDS_TABLE)
      .select("id,name")
      .eq("id", input.brand_id)
      .maybeSingle<{ id: string; name: string }>();
    if (brandError)
      throw new Error(
        `Failed to look up brand "${input.brand_id}": ${brandError.message}`,
      );
    if (!brand)
      throw new Error(
        `Brand "${input.brand_id}" not found. Use manage_brand list to find it.`,
      );

    const { data: existing, error: existingError } = await db
      .from(LIBRARY_ASSETS_TABLE)
      .select("id")
      .eq("storage_path", plan.storagePath)
      .maybeSingle<{ id: string }>();
    if (existingError) {
      throw new Error(
        `Failed to check for an existing asset at "${plan.storagePath}": ${existingError.message}`,
      );
    }
    if (existing) {
      throw new Error(
        `Brand "${brand.name}" already has an asset at "${plan.storagePath}". ` +
          "Choose a different name; existing assets are never overwritten.",
      );
    }

    const sandbox = await ctx.getSandbox();
    const bytes = await sandbox.readBinaryFile({ path: plan.sourcePath });
    if (!bytes)
      throw new Error(`File not found in the sandbox: ${plan.sourcePath}`);
    if (bytes.byteLength === 0)
      throw new Error(`File is empty: ${plan.sourcePath}`);
    const buffer = Buffer.from(bytes);

    const bucket = db.storage.from(CODEX_ASSETS_BUCKET);
    const { error: uploadError } = await bucket.upload(
      plan.storagePath,
      buffer,
      {
        contentType: plan.contentType,
        upsert: false,
      },
    );
    if (uploadError) {
      throw new Error(
        `Failed to upload "${plan.storagePath}" to bucket "${CODEX_ASSETS_BUCKET}": ${uploadError.message}`,
      );
    }

    const { data: row, error: insertError } = await db
      .from(LIBRARY_ASSETS_TABLE)
      .insert({
        brand_id: input.brand_id,
        type: plan.rowType,
        name: plan.name,
        storage_path: plan.storagePath,
        mime_type: plan.contentType,
        byte_size: buffer.byteLength,
      })
      .select(ASSET_COLUMNS)
      .single<LibraryAssetRow>();
    if (insertError || !row) {
      // Roll back the object so storage never holds a file the library does not know about.
      const { error: removeError } = await bucket.remove([plan.storagePath]);
      const rollbackNote = removeError
        ? ` The uploaded object could NOT be removed (${removeError.message}); delete "${plan.storagePath}" manually.`
        : " The uploaded object was removed again.";
      const duplicate =
        (insertError as { code?: string } | null)?.code === "23505";
      const reason = duplicate
        ? `an asset named "${plan.name}" already exists for this brand and type`
        : (insertError?.message ?? "no row returned");
      throw new Error(
        `Failed to register asset "${plan.storagePath}": ${reason}.${rollbackNote}`,
      );
    }

    const { data: publicUrlData } = bucket.getPublicUrl(plan.storagePath);

    return {
      ok: true as const,
      storage_path: plan.storagePath,
      url: publicUrlData.publicUrl,
      asset: row,
    };
  },
});
