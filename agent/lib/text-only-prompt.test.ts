import { describe, expect, it } from "vitest";
import {
  MAX_INLINE_SVG_CHARS,
  type TextOnlyPrompt,
  describeFileAsText,
  formatByteSize,
  toTextOnlyPrompt,
} from "./text-only-prompt";

// The opencode-go upstream behind glm-5.3-flash rejects non-string message
// content ("Input should be a valid string"); @ai-sdk/openai-compatible only
// sends a string for a user message with exactly one text part.

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect fill="#f00"/></svg>';
const SVG_PATH = "/workspace/attachments/0123456789abcdef/logo.svg";
const PNG_PATH = "/workspace/attachments/fedcba9876543210/photo.png";

describe("describeFileAsText", () => {
  it("inlines SVG markup from raw bytes, labeled with the sandbox path", () => {
    const text = describeFileAsText({
      data: { type: "data", data: new TextEncoder().encode(SVG) },
      mediaType: "image/svg+xml",
      filename: SVG_PATH,
    });
    expect(text).toBe(`Attached SVG ${SVG_PATH} (image/svg+xml):\n${SVG}`);
  });

  it("decodes SVG from a base64 string and from base64 / percent-encoded data URLs", () => {
    const base64 = Buffer.from(SVG).toString("base64");
    const variants = [
      { type: "data" as const, data: base64 },
      { type: "data" as const, data: `data:image/svg+xml;base64,${base64}` },
      {
        type: "url" as const,
        url: new URL(`data:image/svg+xml,${encodeURIComponent(SVG)}`),
      },
    ];
    for (const data of variants) {
      expect(
        describeFileAsText({
          data,
          mediaType: "image/svg+xml",
          filename: SVG_PATH,
        }),
      ).toContain(SVG);
    }
  });

  it("truncates oversized SVG markup with an explicit note", () => {
    const huge = `<svg>${"a".repeat(MAX_INLINE_SVG_CHARS + 500)}</svg>`;
    const text = describeFileAsText({
      data: { type: "data", data: new TextEncoder().encode(huge) },
      mediaType: "image/svg+xml",
      filename: SVG_PATH,
    });
    expect(text).toContain(
      `[SVG truncated: showing the first ${MAX_INLINE_SVG_CHARS} of ${huge.length}`,
    );
    expect(text.length).toBeLessThan(MAX_INLINE_SVG_CHARS + 500);
  });

  it("describes non-SVG files by path, media type and size without sending bytes", () => {
    const text = describeFileAsText({
      data: { type: "data", data: new Uint8Array(2048) },
      mediaType: "image/png",
      filename: PNG_PATH,
    });
    expect(text).toBe(`Attached file ${PNG_PATH} (image/png, 2.0 KB)`);
  });

  it("measures base64 payloads without the padding", () => {
    const base64 = Buffer.from(new Uint8Array(10)).toString("base64"); // "AAAAAAAAAAAAAA=="
    expect(
      describeFileAsText({
        data: { type: "data", data: base64 },
        mediaType: "image/png",
      }),
    ).toBe("Attached file (inline file, no path) (image/png, 10 B)");
  });

  it("falls back to the URL, then a placeholder, when there is no filename", () => {
    expect(
      describeFileAsText({
        data: { type: "url", url: new URL("https://x.test/a.png") },
        mediaType: "image/png",
      }),
    ).toBe("Attached file https://x.test/a.png (image/png)");
    expect(
      describeFileAsText({
        data: { type: "data", data: new Uint8Array(3) },
        mediaType: "",
      }),
    ).toBe(
      "Attached file (inline file, no path) (application/octet-stream, 3 B)",
    );
  });
});

describe("toTextOnlyPrompt", () => {
  it("collapses a user message with text + file parts into one text part", () => {
    const prompt: TextOnlyPrompt = [
      {
        role: "user",
        content: [
          { type: "text", text: "Use this logo" },
          {
            type: "file",
            data: { type: "data", data: new TextEncoder().encode(SVG) },
            mediaType: "image/svg+xml",
            filename: SVG_PATH,
          },
          {
            type: "file",
            data: { type: "data", data: new Uint8Array(5) },
            mediaType: "image/png",
            filename: PNG_PATH,
          },
        ],
      },
    ];
    const [message] = toTextOnlyPrompt(prompt);
    expect(message).toEqual({
      role: "user",
      content: [
        {
          type: "text",
          text:
            `Use this logo\n\nAttached SVG ${SVG_PATH} (image/svg+xml):\n${SVG}\n\n` +
            `Attached file ${PNG_PATH} (image/png, 5 B)`,
        },
      ],
    });
  });

  it("also collapses user messages that already had several text parts", () => {
    const [message] = toTextOnlyPrompt([
      {
        role: "user",
        content: [
          { type: "text", text: "hola" },
          {
            type: "text",
            text: "Attached file /workspace/attachments/x/doc.zip (application/zip)",
          },
        ],
      },
    ]);
    expect(message.content).toEqual([
      {
        type: "text",
        text: "hola\n\nAttached file /workspace/attachments/x/doc.zip (application/zip)",
      },
    ]);
  });

  it("turns tool-result content output with files into a text output", () => {
    const [message] = toTextOnlyPrompt([
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "get_library_asset",
            output: {
              type: "content",
              value: [
                {
                  type: "text",
                  text: "Library asset brand/logo.png (image/png, 4 bytes):",
                },
                {
                  type: "file",
                  data: { type: "data", data: "AAAAAA==" },
                  mediaType: "image/png",
                },
              ],
            },
          },
        ],
      },
    ]);
    expect(message).toEqual({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "get_library_asset",
          output: {
            type: "text",
            value:
              "Library asset brand/logo.png (image/png, 4 bytes):\n\n" +
              "Attached file (inline file, no path) (image/png, 4 B)",
          },
        },
      ],
    });
  });

  it("leaves system, assistant, single-text user and non-content tool outputs untouched", () => {
    const prompt: TextOnlyPrompt = [
      { role: "system", content: "rules" },
      { role: "user", content: [{ type: "text", text: "hi" }] },
      { role: "assistant", content: [{ type: "text", text: "hello" }] },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "c",
            toolName: "t",
            output: { type: "json", value: { ok: true } },
          },
        ],
      },
    ];
    expect(toTextOnlyPrompt(prompt)).toEqual(prompt);
  });

  it("does not mutate the input prompt", () => {
    const prompt: TextOnlyPrompt = [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: { type: "data", data: new Uint8Array(1) },
            mediaType: "image/png",
            filename: PNG_PATH,
          },
        ],
      },
    ];
    const snapshot = structuredClone(prompt);
    toTextOnlyPrompt(prompt);
    expect(prompt).toEqual(snapshot);
  });
});

describe("formatByteSize", () => {
  it("formats bytes, KB and MB", () => {
    expect(formatByteSize(512)).toBe("512 B");
    expect(formatByteSize(1536)).toBe("1.5 KB");
    expect(formatByteSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
