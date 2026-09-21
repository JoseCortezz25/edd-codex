import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseAction } from "./tool-actions";

// Spec: sdd/client-brand-management/spec, capability client-brand-registry,
// requirement "manage_client discriminated-union CRUD" (renamed at runtime to
// the flat-object + action-enum shape per design Decision 1) —
// "Unknown action rejected" and "Valid action dispatches correctly".

const ACTIONS = {
  create: z.object({ name: z.string().min(1) }),
  get: z.object({ id: z.uuid() }),
} satisfies Record<string, z.ZodType>;

describe("parseAction", () => {
  it("dispatches a well-formed input for a valid action", () => {
    const result = parseAction(ACTIONS, { action: "create", name: "Postobón" });
    expect(result).toEqual({ action: "create", name: "Postobón" });
  });

  it("rejects an unknown action before any per-action validation runs", () => {
    expect(() => parseAction(ACTIONS, { action: "delete" })).toThrowError(
      /Unknown action "delete"/,
    );
  });

  it("throws an actionable message when the per-action shape is invalid", () => {
    expect(() => parseAction(ACTIONS, { action: "create", name: "" })).toThrowError(
      /Invalid input for action "create"/,
    );
  });

  it("throws an actionable message when a required field for the action is missing", () => {
    expect(() => parseAction(ACTIONS, { action: "get" })).toThrowError(
      /Invalid input for action "get"/,
    );
  });
});
