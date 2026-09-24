import {
  type AuthFn,
  extractBearerToken,
  verifyOidc,
  withAuthChallenges,
} from "eve/channels/auth";

/**
 * Route-auth entry that accepts browser callers signed in with Supabase Auth.
 *
 * The frontend sends the user's Supabase access token as
 * `Authorization: Bearer <token>`. The token is verified with eve's built-in
 * OIDC verifier against the project's discovery document
 * (`${SUPABASE_URL}/auth/v1/.well-known/openid-configuration`), which points
 * at the public JWKS (`/auth/v1/.well-known/jwks.json`, ES256 signing keys).
 * Signature, `iss` (`${SUPABASE_URL}/auth/v1`), `aud` (`authenticated`),
 * `exp` and `nbf` are all checked; JWKS and discovery responses are cached
 * by eve per URL.
 *
 * Fails closed without throwing: a missing/invalid token, a missing
 * `SUPABASE_URL`, or a discovery/JWKS failure returns `null` so the walk
 * continues to the next entry (and ultimately a 401).
 *
 * Required env: SUPABASE_URL (read per request, never at module load).
 */
export const SUPABASE_AUDIENCE = "authenticated";

export function supabaseIssuer(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/auth/v1`;
}

export function supabaseAuth(): AuthFn<Request> {
  return withAuthChallenges<Request>(async (request) => {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (token === null) return null;

    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    if (!supabaseUrl) return null;

    const result = await verifyOidc(token, {
      issuer: supabaseIssuer(supabaseUrl),
      audiences: [SUPABASE_AUDIENCE],
      // Supabase sets `role: "authenticated"` on signed-in user tokens.
      claims: { role: ["authenticated"] },
    });
    if (!result.ok) return null;

    const { sessionAuth } = result;
    if (!sessionAuth.subject) return null;

    const email = sessionAuth.attributes.email;
    const attributes: Record<string, string> = typeof email === "string" ? { email } : {};
    return {
      authenticator: "supabase",
      issuer: sessionAuth.issuer,
      principalId: sessionAuth.principalId,
      // verifyOidc tags every caller as "service"; Supabase access tokens
      // always identify an end user.
      principalType: "user",
      subject: sessionAuth.subject,
      attributes,
    };
  }, [{ scheme: "Bearer" }]);
}
