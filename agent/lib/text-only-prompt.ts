import type { LanguageModelMiddleware } from "ai";

/**
 * Prompt rewriting for text-only chat models (currently glm-5.3-flash through
 * the opencode-go OpenAI-compatible endpoint, see agent/agent.ts).
 *
 * That upstream rejects any non-string message content with
 * `[invalid_request_error] Input should be a valid string`, so a single image
 * attachment fails the whole turn. Two things produce non-string content:
 *
 * 1. `file` parts. eve stages chat uploads to `/workspace/attachments/<sha16>/<name>`
 *    and, on hydration, inlines `image/*` (<= 3 MiB) and PDFs (<= 20 MiB) as bytes;
 *    @ai-sdk/openai-compatible turns those into `image_url` / `file` array items.
 *    Tool results with `content` output (render_piece, get_library_asset) carry
 *    base64 file parts too, which the provider would JSON.stringify into the tool
 *    message verbatim (megabytes of base64 in the context).
 * 2. User messages with more than one text part. @ai-sdk/openai-compatible only
 *    sends a plain string when a user message has exactly ONE text part; two or
 *    more (e.g. the user's text plus eve's "Attached file ..." note) become an
 *    array, which this upstream also rejects.
 *
 * So every file part becomes a text part (SVG markup is inlined as code, other
 * files become a one-line description with their sandbox path), and text-only
 * user messages / tool outputs are collapsed into a single text value.
 *
 * Remove the middleware (see MODEL_IS_TEXT_ONLY in agent/agent.ts) when the
 * agent moves to a vision-capable model that accepts content arrays.
 */

type CallOptions = Parameters<
  NonNullable<LanguageModelMiddleware["transformParams"]>
>[0]["params"];
export type TextOnlyPrompt = CallOptions["prompt"];
type PromptMessage = TextOnlyPrompt[number];
type UserMessage = Extract<PromptMessage, { role: "user" }>;
type ToolMessage = Extract<PromptMessage, { role: "tool" }>;
type UserFilePart = Extract<UserMessage["content"][number], { type: "file" }>;
type FileData = UserFilePart["data"];

/**
 * Max SVG markup characters inlined per attachment (~25k tokens). Brand logos and
 * icons are typically well under this; anything larger is almost always an
 * embedded raster or an exported illustration, where the head of the file is
 * enough for the model to understand its structure. Longer markup is truncated
 * with an explicit note — the full file is still in the sandbox at its path.
 */
export const MAX_INLINE_SVG_CHARS = 100_000;

const SVG_MEDIA_TYPE = "image/svg+xml";
const TEXT_PART_SEPARATOR = "\n\n";

/** Minimal shape shared by user file parts and tool-result file parts. */
interface FileLike {
  data: FileData;
  mediaType: string;
  filename?: string;
}

/** Rewrites a whole prompt so it only contains text a text-only model accepts. Pure. */
export function toTextOnlyPrompt(prompt: TextOnlyPrompt): TextOnlyPrompt {
  return prompt.map((message) => {
    switch (message.role) {
      case "user":
        return rewriteUserMessage(message);
      case "tool":
        return rewriteToolMessage(message);
      default:
        // system content is already a string; assistant file parts are dropped
        // by @ai-sdk/openai-compatible itself (it only forwards text/reasoning/tool calls).
        return message;
    }
  });
}

/** Describes one file as text: SVG markup inline, anything else as a one-line reference. */
export function describeFileAsText(file: FileLike): string {
  const label = fileLabel(file);
  const mediaType = file.mediaType || "application/octet-stream";

  if (mediaType === SVG_MEDIA_TYPE) {
    const bytes = fileDataToBytes(file.data);
    if (bytes) {
      const markup = new TextDecoder().decode(bytes);
      return `Attached SVG ${label} (${SVG_MEDIA_TYPE}):\n${truncateMarkup(markup)}`;
    }
  }

  const size = fileDataByteLength(file.data);
  const details =
    size === null ? mediaType : `${mediaType}, ${formatByteSize(size)}`;
  return `Attached file ${label} (${details})`;
}

export const textOnlyPromptMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v4",
  transformParams: async ({ params }) => ({
    ...params,
    prompt: toTextOnlyPrompt(params.prompt),
  }),
};

function rewriteUserMessage(message: UserMessage): UserMessage {
  const content = message.content.map((part) =>
    part.type === "file"
      ? { type: "text" as const, text: describeFileAsText(part) }
      : part,
  );
  // Every part is text now; one part is what makes the provider send a plain string.
  if (content.length <= 1) return { ...message, content };
  const text = content.map((part) => part.text).join(TEXT_PART_SEPARATOR);
  return { ...message, content: [{ type: "text", text }] };
}

function rewriteToolMessage(message: ToolMessage): ToolMessage {
  const content = message.content.map((part) => {
    if (part.type !== "tool-result" || part.output.type !== "content")
      return part;
    const texts: string[] = [];
    for (const item of part.output.value) {
      if (item.type === "text") texts.push(item.text);
      else if (item.type === "file") texts.push(describeFileAsText(item));
      // `custom` items carry no standard payload for a text-only model; drop them.
    }
    return { ...part, output: { type: "text" as const, value: texts.join(TEXT_PART_SEPARATOR) } };
  });
  return { ...message, content };
}

function fileLabel(file: FileLike): string {
  const filename = file.filename?.trim();
  if (filename) return filename;
  if (file.data.type === "url" && file.data.url.protocol !== "data:")
    return file.data.url.href;
  return "(inline file, no path)";
}

function truncateMarkup(markup: string): string {
  if (markup.length <= MAX_INLINE_SVG_CHARS) return markup;
  return (
    `${markup.slice(0, MAX_INLINE_SVG_CHARS)}\n` +
    `[SVG truncated: showing the first ${MAX_INLINE_SVG_CHARS} of ${markup.length} characters. ` +
    `Read the file from its sandbox path for the rest.]`
  );
}

/** Decodes file data to bytes when it is inline (bytes, base64, or a data: URL). */
function fileDataToBytes(data: FileData): Uint8Array | null {
  switch (data.type) {
    case "data":
      if (typeof data.data !== "string") return data.data;
      return data.data.startsWith("data:")
        ? dataUrlToBytes(data.data)
        : new Uint8Array(Buffer.from(data.data, "base64"));
    case "url":
      return data.url.protocol === "data:"
        ? dataUrlToBytes(data.url.href)
        : null;
    case "text":
      return new TextEncoder().encode(data.text);
    default:
      return null;
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return null;
  const header = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  if (header.endsWith(";base64"))
    return new Uint8Array(Buffer.from(payload, "base64"));
  try {
    return new TextEncoder().encode(decodeURIComponent(payload));
  } catch {
    return new TextEncoder().encode(payload);
  }
}

function fileDataByteLength(data: FileData): number | null {
  if (
    data.type === "data" &&
    typeof data.data === "string" &&
    !data.data.startsWith("data:")
  ) {
    // Avoid decoding megabytes of base64 just to measure it.
    const padding = data.data.endsWith("==")
      ? 2
      : data.data.endsWith("=")
        ? 1
        : 0;
    return Math.max(0, Math.floor((data.data.length * 3) / 4) - padding);
  }
  return fileDataToBytes(data)?.byteLength ?? null;
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
