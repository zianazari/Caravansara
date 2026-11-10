import { MAX_PHOTO_BYTES, PHOTO_TYPES, checkImageFile, checkPhotoFile } from "./imageCheck";

/** A file whose first bytes are `head`, padded to `size` bytes. */
function file(head: number[] | string, type: string, size = 64): File {
  const bytes = new Uint8Array(Math.max(size, 12));
  const start = typeof head === "string" ? [...head].map((c) => c.charCodeAt(0)) : head;
  bytes.set(start);
  return new File([bytes.slice(0, size)], "f", { type });
}
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [..."RIFF"]
  .map((c) => c.charCodeAt(0))
  .concat(
    [0, 0, 0, 0],
    [..."WEBP"].map((c) => c.charCodeAt(0)),
  );

describe("image check (specs/008-host-pages, research R5)", () => {
  it("accepts JPEG, PNG and WebP up to 10 MB", async () => {
    expect(MAX_PHOTO_BYTES).toBe(10_485_760);
    expect(PHOTO_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(await checkPhotoFile(file(JPEG, "image/jpeg"))).toBeNull();
    expect(await checkPhotoFile(file(PNG, "image/png"))).toBeNull();
    expect(await checkPhotoFile(file(WEBP, "image/webp"))).toBeNull();
    expect(await checkPhotoFile(file(JPEG, "image/jpeg", MAX_PHOTO_BYTES))).toBeNull();
  });

  it("refuses a file one byte over the limit", async () => {
    expect(await checkPhotoFile(file(JPEG, "image/jpeg", MAX_PHOTO_BYTES + 1))).toBe("too_large");
  });

  it("refuses other types, even with a picture inside", async () => {
    expect(await checkPhotoFile(file("GIF89a", "image/gif"))).toBe("wrong_type");
    expect(await checkPhotoFile(file("%PDF-1", "application/pdf"))).toBe("wrong_type");
  });

  it("looks at the content, not the name or the declared type", async () => {
    expect(await checkPhotoFile(file("just some text", "image/jpeg"))).toBe("not_image");
    expect(await checkPhotoFile(new File([], "empty.jpg", { type: "image/jpeg" }))).toBe("not_image");
    // A RIFF file that is not WebP (a WAV sound, for one).
    expect(await checkPhotoFile(file("RIFF\0\0\0\0WAVE", "image/webp"))).toBe("not_image");
  });

  it("is the same check the profile picture uses, with its own limit and types", async () => {
    const options = { maxBytes: 5 * 1024 * 1024, types: ["image/png", "image/jpeg"] as const };
    expect(await checkImageFile(file(PNG, "image/png"), options)).toBeNull();
    expect(await checkImageFile(file(WEBP, "image/webp"), options)).toBe("wrong_type");
  });
});
