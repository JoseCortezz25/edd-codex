import { posix } from "node:path";

/**
 * Pure planning for upload_brand_asset: validates the sandbox source path and
 * derives the `library_assets` row fields + storage path, following the
 * convention in supabase/migrations/0002_client_brand_management.sql:
 *
 *   storage_path = <brand_id>/library/<type>/<name>   (destination "library")
 *                | <brand_id>/inbox/<name>           (destination "inbox", row type "inbox")
 */

/** Library categories allowed by the `library_assets.type` check constraint (minus "inbox"). */
export const LIBRARY_ASSET_TYPES = [
  "logos",
  "images",
  "videos",
  "icons",
  "sounds",
  "fonts",
] as const;
export type LibraryAssetType = (typeof LIBRARY_ASSET_TYPES)[number];

export const ASSET_DESTINATIONS = ["library", "inbox"] as const;
export type AssetDestination = (typeof ASSET_DESTINATIONS)[number];

const WORKSPACE_ROOT = "/workspace";

const EXTENSION_CONTENT_TYPE: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  ico: "image/x-icon",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

export interface BrandAssetPlanInput {
  brandId: string;
  sandboxPath: string;
  destination: AssetDestination;
  type?: LibraryAssetType;
  name?: string;
}

export interface BrandAssetPlan {
  /** Absolute, normalized sandbox path to read the bytes from. */
  sourcePath: string;
  /** `library_assets.name` — a filename with no directory separators. */
  name: string;
  /** `library_assets.type` — one of the library categories, or "inbox". */
  rowType: LibraryAssetType | "inbox";
  /** `library_assets.storage_path` and the object key in the bucket. */
  storagePath: string;
  contentType: string;
}

/** Throws with an actionable message when the input cannot map to a valid asset row. */
export function planBrandAssetUpload(
  input: BrandAssetPlanInput,
): BrandAssetPlan {
  const sourcePath = normalizeSandboxPath(input.sandboxPath);
  const sourceName = posix.basename(sourcePath);
  const name = resolveAssetName(input.name, sourceName);

  if (input.destination === "library" && !input.type) {
    throw new Error(
      `A library upload needs a type (one of: ${LIBRARY_ASSET_TYPES.join(", ")}). ` +
        `Use destination "inbox" when the category is not known yet.`,
    );
  }

  const rowType = input.destination === "inbox" ? "inbox" : input.type!;
  const storagePath =
    rowType === "inbox"
      ? `${input.brandId}/inbox/${name}`
      : `${input.brandId}/library/${rowType}/${name}`;

  return {
    sourcePath,
    name,
    rowType,
    storagePath,
    contentType: contentTypeForName(name),
  };
}

export function contentTypeForName(name: string): string {
  const ext = extensionOf(name);
  return (ext && EXTENSION_CONTENT_TYPE[ext]) || "application/octet-stream";
}

/** Anchors relative paths at /workspace and rejects anything that escapes it. */
function normalizeSandboxPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) throw new Error("sandbox_path is empty.");
  const absolute = trimmed.startsWith("/")
    ? trimmed
    : `${WORKSPACE_ROOT}/${trimmed}`;
  const normalized = posix.normalize(absolute);
  if (!normalized.startsWith(`${WORKSPACE_ROOT}/`)) {
    throw new Error(
      `sandbox_path "${rawPath}" must point to a file under ${WORKSPACE_ROOT}/.`,
    );
  }
  if (normalized.endsWith("/")) {
    throw new Error(
      `sandbox_path "${rawPath}" points to a directory, not a file.`,
    );
  }
  return normalized;
}

/**
 * Uses the explicit name when given, else the source filename. A name without an
 * extension inherits the source file's extension so the content type stays correct.
 */
function resolveAssetName(
  requested: string | undefined,
  sourceName: string,
): string {
  const name = requested?.trim() || sourceName;
  if (/[/\\]/.test(name)) {
    throw new Error(
      `Asset name "${name}" must be a plain filename, without "/" or "\\".`,
    );
  }
  if (name === "." || name === "..")
    throw new Error(`Asset name "${name}" is not a valid filename.`);
  const sourceExt = extensionOf(sourceName);
  if (!extensionOf(name) && sourceExt) return `${name}.${sourceExt}`;
  return name;
}

function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}
