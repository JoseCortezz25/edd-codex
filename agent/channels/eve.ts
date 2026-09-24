import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";
import { supabaseAuth } from "#lib/supabase-auth";

export default eveChannel({
  auth: [
    // Browser callers from codex-agent-page: verifies the Supabase access
    // token (Authorization: Bearer) against the project's JWKS.
    supabaseAuth(),
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
  ],
});
