import { defineSandbox } from "eve/sandbox";

/**
 * Backend is intentionally omitted: `defaultBackend()` picks the best
 * available option per host (Vercel Sandbox -> Docker -> microsandbox ->
 * just-bash). On this machine (Apple Silicon, Docker installed but the
 * daemon not running) that resolves to `microsandbox()`. Do not pin a
 * backend here — see docs/sandbox.mdx "Backends".
 */
export default defineSandbox({
  // Bump this when bootstrap's install steps change, so eve rebuilds the
  // template instead of reusing a stale one missing the new setup.
  revalidationKey: () => "codex-render-pipeline-bootstrap-v1",
  async bootstrap({ use }) {
    const sandbox = await use();
    const commands = [
      "sudo apt-get update && sudo apt-get install -y python3 python3-venv",
      "python3 -m venv /workspace/.venv",
      "/workspace/.venv/bin/python -m pip install playwright==1.63.0 Pillow==12.3.0",
      // --with-deps installs the system libraries Chromium needs (apt), not
      // just the browser binary — required for the browser to actually launch.
      "/workspace/.venv/bin/python -m playwright install --with-deps chromium",
      "/workspace/.venv/bin/python -c \"import playwright, PIL; print('Render pipeline dependencies ready')\"",
    ];
    for (const command of commands) {
      const result = await sandbox.run({ command });
      if (result.exitCode !== 0) {
        throw new Error(
          `Render pipeline sandbox setup failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
        );
      }
    }
  },
});
