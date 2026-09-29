import { describe, expect, it } from "vitest";
import { contentTypeForName, planBrandAssetUpload } from "./brand-asset-path";

// Storage path convention from supabase/migrations/0002_client_brand_management.sql:
// <brand_id>/library/<type>/<name> | <brand_id>/inbox/<name>

const BRAND_ID = "22222222-2222-4222-8222-222222222222";
const ATTACHMENT = "/workspace/attachments/0123456789abcdef/logo.svg";

describe("planBrandAssetUpload", () => {
  it("files a library upload under <brand>/library/<type>/<name>", () => {
    expect(
      planBrandAssetUpload({
        brandId: BRAND_ID,
        sandboxPath: ATTACHMENT,
        destination: "library",
        type: "logos",
      }),
    ).toEqual({
      sourcePath: ATTACHMENT,
      name: "logo.svg",
      rowType: "logos",
      storagePath: `${BRAND_ID}/library/logos/logo.svg`,
      contentType: "image/svg+xml",
    });
  });

  it("parks an inbox upload under <brand>/inbox/<name> with row type inbox, ignoring type", () => {
    const plan = planBrandAssetUpload({
      brandId: BRAND_ID,
      sandboxPath: ATTACHMENT,
      destination: "inbox",
      type: "icons",
    });
    expect(plan.rowType).toBe("inbox");
    expect(plan.storagePath).toBe(`${BRAND_ID}/inbox/logo.svg`);
  });

  it("requires a type for library uploads", () => {
    expect(() =>
      planBrandAssetUpload({
        brandId: BRAND_ID,
        sandboxPath: ATTACHMENT,
        destination: "library",
      }),
    ).toThrowError(/needs a type/);
  });

  it("uses an explicit name, inheriting the source extension when it has none", () => {
    const withExt = planBrandAssetUpload({
      brandId: BRAND_ID,
      sandboxPath: ATTACHMENT,
      destination: "library",
      type: "logos",
      name: "primary-mark.svg",
    });
    expect(withExt.name).toBe("primary-mark.svg");
    const withoutExt = planBrandAssetUpload({
      brandId: BRAND_ID,
      sandboxPath: ATTACHMENT,
      destination: "library",
      type: "logos",
      name: "primary-mark",
    });
    expect(withoutExt.name).toBe("primary-mark.svg");
    expect(withoutExt.contentType).toBe("image/svg+xml");
  });

  it("rejects names with directory separators", () => {
    for (const name of ["a/b.png", "a\\b.png", ".."]) {
      expect(() =>
        planBrandAssetUpload({
          brandId: BRAND_ID,
          sandboxPath: ATTACHMENT,
          destination: "inbox",
          name,
        }),
      ).toThrowError(/Asset name/);
    }
  });

  it("anchors relative paths at /workspace and rejects paths escaping it", () => {
    expect(
      planBrandAssetUpload({
        brandId: BRAND_ID,
        sandboxPath: "renders/x.png",
        destination: "inbox",
      }).sourcePath,
    ).toBe("/workspace/renders/x.png");
    for (const sandboxPath of [
      "/etc/passwd",
      "/workspace/../etc/passwd",
      "../secret",
      "/workspace/dir/",
      "  ",
    ]) {
      expect(() =>
        planBrandAssetUpload({
          brandId: BRAND_ID,
          sandboxPath,
          destination: "inbox",
        }),
      ).toThrowError();
    }
  });
});

describe("contentTypeForName", () => {
  it("maps known extensions case-insensitively and falls back to octet-stream", () => {
    expect(contentTypeForName("Photo.JPG")).toBe("image/jpeg");
    expect(contentTypeForName("font.woff2")).toBe("font/woff2");
    expect(contentTypeForName("README")).toBe("application/octet-stream");
    expect(contentTypeForName("archive.xyz")).toBe("application/octet-stream");
  });
});
