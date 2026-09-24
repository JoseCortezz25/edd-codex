import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec: sdd/client-brand-management/spec, capability client-brand-registry,
// requirement "Client delete guard (RESTRICT, no cascade)" —
// "Client delete blocked" / "Client delete allowed" scenarios.
// Design: sdd/client-brand-management/design, Deliverable 4 "Delete guards".

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (
    onFulfilled: (value: typeof result) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

const { getSupabaseClient } = vi.hoisted(() => ({ getSupabaseClient: vi.fn() }));

vi.mock("#lib/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#lib/supabase")>();
  return { ...actual, getSupabaseClient };
});

describe("manage_client delete guard", () => {
  beforeEach(() => {
    getSupabaseClient.mockReset();
  });

  it("blocks delete while 1+ brand rows exist, with the exact refusal shape", async () => {
    const brandsChain = makeChain({
      data: [{ id: "b1", name: "Hit" }, { id: "b2", name: "Colombiana" }],
      error: null,
    });
    const clientChain = makeChain({ data: { id: CLIENT_ID, name: "Postobón" }, error: null });
    const from = vi.fn((table: string) => (table === "brands" ? brandsChain : clientChain));
    getSupabaseClient.mockReturnValue({ from });

    const { default: manageClient } = await import("../../agent/tools/manage_client");
    const result = (await manageClient.execute(
      { action: "delete", client_id: CLIENT_ID },
      {} as never,
    )) as { ok: boolean; reason?: string; message?: string };

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("has_brands");
    expect(result.message).toMatch(/Hit/);
    expect(result.message).toMatch(/Colombiana/);
    expect(result.message).toMatch(/2/);
  });

  it("allows delete at zero brands", async () => {
    const brandsChain = makeChain({ data: [], error: null });
    const clientChain = makeChain({ data: { id: CLIENT_ID, name: "Postobón" }, error: null });
    const deleteChain = makeChain({ data: null, error: null });
    const from = vi.fn((table: string) => {
      if (table === "brands") return brandsChain;
      return { ...clientChain, delete: vi.fn(() => deleteChain) };
    });
    getSupabaseClient.mockReturnValue({ from });

    const { default: manageClient } = await import("../../agent/tools/manage_client");
    const result = (await manageClient.execute(
      { action: "delete", client_id: CLIENT_ID },
      {} as never,
    )) as { ok: boolean };

    expect(result.ok).toBe(true);
  });
});
