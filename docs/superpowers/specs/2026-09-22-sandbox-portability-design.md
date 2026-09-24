# Sandbox portability design

## Goal

Restore the local sandbox used by the rendering proof of concept while keeping
the same agent definition deployable to Vercel without environment-specific
code paths.

## Scope

- Make `eve dev` able to create the local sandbox again.
- Preserve Supabase as the external system for application data, assets, and
  rendered-piece cache.
- Preserve the automatic sandbox backend selection so Vercel uses Vercel
  Sandbox when deployed.
- Verify the sandbox can execute a narrow local command after the dependency
  alignment.

## Non-goals

- Change Supabase tables, Storage, or credentials.
- Change authentication or public access policies.
- Deploy the proof of concept to Vercel.
- Replace the model provider or change the rendering scripts.
- Introduce Docker as a requirement for local development.

## Decision

Keep `backend` unset in `agent/sandbox/sandbox.ts` and align the installed
`microsandbox` package to the version range expected by the installed `eve`
runtime.

`defaultBackend()` will then select:

| Environment | Selected backend | Reason |
| --- | --- | --- |
| Local Apple Silicon development | microsandbox | Docker is not required or running; microsandbox is the supported VM fallback. |
| Vercel deployment | Vercel Sandbox | `defaultBackend()` selects it when the Vercel runtime is present. |

## Data and execution flow

1. The agent and authored tools execute in the eve application runtime.
2. `render_piece` and `scale_image` acquire the sandbox through
   `ctx.getSandbox()`.
3. The sandbox runs the seeded Python scripts and Chromium under `/workspace`.
4. The tools upload rendered outputs and write cache metadata through the
   existing Supabase integration.

Supabase is not a sandbox backend and is unaffected by this dependency change.
It remains the durable, external store across local and Vercel environments.

## Failure handling

- If sandbox creation fails after alignment, report the backend selection and
  the exact creation error; do not silently fall back to `just-bash`, because
  it cannot execute Python or Chromium.
- If bootstrap fails, fail the session setup rather than reuse an incomplete
  rendering template.
- Vercel deployment will continue to fail at build time if its sandbox template
  cannot be prewarmed; this is desirable because a partially configured
  renderer is not a valid PoC deployment.

## Verification

1. Run the project type check.
2. Start `eve dev`.
3. Send a minimal request that invokes a sandbox-backed command or tool.
4. Confirm that the sandbox opens on microsandbox and no longer reports
   `t.isInstalled is not a function`.

## Migration boundary

The application must continue to call only eve's sandbox abstraction
(`ctx.getSandbox()` and `SandboxSession` methods). It must not import or call
microsandbox directly. This keeps the rendering tools portable to Vercel
Sandbox now and a self-hosted backend later.
