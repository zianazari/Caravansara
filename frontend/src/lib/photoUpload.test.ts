import { vi } from "vitest";

const POST = vi.fn();
vi.mock("@/api/client", () => ({ api: { POST: (...a: unknown[]) => POST(...a) } }));

import { uploadAll, uploadPhoto } from "./photoUpload";

/** A stand-in XMLHttpRequest the test drives: progress, then a status. */
class FakeXhr {
  static last: FakeXhr;
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } =
    {
      onprogress: null,
    };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  sent: FormData | null = null;
  url = "";
  constructor() {
    FakeXhr.last = this;
  }
  open(_method: string, url: string) {
    this.url = url;
  }
  send(form: FormData) {
    this.sent = form;
  }
  abort() {
    this.onabort?.();
  }
  finish(status: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
    this.status = status;
    this.onload?.();
  }
}

const photo = { file: new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" }), room_tag: "Bedroom" };
const signed = {
  storage_key: "listings/4/x.jpg",
  url: "http://storage/media",
  fields: { key: "listings/4/x.jpg", policy: "p" },
  expires_in: 600,
};

describe("photo upload (specs/008-host-pages, research R3, R4)", () => {
  beforeEach(() => POST.mockReset());

  it("asks for a URL, sends the file to storage with progress, then registers it with its size", async () => {
    POST.mockResolvedValueOnce({ data: signed }).mockResolvedValueOnce({ data: { id: 9 } });
    const progress: number[] = [];
    const done = uploadPhoto(4, photo, {
      onProgress: (f) => progress.push(f),
      makeXhr: () => new FakeXhr() as unknown as XMLHttpRequest,
      measureFile: async () => ({ width: 800, height: 600 }),
    });
    await vi.waitFor(() => expect(FakeXhr.last?.sent).toBeTruthy());
    expect(FakeXhr.last.url).toBe("http://storage/media");
    expect([...FakeXhr.last.sent!.keys()]).toEqual(["key", "policy", "file"]); // the file last
    FakeXhr.last.finish(204);
    expect(await done).toEqual({ id: 9 });
    expect(progress).toEqual([0.5, 1]);
    expect(POST).toHaveBeenNthCalledWith(1, "/api/v1/listings/{listing_id}/photos/upload-url", {
      params: { path: { listing_id: 4 } },
      body: { content_type: "image/jpeg" },
    });
    expect(POST).toHaveBeenNthCalledWith(2, "/api/v1/listings/{listing_id}/photos", {
      params: { path: { listing_id: 4 } },
      body: { storage_key: "listings/4/x.jpg", width: 800, height: 600, room_tag: "Bedroom", caption: null },
    });
  });

  it("never registers a photo whose upload failed", async () => {
    POST.mockResolvedValueOnce({ data: signed });
    const done = uploadPhoto(4, photo, {
      makeXhr: () => new FakeXhr() as unknown as XMLHttpRequest,
      measureFile: async () => ({ width: 1, height: 1 }),
    });
    await vi.waitFor(() => expect(FakeXhr.last?.sent).toBeTruthy());
    FakeXhr.last.finish(400);
    await expect(done).rejects.toThrow("storage 400");
    expect(POST).toHaveBeenCalledTimes(1);
  });

  it("stops when asked", async () => {
    POST.mockResolvedValueOnce({ data: signed });
    const stop = new AbortController();
    const done = uploadPhoto(4, photo, {
      signal: stop.signal,
      makeXhr: () => new FakeXhr() as unknown as XMLHttpRequest,
      measureFile: async () => ({ width: 1, height: 1 }),
    });
    await vi.waitFor(() => expect(FakeXhr.last?.sent).toBeTruthy());
    stop.abort();
    await expect(done).rejects.toThrow("aborted");
  });

  it("runs two at a time, and one failure does not stop the others", async () => {
    let running = 0;
    let most = 0;
    const results = await uploadAll([1, 2, 3, 4], async (n) => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      if (n === 2) throw new Error("no");
      return n * 10;
    });
    expect(most).toBe(2);
    expect(results.map((r) => r.ok)).toEqual([true, false, true, true]);
    expect(results[0]).toEqual({ ok: true, value: 10 });
  });
});
