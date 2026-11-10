import type { components } from "@/api/schema";
import { api } from "@/api/client";

type PhotoOut = components["schemas"]["PhotoOut"];
type Signed = components["schemas"]["UploadUrlOut"];

export type PhotoInput = { file: File; room_tag?: string | null; caption?: string | null };

/** Width and height of a picture, which the API needs with every photo (PhotoCreate). */
export async function measure(file: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/**
 * The file straight to storage with the presigned POST (constitution 1.4.0: listing photos never pass through
 * the API). XMLHttpRequest, not fetch: fetch still cannot report upload progress, and a progress bar for each
 * photo is part of the spec (FR-006, research R4). No new dependency.
 */
export function postToStorage(
  signed: Signed,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
  makeXhr: () => XMLHttpRequest = () => new XMLHttpRequest(),
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = makeXhr();
    const form = new FormData();
    for (const [key, value] of Object.entries(signed.fields)) form.append(key, value);
    form.append("file", file); // the file must be the last field of a presigned POST
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`storage ${xhr.status}`));
    xhr.onerror = () => reject(new Error("storage unreachable"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.open("POST", signed.url);
    xhr.send(form);
  });
}

/**
 * One photo onto a listing, in the API's three steps: an upload URL, the file to storage, then registering it
 * with its size, room label and caption (specs/008-host-pages, research R3). A photo whose upload did not finish
 * is never registered, so it never appears in the listing (Edge Cases).
 */
export async function uploadPhoto(
  listingId: number,
  photo: PhotoInput,
  {
    onProgress = () => {},
    signal,
    makeXhr,
    measureFile = measure,
  }: {
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
    makeXhr?: () => XMLHttpRequest;
    measureFile?: (file: Blob) => Promise<{ width: number; height: number }>;
  } = {},
): Promise<PhotoOut> {
  const path = { params: { path: { listing_id: listingId } } };
  const signed = await api.POST("/api/v1/listings/{listing_id}/photos/upload-url", {
    ...path,
    body: { content_type: photo.file.type as "image/jpeg" },
  });
  if (!signed.data) throw signed.error;
  const [size] = await Promise.all([
    measureFile(photo.file),
    postToStorage(signed.data, photo.file, onProgress, signal, makeXhr),
  ]);
  const registered = await api.POST("/api/v1/listings/{listing_id}/photos", {
    ...path,
    body: {
      storage_key: signed.data.storage_key,
      width: size.width,
      height: size.height,
      room_tag: photo.room_tag || null,
      caption: photo.caption || null,
    },
  });
  if (!registered.data) throw registered.error;
  onProgress(1);
  return registered.data;
}

/** Runs `task` for every item, `concurrency` at a time; one failure does not stop the others. */
export async function uploadAll<T, R>(
  items: T[],
  task: (item: T, index: number) => Promise<R>,
  concurrency = 2,
): Promise<({ ok: true; value: R } | { ok: false; error: unknown })[]> {
  const results: ({ ok: true; value: R } | { ok: false; error: unknown })[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { ok: true, value: await task(items[index]!, index) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
