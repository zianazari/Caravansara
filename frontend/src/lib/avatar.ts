import { mediaBaseUrl } from "./env";
import { checkImageFile, type ImageProblem } from "./imageCheck";

/**
 * Profile pictures (FR-037 to FR-041, research R20; data-model, "Avatar").
 *
 * A user without an uploaded picture gets a default avatar: the first letter of their name on a colour fixed
 * by their id. It is drawn on the site and never stored, so it needs no storage and no migration.
 */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // owner decision, 2026-11-08 (5 MB)
export const AVATAR_TYPES = ["image/png", "image/jpeg"] as const;

/** Eight dark colours; white text on each has a contrast of at least 4.5:1 (WCAG AA, tested). */
export const AVATAR_PALETTE = [
  "#9a3412",
  "#9f1239",
  "#6b21a8",
  "#1e40af",
  "#115e59",
  "#166534",
  "#854d0e",
  "#3f3f46",
] as const;

export function avatarColor(userId: number): string {
  return AVATAR_PALETTE[Math.abs(userId) % AVATAR_PALETTE.length]!;
}

/** The first letter of a name as a reader sees it (a whole grapheme, so "آ" stays one letter). */
export function initialOf(fullName: string): string {
  const name = fullName.trim();
  if (!name) return "?";
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const first = segmenter.segment(name)[Symbol.iterator]().next().value?.segment ?? "?";
  return first.toLocaleUpperCase();
}

/**
 * Only pictures in the system's own storage are shown (FR-041). An older address on another server, which
 * the API no longer accepts, gets the default avatar, so no viewer's browser ever asks that server.
 */
export function isOwnMediaUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && url.startsWith(`${mediaBaseUrl}/avatars/`);
}

export type AvatarFileProblem = ImageProblem;

/**
 * Checks a chosen file before any upload, so the message comes at once (FR-038). The server checks the same
 * rules again and stays the final word: size, declared type, and the file's real first bytes. The check
 * itself is shared with listing photos (lib/imageCheck.ts, specs/008-host-pages).
 */
export function checkAvatarFile(file: Blob): Promise<AvatarFileProblem | null> {
  return checkImageFile(file, { maxBytes: MAX_AVATAR_BYTES, types: AVATAR_TYPES });
}
