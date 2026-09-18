import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { z } from "zod";
import { CODEX_ASSETS_BUCKET, INLINE_FILE_BYTE_LIMIT, getSupabaseClient } from "#lib/supabase";

/**
 * App-runtime tool (not a sandbox tool): reads an existing asset from Supabase
 * Storage by path and hands it to the model as base64, or as a plain URL when
 * it is too large to inline. This is the read half of the pattern verified in
 * research/arquitectura-remota-eve-dev.md §10 (Punto 1), adapted to call the
 * Supabase Storage SDK directly from the app runtime instead of curling a URL
 * from inside the sandbox — consistent with the storage decision in §3.2.
 */

const EXTENSION_MEDIA_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
};

function mediaTypeForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MEDIA_TYPE[ext] ?? "application/octet-stream";
}

const inputSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe(
      'Path of the asset inside the Supabase Storage bucket, e.g. "renders/<hash>.png" or "library/logos/brand-mark.png".',
    ),
});

const outputSchema = z.object({
  path: z.string(),
  mediaType: z.string(),
  byteLength: z.number(),
  imageBase64: z.string().nullable(),
  url: z.string(),
});

export default defineTool({
  description:
    "Read an existing asset from the Supabase Storage library bucket by path, and return it to " +
    "the model as base64 bytes (or, when it exceeds the ~3 MiB inline limit, only its stored URL).",
  inputSchema,
  outputSchema,
  label: {
    start: ({ path }) => `Read library asset ${path}`,
  },
  async execute({ path }) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage.from(CODEX_ASSETS_BUCKET).download(path);
    if (error || !data) {
      throw new Error(
        `Failed to download "${path}" from bucket "${CODEX_ASSETS_BUCKET}": ${error?.message ?? "not found"}`,
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mediaType = mediaTypeForPath(path);
    const { data: publicUrlData } = supabase.storage.from(CODEX_ASSETS_BUCKET).getPublicUrl(path);
    const withinInlineLimit = buffer.byteLength <= INLINE_FILE_BYTE_LIMIT;

    return {
      path,
      mediaType,
      byteLength: buffer.byteLength,
      imageBase64: withinInlineLimit ? buffer.toString("base64") : null,
      url: publicUrlData.publicUrl,
    };
  },
  toModelOutput(output) {
    if (output.imageBase64) {
      return toolOutput.content([
        toolOutputPart.text(
          `Library asset ${output.path} (${output.mediaType}, ${output.byteLength} bytes):`,
        ),
        toolOutputPart.file(output.imageBase64, { mediaType: output.mediaType }),
      ]);
    }
    return toolOutput.text(
      `Library asset ${output.path} (${output.mediaType}, ${output.byteLength} bytes) exceeds the ` +
        `~3 MiB inline limit. URL: ${output.url}`,
    );
  },
});
