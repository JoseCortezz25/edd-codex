import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseAuth, supabaseIssuer } from "#lib/supabase-auth";

// Each test uses a unique project URL because eve caches discovery/JWKS per URL.
let projectCounter = 0;
let supabaseUrl = "";
let privateKey: KeyObject;
let publicJwk: Record<string, unknown>;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signToken(claims: Record<string, unknown>, key: KeyObject = privateKey): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: "test-kid", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    dsaEncoding: "ieee-p1363",
    key,
  });
  return `${header}.${payload}.${base64url(signature)}`;
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    aud: "authenticated",
    email: "user@example.com",
    exp: now + 3600,
    iat: now,
    iss: supabaseIssuer(supabaseUrl),
    role: "authenticated",
    session_id: "session-1",
    sub: "11111111-1111-4111-8111-111111111111",
    ...overrides,
  };
}

function request(authorization?: string): Request {
  return new Request("https://agent.test/eve/v1/session", {
    headers: authorization ? { authorization } : {},
    method: "POST",
  });
}

beforeAll(() => {
  const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
  privateKey = pair.privateKey;
  publicJwk = { ...pair.publicKey.export({ format: "jwk" }), alg: "ES256", kid: "test-kid", use: "sig" };
});

beforeEach(() => {
  projectCounter += 1;
  supabaseUrl = `https://project-${projectCounter}.supabase.test`;
  vi.stubEnv("SUPABASE_URL", supabaseUrl);
  const issuer = supabaseIssuer(supabaseUrl);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url === `${issuer}/.well-known/openid-configuration`) {
        return Response.json({ issuer, jwks_uri: `${issuer}/.well-known/jwks.json` });
      }
      if (url === `${issuer}/.well-known/jwks.json`) {
        return Response.json({ keys: [publicJwk] });
      }
      return new Response("not found", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("supabaseAuth", () => {
  it("accepts a valid Supabase access token as a user principal", async () => {
    const result = await supabaseAuth()(request(`Bearer ${signToken(validClaims())}`));

    expect(result).toEqual({
      attributes: { email: "user@example.com" },
      authenticator: "supabase",
      issuer: supabaseIssuer(supabaseUrl),
      principalId: `${supabaseIssuer(supabaseUrl)}:11111111-1111-4111-8111-111111111111`,
      principalType: "user",
      subject: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("skips when there is no bearer token", async () => {
    expect(await supabaseAuth()(request())).toBeNull();
    expect(await supabaseAuth()(request("Basic abc"))).toBeNull();
  });

  it("skips when SUPABASE_URL is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    expect(await supabaseAuth()(request(`Bearer ${signToken(validClaims())}`))).toBeNull();
  });

  it("rejects tokens with the wrong audience, issuer, role or expiry", async () => {
    const auth = supabaseAuth();
    const now = Math.floor(Date.now() / 1000);
    for (const overrides of [
      { aud: "other" },
      { iss: "https://evil.test/auth/v1" },
      { role: "anon" },
      { exp: now - 3600 },
    ]) {
      expect(await auth(request(`Bearer ${signToken(validClaims(overrides))}`))).toBeNull();
    }
  });

  it("rejects tokens signed by another key", async () => {
    const other = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey;
    const token = signToken(validClaims(), other);
    expect(await supabaseAuth()(request(`Bearer ${token}`))).toBeNull();
  });

  it("rejects malformed tokens without throwing", async () => {
    expect(await supabaseAuth()(request("Bearer not-a-jwt"))).toBeNull();
  });

  it("skips when discovery is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    expect(await supabaseAuth()(request(`Bearer ${signToken(validClaims())}`))).toBeNull();
  });
});
