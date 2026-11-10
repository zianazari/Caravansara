/**
 * Checks a chosen picture before any upload, so the message comes at once and a bad file is not sent at all
 * (specs/008-host-pages, FR-006, research R5; 005 FR-038 for profile pictures). One rule in one place: the
 * size, the declared type, and the file's real first bytes, since a name or a declared type proves nothing.
 * The API checks again and stays the final word.
 */
export type ImageProblem = "too_large" | "wrong_type" | "not_image";

/** Listing photos: the API's limit (CARAVANSARA_MAX_PHOTO_BYTES) and types (ImageType). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x),
  // RIFF, a 4-byte size, then WEBP: a WAV sound is RIFF too, so the second word matters.
  "image/webp": (b) => text(b, 0, 4) === "RIFF" && text(b, 8, 12) === "WEBP",
  // AVIF (feature 023): an ISO-BMFF "ftyp" box whose major or compatible brands include avif or avis. HEIC
  // photos have the same box with other brands (heic, mif1 alone), so the brand is what tells them apart.
  "image/avif": (b) =>
    text(b, 4, 8) === "ftyp" && ftypBrands(b).some((brand) => brand === "avif" || brand === "avis"),
};

/** The major brand and the compatible brands of an ftyp box at the start of the file, as far as was read. */
function ftypBrands(b: Uint8Array): string[] {
  const size = ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;
  const brands = [text(b, 8, 12)];
  for (let at = 16; at + 4 <= Math.min(size, b.length); at += 4) brands.push(text(b, at, at + 4));
  return brands;
}

function text(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to));
}

export async function checkImageFile(
  file: Blob,
  { maxBytes, types }: { maxBytes: number; types: readonly string[] },
): Promise<ImageProblem | null> {
  if (file.size > maxBytes) return "too_large";
  if (!types.includes(file.type)) return "wrong_type";
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer()); // 64: room for AVIF's brand list
  // Any allowed format will do: some editors save a PNG with a .jpg type, and the API reads the content too.
  return types.some((t) => SIGNATURES[t]?.(head)) ? null : "not_image";
}

export function checkPhotoFile(file: Blob): Promise<ImageProblem | null> {
  return checkImageFile(file, { maxBytes: MAX_PHOTO_BYTES, types: PHOTO_TYPES });
}
