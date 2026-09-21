import { createHash } from "node:crypto";
import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { z } from "zod";
import {
  CODEX_ASSETS_BUCKET,
  INLINE_FILE_BYTE_LIMIT,
  RENDER_CACHE_TABLE,
  getSupabaseClient,
} from "#lib/supabase";

const FORMAT_MEDIA_TYPE: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  webp: "image/webp",
};

const inputSchema = z
  .object({
    html: z
      .string()
      .min(1)
      .optional()
      .describe("Path to an existing HTML file already inside the sandbox workspace."),
    htmlString: z.string().min(1).optional().describe("Inline HTML content to render."),
    width: z.number().int().positive().describe("Exact clip width in px."),
    height: z.number().int().positive().describe("Exact clip height in px."),
    format: z.enum(["png", "jpeg", "jpg", "webp"]).default("png"),
    scale: z.number().positive().default(1).describe("Device scale factor, e.g. 2 for @2x."),
    quality: z.number().int().min(1).max(100).default(90).describe("1-100, jpeg/webp only."),
  })
  .refine((data) => Boolean(data.html) !== Boolean(data.htmlString), {
    message: "Provide exactly one of `html` or `htmlString`.",
  });

type RenderPieceInput = z.infer<typeof inputSchema>;

const outputSchema = z.object({
  url: z.string(),
  cached: z.boolean(),
  hash: z.string(),
  width: z.number(),
  height: z.number(),
  format: z.string(),
  imageBase64: z.string().nullable(),
});

interface RenderCacheRow {
  hash: string;
  url: string;
  width: number;
  height: number;
  format: string;
  created_at: string;
}

/**
 * Cache key = sha256(html/htmlString value + width + height + format + scale).
 *
 * Deliberate simplification vs research/arquitectura-remota-eve-dev.md §7 (which
 * proposed hashing "HTML final + tokens/foundations usados + tamaño de salida"):
 * hashing only the literal value passed for `html`/`htmlString` already captures
 * resolved tokens/foundations whenever the caller passes `htmlString`, because
 * those are embedded verbatim in the final HTML string — no separate
 * tokens/foundations hash is needed. This also lets the cache be consulted
 * before ever touching the sandbox (the real savings §7 asks for).
 *
 * Caveat: if `html` is a sandbox *path* and the file's content changes without
 * the path changing, the cache will not detect that (the path string, not the
 * file's bytes, is what gets hashed). Pass `htmlString` when that matters.
 */
function computeCacheHash(input: RenderPieceInput): string {
  const hash = createHash("sha256");
  hash.update(input.html ?? input.htmlString ?? "");
  hash.update(String(input.width));
  hash.update(String(input.height));
  hash.update(input.format);
  hash.update(String(input.scale));
  return hash.digest("hex");
}

function extensionFor(format: string): string {
  return format === "jpg" ? "jpeg" : format;
}

export default defineTool({
  description:
    "Render an HTML piece to a raster image (PNG/JPEG/WebP) with an exact pixel clip, using the " +
    "shared codex-render-pipeline export_piece.py script in the sandbox. Checks a Supabase-backed " +
    "render cache first (by content hash) and returns the already-uploaded URL without touching " +
    "the sandbox when the same content was already rendered.",
  inputSchema,
  outputSchema,
  label: {
    start: ({ width, height, format }) => `Render ${width}x${height} ${format ?? "png"} piece`,
  },
  async execute(input, ctx) {
    const hash = computeCacheHash(input);
    const supabase = getSupabaseClient();

    const { data: cached, error: cacheReadError } = await supabase
      .from(RENDER_CACHE_TABLE)
      .select("hash,url,width,height,format,created_at")
      .eq("hash", hash)
      .maybeSingle<RenderCacheRow>();

    if (cacheReadError) {
      throw new Error(`Render cache lookup failed: ${cacheReadError.message}`);
    }

    if (cached) {
      return {
        url: cached.url,
        cached: true,
        hash,
        width: cached.width,
        height: cached.height,
        format: cached.format,
        imageBase64: null,
      };
    }

    // Cache miss: render for real in the sandbox.
    const sandbox = await ctx.getSandbox();
    const venvPython = "/workspace/.venv/bin/python";
    const scriptPath = sandbox.resolvePath("scripts/export_piece.py");
    const ext = extensionFor(input.format);
    const outputPath = `renders/${hash}.${ext}`;

    let htmlPathArg: string;
    if (input.htmlString) {
      const sourcePath = `renders/${hash}.source.html`;
      await sandbox.writeTextFile({ path: sourcePath, content: input.htmlString });
      htmlPathArg = sandbox.resolvePath(sourcePath);
    } else {
      htmlPathArg = sandbox.resolvePath(input.html!);
    }

    const args = [
      "--html",
      JSON.stringify(htmlPathArg),
      "--width",
      String(input.width),
      "--height",
      String(input.height),
      "--output",
      JSON.stringify(sandbox.resolvePath(outputPath)),
      "--format",
      input.format,
      "--scale",
      String(input.scale),
      "--quality",
      String(input.quality),
    ];

    const command = `${venvPython} ${JSON.stringify(scriptPath)} ${args.join(" ")}`;
    const result = await sandbox.run({ command });
    if (result.exitCode !== 0) {
      throw new Error(
        `export_piece.py failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
      );
    }

    const bytes = await sandbox.readBinaryFile({ path: outputPath });
    if (!bytes || bytes.byteLength === 0) {
      throw new Error("export_piece.py did not produce an image.");
    }
    const buffer = Buffer.from(bytes);

    const mediaType = FORMAT_MEDIA_TYPE[input.format] ?? "application/octet-stream";
    const storagePath = `renders/${hash}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(CODEX_ASSETS_BUCKET)
      .upload(storagePath, buffer, { contentType: mediaType, upsert: true });
    if (uploadError) {
      throw new Error(
        `Failed to upload rendered image to Supabase Storage bucket "${CODEX_ASSETS_BUCKET}": ${uploadError.message}`,
      );
    }

    const { data: publicUrlData } = supabase.storage.from(CODEX_ASSETS_BUCKET).getPublicUrl(storagePath);
    const url = publicUrlData.publicUrl;

    const { error: insertError } = await supabase.from(RENDER_CACHE_TABLE).insert({
      hash,
      url,
      width: input.width,
      height: input.height,
      format: input.format,
    });
    // 23505 = unique_violation: a concurrent render already inserted this hash first. Not an error.
    if (insertError && (insertError as { code?: string }).code !== "23505") {
      throw new Error(`Failed to write render cache row: ${insertError.message}`);
    }

    const withinInlineLimit = buffer.byteLength <= INLINE_FILE_BYTE_LIMIT;

    return {
      url,
      cached: false,
      hash,
      width: input.width,
      height: input.height,
      format: input.format,
      imageBase64: withinInlineLimit ? buffer.toString("base64") : null,
    };
  },
  toModelOutput(output) {
    const status = output.cached ? "cache hit" : "newly rendered";
    if (output.imageBase64) {
      const mediaType = FORMAT_MEDIA_TYPE[output.format] ?? "image/png";
      return toolOutput.content([
        toolOutputPart.text(
          `Rendered ${output.width}x${output.height} ${output.format} (${status}): ${output.url}`,
        ),
        toolOutputPart.file(output.imageBase64, { mediaType }),
      ]);
    }
    return toolOutput.text(
      `Rendered ${output.width}x${output.height} ${output.format} (${status}). Image exceeds the ` +
        `~3 MiB inline limit; fetch it from ${output.url} or via get_library_asset instead.`,
    );
  },
});
