import { defineTool } from "eve/tools";
import { z } from "zod";
import { parseAction } from "#lib/tool-actions";
import {
  BRANDS_TABLE,
  FOUNDATIONS_TABLE,
  FRAMEWORKS_TABLE,
  LIBRARY_ASSETS_TABLE,
  getSupabaseClient,
} from "#lib/supabase";

/**
 * CRUD for `brands` — each brand belongs to exactly one client and owns its
 * foundations, frameworks and library assets (see
 * sdd/client-brand-management/spec, capability client-brand-registry).
 *
 * Flat `z.object` + `action` enum, not a root `z.discriminatedUnion` — same
 * reason as manage_client (design Decision 1).
 */

const ACTIONS = {
  create: z.object({
    client_id: z.uuid(),
    name: z.string().min(1).max(120),
    notes: z.string().max(2000).optional(),
  }),
  list: z.object({ client_id: z.uuid().optional() }),
  get: z.object({ brand_id: z.uuid() }),
  update: z
    .object({
      brand_id: z.uuid(),
      name: z.string().min(1).max(120).optional(),
      notes: z.string().max(2000).optional(),
    })
    .refine(
      (v) => v.name !== undefined || v.notes !== undefined,
      "update needs at least one of name or notes",
    ),
  delete: z.object({ brand_id: z.uuid() }),
} satisfies Record<string, z.ZodType>;

const BRAND_COLUMNS = "id,client_id,name,notes,created_at,updated_at";

interface BrandRow {
  id: string;
  client_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default defineTool({
  description:
    "Manage brands (each belongs to one client and owns its foundations, frameworks and " +
    "library assets). action=create needs client_id and name; list takes an optional " +
    "client_id filter; get/delete need brand_id; update needs brand_id plus name and/or notes.",
  inputSchema: z.object({
    action: z.enum(["create", "list", "get", "update", "delete"]),
    client_id: z.uuid().optional(),
    brand_id: z.uuid().optional(),
    name: z.string().min(1).max(120).optional(),
    notes: z.string().max(2000).optional(),
  }),
  label: { start: (i) => `${i.action} brand` },
  async execute(raw) {
    const input = parseAction(ACTIONS, raw as { action: string } & Record<string, unknown>);
    const db = getSupabaseClient();

    switch (input.action) {
      case "create": {
        const { data, error } = await db
          .from(BRANDS_TABLE)
          .insert({ client_id: input.client_id, name: input.name, notes: input.notes ?? null })
          .select(BRAND_COLUMNS)
          .single<BrandRow>();
        if (error) throw new Error(`Failed to create brand "${input.name}": ${error.message}`);
        return { ok: true as const, brand: data };
      }

      case "list": {
        let query = db.from(BRANDS_TABLE).select(BRAND_COLUMNS);
        if (input.client_id !== undefined) query = query.eq("client_id", input.client_id);
        const { data, error } = await query.order("name");
        if (error) throw new Error(`Failed to list brands: ${error.message}`);
        return { ok: true as const, brands: (data ?? []) as BrandRow[] };
      }

      case "get": {
        const { data, error } = await db
          .from(BRANDS_TABLE)
          .select(BRAND_COLUMNS)
          .eq("id", input.brand_id)
          .single<BrandRow>();
        if (error) throw new Error(`Brand "${input.brand_id}" not found: ${error.message}`);
        return { ok: true as const, brand: data };
      }

      case "update": {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (input.name !== undefined) patch.name = input.name;
        if (input.notes !== undefined) patch.notes = input.notes;
        const { data, error } = await db
          .from(BRANDS_TABLE)
          .update(patch)
          .eq("id", input.brand_id)
          .select(BRAND_COLUMNS)
          .single<BrandRow>();
        if (error) throw new Error(`Failed to update brand "${input.brand_id}": ${error.message}`);
        return { ok: true as const, brand: data };
      }

      case "delete": {
        // Preflight: FK RESTRICT on each content table is the real enforcement;
        // these queries only produce the plain-language refusal text.
        const counts = await Promise.all(
          [FOUNDATIONS_TABLE, FRAMEWORKS_TABLE, LIBRARY_ASSETS_TABLE].map(async (table) => {
            const { data, error } = await db.from(table).select("id").eq("brand_id", input.brand_id);
            if (error) {
              throw new Error(`Failed to check ${table} for brand "${input.brand_id}": ${error.message}`);
            }
            return Array.isArray(data) ? data.length : 0;
          }),
        );
        const [foundations, frameworks, assets] = counts;
        if (foundations + frameworks + assets > 0) {
          const brand = await db
            .from(BRANDS_TABLE)
            .select("id,name")
            .eq("id", input.brand_id)
            .single<{ id: string; name: string }>();
          return {
            ok: false as const,
            reason: "has_content" as const,
            message:
              `No puedo borrar ${brand.data?.name ?? input.brand_id} todavía: tiene ${foundations} ` +
              `foundation(s), ${frameworks} framework(s) y ${assets} archivo(s) en la librería. ` +
              `Hay que sacarlos primero.`,
          };
        }

        const { error: deleteError } = await db.from(BRANDS_TABLE).delete().eq("id", input.brand_id);
        if (deleteError) {
          // 23503 = foreign_key_violation: a concurrent content insert raced the
          // preflight, or conversations still reference this brand.
          if ((deleteError as { code?: string }).code === "23503") {
            return {
              ok: false as const,
              reason: "has_content" as const,
              message:
                `No puedo borrar ${input.brand_id} todavía: todavía tiene contenido o conversaciones ` +
                `asociadas. Hay que sacarlos primero.`,
            };
          }
          throw new Error(`Failed to delete brand "${input.brand_id}": ${deleteError.message}`);
        }
        return { ok: true as const };
      }
    }
  },
});
