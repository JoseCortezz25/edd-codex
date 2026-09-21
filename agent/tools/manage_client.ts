import { defineTool } from "eve/tools";
import { z } from "zod";
import { parseAction } from "#lib/tool-actions";
import { BRANDS_TABLE, CLIENTS_TABLE, getSupabaseClient } from "#lib/supabase";

/**
 * CRUD for `clients` — the ownership grouping that owns brands. A client
 * holds no foundations/frameworks/library content of its own (see
 * sdd/client-brand-management/spec, capability client-brand-registry).
 *
 * Flat `z.object` + `action` enum, not a root `z.discriminatedUnion` — see
 * design Decision 1 (a root union reaches the OpenAI provider as a
 * schema-root `anyOf`, which the function-calling contract rejects).
 */

const ACTIONS = {
  create: z.object({
    name: z.string().min(1).max(120),
    notes: z.string().max(2000).optional(),
  }),
  list: z.object({}),
  get: z.object({ client_id: z.uuid() }),
  update: z
    .object({
      client_id: z.uuid(),
      name: z.string().min(1).max(120).optional(),
      notes: z.string().max(2000).optional(),
    })
    .refine(
      (v) => v.name !== undefined || v.notes !== undefined,
      "update needs at least one of name or notes",
    ),
  delete: z.object({ client_id: z.uuid() }),
} satisfies Record<string, z.ZodType>;

interface ClientRow {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default defineTool({
  description:
    "Manage clients (the ownership grouping that owns brands). action=create needs name; " +
    "list needs nothing; get/delete need client_id; update needs client_id plus name and/or " +
    "notes. A client holds no foundations of its own.",
  inputSchema: z.object({
    action: z.enum(["create", "list", "get", "update", "delete"]),
    client_id: z.uuid().optional(),
    name: z.string().min(1).max(120).optional(),
    notes: z.string().max(2000).optional(),
  }),
  label: { start: (i) => `${i.action} client` },
  async execute(raw) {
    const input = parseAction(ACTIONS, raw as { action: string } & Record<string, unknown>);
    const db = getSupabaseClient();

    switch (input.action) {
      case "create": {
        const { data, error } = await db
          .from(CLIENTS_TABLE)
          .insert({ name: input.name, notes: input.notes ?? null })
          .select("id,name,notes,created_at,updated_at")
          .single<ClientRow>();
        if (error) throw new Error(`Failed to create client "${input.name}": ${error.message}`);
        return { ok: true as const, client: data };
      }

      case "list": {
        const { data, error } = await db
          .from(CLIENTS_TABLE)
          .select("id,name,notes,created_at,updated_at")
          .order("name");
        if (error) throw new Error(`Failed to list clients: ${error.message}`);
        return { ok: true as const, clients: (data ?? []) as ClientRow[] };
      }

      case "get": {
        const { data, error } = await db
          .from(CLIENTS_TABLE)
          .select("id,name,notes,created_at,updated_at")
          .eq("id", input.client_id)
          .single<ClientRow>();
        if (error) throw new Error(`Client "${input.client_id}" not found: ${error.message}`);
        return { ok: true as const, client: data };
      }

      case "update": {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (input.name !== undefined) patch.name = input.name;
        if (input.notes !== undefined) patch.notes = input.notes;
        const { data, error } = await db
          .from(CLIENTS_TABLE)
          .update(patch)
          .eq("id", input.client_id)
          .select("id,name,notes,created_at,updated_at")
          .single<ClientRow>();
        if (error) throw new Error(`Failed to update client "${input.client_id}": ${error.message}`);
        return { ok: true as const, client: data };
      }

      case "delete": {
        // Preflight: FK RESTRICT on brands.client_id is the real enforcement;
        // this query only produces the plain-language refusal text.
        const { data: brands, error: brandsError } = await db
          .from(BRANDS_TABLE)
          .select("id,name")
          .eq("client_id", input.client_id);
        if (brandsError) {
          throw new Error(`Failed to check brands for client "${input.client_id}": ${brandsError.message}`);
        }
        if (brands && brands.length > 0) {
          const client = await db
            .from(CLIENTS_TABLE)
            .select("id,name")
            .eq("id", input.client_id)
            .single<{ id: string; name: string }>();
          const names = brands.map((b: { name: string }) => b.name).join(", ");
          return {
            ok: false as const,
            reason: "has_brands" as const,
            message:
              `No puedo borrar ${client.data?.name ?? input.client_id} todavía: tiene ${brands.length} ` +
              `marca(s) asociada(s) (${names}). Hay que sacarlas primero.`,
          };
        }

        const { error: deleteError } = await db.from(CLIENTS_TABLE).delete().eq("id", input.client_id);
        if (deleteError) {
          // 23503 = foreign_key_violation: a concurrent brand insert raced the
          // preflight check above. The FK RESTRICT is the real enforcement;
          // map it to the same refusal shape rather than crash the tool.
          if ((deleteError as { code?: string }).code === "23503") {
            return {
              ok: false as const,
              reason: "has_brands" as const,
              message: `No puedo borrar ${input.client_id} todavía: tiene marca(s) asociada(s). Hay que sacarlas primero.`,
            };
          }
          throw new Error(`Failed to delete client "${input.client_id}": ${deleteError.message}`);
        }
        return { ok: true as const };
      }
    }
  },
});
