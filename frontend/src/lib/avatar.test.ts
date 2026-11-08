import {
  AVATAR_PALETTE,
  MAX_AVATAR_BYTES,
  avatarColor,
  checkAvatarFile,
  initialOf,
  isOwnMediaUrl,
} from "./avatar";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const png = (size: number) => {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new Blob([bytes], { type: "image/png" });
};

describe("avatar", () => {
  it("gives every user a fixed colour with AA contrast for white text", () => {
    expect(avatarColor(7)).toBe(avatarColor(7));
    expect(avatarColor(1)).not.toBe(avatarColor(2));
    expect(avatarColor(-3)).toBe(AVATAR_PALETTE[3]);
    for (const colour of AVATAR_PALETTE) {
      expect((1 + 0.05) / (luminance(colour) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("takes the first letter as a reader sees it", () => {
    expect(initialOf("آرش رضایی")).toBe("آ");
    expect(initialOf("  omar Haddad")).toBe("O");
    expect(initialOf("ژیلا")).toBe("ژ");
    expect(initialOf("")).toBe("?");
  });

  it("shows only pictures from the system's own storage (FR-041)", () => {
    expect(isOwnMediaUrl("http://localhost:9000/caravansara-media/avatars/7/a.png")).toBe(true);
    expect(isOwnMediaUrl("https://example.com/avatar.png")).toBe(false);
    expect(isOwnMediaUrl("http://localhost:9000/caravansara-media/listings/7/a.png")).toBe(false);
    expect(isOwnMediaUrl(null)).toBe(false);
  });

  it("accepts PNG and JPEG up to exactly 5 MB", async () => {
    expect(await checkAvatarFile(png(MAX_AVATAR_BYTES))).toBeNull();
    const jpeg = new Uint8Array(100);
    jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(await checkAvatarFile(new Blob([jpeg], { type: "image/jpeg" }))).toBeNull();
  });

  it("refuses a file one byte too big, another type, or a text file named .png", async () => {
    expect(MAX_AVATAR_BYTES).toBe(5_242_880);
    expect(await checkAvatarFile(png(MAX_AVATAR_BYTES + 1))).toBe("too_large");
    expect(await checkAvatarFile(new Blob(["GIF89a"], { type: "image/gif" }))).toBe("wrong_type");
    expect(await checkAvatarFile(new Blob(["RIFF....WEBP"], { type: "image/webp" }))).toBe("wrong_type");
    expect(await checkAvatarFile(new Blob(["just some text"], { type: "image/png" }))).toBe("not_image");
  });
});
