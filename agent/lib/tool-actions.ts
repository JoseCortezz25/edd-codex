import { z } from "zod";

/**
 * Runtime dispatch for the flat-object + `action` enum tool-input shape
 * (Decision 1, user-approved — see sdd/client-brand-management/design).
 *
 * A root `z.discriminatedUnion` would reach the OpenAI provider as a
 * schema-root `anyOf` with no top-level `"type": "object"`, which the
 * function-calling contract does not accept. Instead every `manage_*` tool's
 * `inputSchema` is a single flat `z.object` where only `action` is required;
 * per-action strictness is enforced here, at runtime, against the `actions`
 * map the tool provides.
 */
export function parseAction<T extends Record<string, z.ZodType>>(
  actions: T,
  input: { action: string } & Record<string, unknown>,
): { [K in keyof T]: { action: K } & z.infer<T[K]> }[keyof T] {
  const schema = actions[input.action as keyof T];
  if (!schema) throw new Error(`Unknown action "${input.action}".`);
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Invalid input for action "${input.action}": ${z.prettifyError(parsed.error)}`,
    );
  }
  return { ...(parsed.data as object), action: input.action } as never;
}
