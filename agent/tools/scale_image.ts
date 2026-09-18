import { randomUUID } from "node:crypto";
import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { z } from "zod";
import { INLINE_FILE_BYTE_LIMIT } from "#lib/supabase";

const FORMAT_MEDIA_TYPE: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  webp: "image/webp",
};

const inputSchema = z
  .object({
    sourcePath: z
      .string()
      .min(1)
      .optional()
      .describe("Path to an existing image already inside the sandbox workspace."),
    imageBase64: z.string().min(1).optional().describe("Base64-encoded source image bytes."),
    url: z.string().url().optional().describe("URL to download the source image from first."),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    scale: z.number().positive().optional().describe("Uniform scale factor, mutually exclusive with width/height."),
    format: z.enum(["png", "jpeg", "jpg", "webp"]).optional().describe("Defaults to the source image's format."),
    quality: z.number().int().min(1).max(100).default(90),
  })
  .refine((data) => [data.sourcePath, data.imageBase64, data.url].filter(Boolean).length === 1, {
    message: "Provide exactly one of `sourcePath`, `imageBase64`, or `url`.",
  })
  .refine((data) => !(data.scale && (data.width || data.height)), {
    message: "`scale` is mutually exclusive with `width`/`height`.",
  })
  .refine((data) => Boolean(data.scale || data.width || data.height), {
    message: "Provide `scale`, or at least one of `width`/`height`.",
  });

const outputSchema = z.object({
  outputPath: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  byteLength: z.number(),
  format: z.string(),
  imageBase64: z.string().nullable(),
});

function normalizeFormat(format: string): string {
  return format === "jpg" ? "jpeg" : format;
}

function extFromPath(path: string): string | null {
  const match = /\.([a-zA-Z0-9]+)$/.exec(path);
  return match ? match[1].toLowerCase() : null;
}

export default defineTool({
  description:
    "Scale/resize an existing image using the shared codex-render-pipeline scale_image.py " +
    "script in the sandbox. Accepts a sandbox path, base64 bytes, or a URL to download first.",
  inputSchema,
  outputSchema,
  label: {
    start: () => "Scale image",
  },
  async execute(input, ctx) {
    const sandbox = await ctx.getSandbox();
    const venvPython = "/workspace/.venv/bin/python";
    const scriptPath = sandbox.resolvePath("scripts/scale_image.py");
    const workDir = `scale/${randomUUID()}`;

    let sourcePath: string;
    if (input.imageBase64) {
      sourcePath = `${workDir}/source`;
      await sandbox.writeBinaryFile({
        path: sourcePath,
        content: Buffer.from(input.imageBase64, "base64"),
      });
    } else if (input.url) {
      sourcePath = `${workDir}/source`;
      const resolvedSource = sandbox.resolvePath(sourcePath);
      const download = await sandbox.run({
        command: `curl -sL ${JSON.stringify(input.url)} -o ${JSON.stringify(resolvedSource)}`,
      });
      if (download.exitCode !== 0) {
        throw new Error(
          `Failed to download source image (exit ${download.exitCode}): ${download.stderr || download.stdout}`,
        );
      }
    } else {
      sourcePath = input.sourcePath!;
    }

    // The script infers the output format from --output's extension when
    // --format is omitted, so we must pick a concrete extension ourselves
    // before invoking it. Fall back to the source path's own extension, then
    // to png.
    const ext = input.format
      ? normalizeFormat(input.format)
      : extFromPath(input.sourcePath ?? "") ?? "png";
    const outputPath = `${workDir}/output.${ext}`;

    const args = [
      "--input",
      JSON.stringify(sandbox.resolvePath(sourcePath)),
      "--output",
      JSON.stringify(sandbox.resolvePath(outputPath)),
    ];
    if (input.scale) {
      args.push("--scale", String(input.scale));
    } else {
      if (input.width) args.push("--width", String(input.width));
      if (input.height) args.push("--height", String(input.height));
    }
    if (input.format) args.push("--format", ext);
    args.push("--quality", String(input.quality));

    const command = `${venvPython} ${JSON.stringify(scriptPath)} ${args.join(" ")}`;
    const result = await sandbox.run({ command });
    if (result.exitCode !== 0) {
      throw new Error(
        `scale_image.py failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
      );
    }

    const bytes = await sandbox.readBinaryFile({ path: outputPath });
    if (!bytes || bytes.byteLength === 0) {
      throw new Error("scale_image.py did not produce an image.");
    }
    const buffer = Buffer.from(bytes);
    const withinInlineLimit = buffer.byteLength <= INLINE_FILE_BYTE_LIMIT;

    return {
      outputPath: sandbox.resolvePath(outputPath),
      width: input.width ?? null,
      height: input.height ?? null,
      byteLength: buffer.byteLength,
      format: ext,
      imageBase64: withinInlineLimit ? buffer.toString("base64") : null,
    };
  },
  toModelOutput(output) {
    if (output.imageBase64) {
      const mediaType = FORMAT_MEDIA_TYPE[output.format] ?? "image/png";
      return toolOutput.content([
        toolOutputPart.text(`Scaled image (${output.byteLength} bytes) at ${output.outputPath}:`),
        toolOutputPart.file(output.imageBase64, { mediaType }),
      ]);
    }
    return toolOutput.text(
      `Scaled image (${output.byteLength} bytes) exceeds the ~3 MiB inline limit. It remains at ` +
        `${output.outputPath} inside the sandbox; request it separately or upload it via render_piece's ` +
        "storage pattern if it needs to persist outside the sandbox.",
    );
  },
});
