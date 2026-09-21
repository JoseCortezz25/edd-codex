import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec: sdd/client-brand-management/spec, capability client-brand-registry,
// requirement "Brand delete guard (RESTRICT, no cascade)" —
// "Brand delete blocked" / "Brand delete allowed after manual cleanup" scenarios.
// Design: sdd/client-brand-management/design, Deliverable 4 "Delete guards".

const BRAND_ID = "22222222-2222-4222-8222-222222222222";

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

describe("manage_brand delete guard", () => {
  beforeEach(() => {
    getSupabaseClient.mockReset();
  });

  it("blocks delete while foundations/frameworks/library_assets rows exist for that brand", async () => {
    const brandChain = makeChain({ data: { id: BRAND_ID, name: "Hit" }, error: null });
    const foundationsChain = makeChain({ data: [{ id: "f1" }], error: null });
    const frameworksChain = makeChain({ data: [{ id: "k1" }, { id: "k2" }], error: null });
    const assetsChain = makeChain({ data: [], error: null });
    const from = vi.fn((table: string) => {
      if (table === "foundations") return foundationsChain;
      if (table === "frameworks") return frameworksChain;
      if (table === "library_assets") return assetsChain;
      return brandChain;
    });
    getSupabaseClient.mockReturnValue({ from });

    const { default: manageBrand } = await import("../../agent/tools/manage_brand");
    const result = (await manageBrand.execute(
      { action: "delete", brand_id: BRAND_ID },
      {} as never,
    )) as { ok: boolean; reason?: string; message?: string };

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("has_content");
    expect(result.message).toMatch(/1/);
    expect(result.message).toMatch(/2/);
    expect(result.message).toMatch(/0/);
  });

  it("allows delete after foundations/frameworks/library_assets rows are all individually removed", async () => {
    const brandChain = makeChain({ data: { id: BRAND_ID, name: "Hit" }, error: null });
    const emptyChain = makeChain({ data: [], error: null });
    const deleteChain = makeChain({ data: null, error: null });
    const from = vi.fn((table: string) => {
      if (table === "foundations" || table === "frameworks" || table === "library_assets") {
        return emptyChain;
      }
      return { ...brandChain, delete: vi.fn(() => deleteChain) };
    });
    getSupabaseClient.mockReturnValue({ from });

    const { default: manageBrand } = await import("../../agent/tools/manage_brand");
    const result = (await manageBrand.execute(
      { action: "delete", brand_id: BRAND_ID },
      {} as never,
    )) as { ok: boolean };

    expect(result.ok).toBe(true);
  });
});
