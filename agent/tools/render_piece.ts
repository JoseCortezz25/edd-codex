import { createHash } from "node:crypto";
import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { z } from "zod";
import {
  CODEX_ASSETS_BUCKET,
  INLINE_FILE_BYTE_LIMIT,
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
  hash: z.string(),
  width: z.number(),
  height: z.number(),
  format: z.string(),
  imageBase64: z.string().nullable(),
});

/**
 * Content hash = sha256(html/htmlString value + width + height + format + scale).
 * Used only to name the sandbox and storage artifacts of a render.
 */
function computeRenderHash(input: RenderPieceInput): string {
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
    "shared codex-render-pipeline export_piece.py script in the sandbox. Every call renders " +
    "for real and uploads the result to Supabase Storage.",
  inputSchema,
  outputSchema,
  label: {
    start: ({ width, height, format }) => `Render ${width}x${height} ${format ?? "png"} piece`,
  },
  async execute(input, ctx) {
    const hash = computeRenderHash(input);
    const supabase = getSupabaseClient();

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

    const withinInlineLimit = buffer.byteLength <= INLINE_FILE_BYTE_LIMIT;

    return {
      url,
      hash,
      width: input.width,
      height: input.height,
      format: input.format,
      imageBase64: withinInlineLimit ? buffer.toString("base64") : null,
    };
  },
  toModelOutput(output) {
    if (output.imageBase64) {
      const mediaType = FORMAT_MEDIA_TYPE[output.format] ?? "image/png";
      return toolOutput.content([
        toolOutputPart.text(
          `Rendered ${output.width}x${output.height} ${output.format}: ${output.url}`,
        ),
        toolOutputPart.file(output.imageBase64, { mediaType }),
      ]);
    }
    return toolOutput.text(
      `Rendered ${output.width}x${output.height} ${output.format}. Image exceeds the ` +
        `~3 MiB inline limit; fetch it from ${output.url} or via get_library_asset instead.`,
    );
  },
});
