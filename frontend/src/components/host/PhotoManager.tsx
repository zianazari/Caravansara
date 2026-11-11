"use client";

import { ImagePlusIcon, RotateCwIcon, StarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { components } from "@/api/schema";
import { api } from "@/api/client";
import { ArchFrame } from "@/components/brand/ArchFrame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { MAX_PHOTO_BYTES, PHOTO_TYPES, checkPhotoFile } from "@/lib/imageCheck";
import { MIN_PHOTOS } from "@/lib/listingStatus";
import { uploadAll, uploadPhoto } from "@/lib/photoUpload";
import { needsReview, type PhotoChange } from "@/lib/reviewFields";
import { ReviewWarningDialog } from "./ReviewWarningDialog";
import { Input } from "@/components/ui/input";

type PhotoOut = components["schemas"]["PhotoOut"];

/** A photo on its way: chosen, checked, then sent (data-model, "Photo upload item"). Lives in the page only. */
export type DraftPhoto = {
  key: string;
  file: File;
  preview: string;
  room_tag: string;
  caption: string;
  status: "queued" | "uploading" | "registered" | "failed";
  progress: number;
  /** The API's id once registered. */
  photo_id?: number;
};

export function draftPhoto(file: File): DraftPhoto {
  return {
    key: crypto.randomUUID(),
    file,
    preview: URL.createObjectURL(file),
    room_tag: "",
    caption: "",
    status: "queued",
    progress: 0,
  };
}

/** Moves item `from` to `to`, returning a new array. */
export function moved<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item!);
  return next;
}

/**
 * The file picker with the check of lib/imageCheck.ts (FR-006): files that break a rule are listed with the
 * reason and never sent; the rest are passed on.
 */
function PhotoPicker({ onFiles }: { onFiles: (files: File[]) => void }) {
  const t = useTranslations("photos");
  const [rejected, setRejected] = useState<string[]>([]);
  async function choose(list: FileList | null) {
    const files = [...(list ?? [])];
    const problems = await Promise.all(files.map((f) => checkPhotoFile(f)));
    setRejected(
      files.flatMap((f, i) =>
        problems[i] ? [t("rejectedFile", { name: f.name, reason: t(problems[i]!) })] : [],
      ),
    );
    const good = files.filter((_, i) => !problems[i]);
    if (good.length) onFiles(good);
  }
  return (
    <div className="grid gap-2">
      <Button asChild variant="outline" className="w-fit cursor-pointer rounded-full font-semibold">
        <label>
          <ImagePlusIcon aria-hidden />
          {t("choose")}
          <input
            type="file"
            multiple
            accept={PHOTO_TYPES.join(",")}
            data-max-bytes={MAX_PHOTO_BYTES}
            className="sr-only"
            onChange={(e) => {
              void choose(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </Button>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {rejected.length ? (
        <ul role="alert" className="grid gap-1 text-sm text-destructive">
          {rejected.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * One photo: the picture in the arch, its place and the buttons to move it, make it the cover or remove it, its
 * room label and caption. It is also a drop target: a photo dragged onto it takes its place (research R14, with
 * Pointer Events, no library). The buttons do the same for the keyboard and screen readers (FR-007).
 */
function PhotoTile({
  index,
  count,
  src,
  roomTag,
  caption,
  onLabel,
  onMove,
  onRemove,
  canRemove,
  dragging,
  onDragStart,
  onDrop,
  children,
}: {
  index: number;
  count: number;
  src: string;
  roomTag: string;
  caption: string;
  onLabel: (room_tag: string, caption: string) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  canRemove: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations("photos");
  const [tag, setTag] = useState(roomTag);
  const [text, setText] = useState(caption);
  return (
    // The <li> stays a plain list item; the group with the photo's name is inside it (a role on the <li> itself
    // would break the list for screen readers).
    <li>
      <div
        role="group"
        aria-label={t("photo", { index: index + 1 })}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button, input, label")) return;
          onDragStart();
        }}
        onPointerUp={onDrop}
        className={cn(
          "grid touch-none content-start gap-2 rounded-2xl border bg-card p-2",
          dragging && "opacity-60",
        )}
      >
        <ArchFrame src={src} alt="" sizes="200px" className="aspect-[1/0.9]">
          {index === 0 ? (
            <span className="absolute start-2 bottom-2 flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs font-bold">
              <StarIcon className="size-3 fill-current" aria-hidden />
              {t("cover")}
            </span>
          ) : null}
        </ArchFrame>
        {children}
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            {t("earlier")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
          >
            {t("later")}
          </Button>
          {index > 0 ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onMove(0)}>
              {t("makeCover")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={!canRemove}
            onClick={onRemove}
          >
            {t("remove")}
          </Button>
        </div>
        <label className="grid gap-1 text-sm">
          {t("roomTag")}
          <Input
            value={tag}
            maxLength={50}
            onChange={(e) => setTag(e.target.value)}
            className="h-10 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          {t("caption")}
          <Input
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            className="h-10 text-sm"
          />
        </label>
        {tag !== roomTag || text !== caption ? (
          <Button type="button" size="sm" className="justify-self-start" onClick={() => onLabel(tag, text)}>
            {t("saveDetails")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The photos of a listing that exists (specs/008-host-pages, US2): add with progress, reorder by dragging or
 * with buttons, make a cover, label and remove. A listing keeps at least 3 photos (owner decision Q1; a rule of
 * the site only, research R9). On an approved listing, a new photo or a new label first asks the host, because
 * it hides the listing until it is reviewed again; reordering and removing never do (R8).
 */
export function PhotoManager({
  listingId,
  photos,
  reviewStatus,
  onChange,
}: {
  listingId: number;
  photos: PhotoOut[];
  reviewStatus: string;
  onChange: () => void;
}) {
  const t = useTranslations();
  const sorted = [...photos].sort((a, b) => a.sort_order - b.sort_order);
  // A reorder is shown at once, before the server answers; it holds only for the list it was made on. When
  // the listing is read again (a new photo, a removal, the saved order), the server's list is shown, so a
  // photo added after a reorder is never left out.
  const basis = sorted.map((p) => `${p.id}:${p.sort_order}`).join(",");
  const [order, setLocalOrder] = useState<{ basis: string; ids: number[] } | null>(null);
  const setOrder = (ids: number[] | null) => setLocalOrder(ids ? { basis, ids } : null);
  const shown =
    order && order.basis === basis
      ? order.ids.map((id) => sorted.find((p) => p.id === id)!).filter(Boolean)
      : sorted;
  const [pending, setPending] = useState<DraftPhoto[]>([]);
  const [confirm, setConfirm] = useState<{ change: PhotoChange; run: () => void } | null>(null);
  const [removing, setRemoving] = useState<PhotoOut | null>(null);
  const drag = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const path = { listing_id: listingId };

  function guarded(change: PhotoChange, run: () => void) {
    if (needsReview(reviewStatus, {}, {}, change)) setConfirm({ change, run });
    else run();
  }

  async function send(items: DraftPhoto[]) {
    setPending((now) => [...now.filter((p) => !items.some((i) => i.key === p.key)), ...items]);
    const update = (key: string, patch: Partial<DraftPhoto>) =>
      setPending((now) => now.map((p) => (p.key === key ? { ...p, ...patch } : p)));
    const results = await uploadAll(items, (item) => {
      update(item.key, { status: "uploading", progress: 0 });
      return uploadPhoto(listingId, item, { onProgress: (progress) => update(item.key, { progress }) });
    });
    results.forEach((r, i) =>
      r.ok
        ? setPending((now) => now.filter((p) => p.key !== items[i]!.key))
        : update(items[i]!.key, { status: "failed" }),
    );
    onChange();
  }

  async function reorder(ids: number[]) {
    setOrder(ids);
    const { error } = await api.PUT("/api/v1/listings/{listing_id}/photos/order", {
      params: { path },
      body: { photo_ids: ids },
    });
    if (error) setOrder(null);
    onChange();
  }

  function move(from: number, to: number) {
    if (from === to) return;
    void reorder(moved(shown, from, to).map((p) => p.id));
  }

  async function label(photo: PhotoOut, room_tag: string, caption: string) {
    await api.PATCH("/api/v1/listings/{listing_id}/photos/{photo_id}", {
      params: { path: { ...path, photo_id: photo.id } },
      body: { room_tag: room_tag.trim() || null, caption: caption.trim() || null },
    });
    onChange();
  }

  async function remove(photo: PhotoOut) {
    setRemoving(null);
    await api.DELETE("/api/v1/listings/{listing_id}/photos/{photo_id}", {
      params: { path: { ...path, photo_id: photo.id } },
    });
    toast.success(t("photos.removed"));
    onChange();
  }

  const canRemove = shown.length > MIN_PHOTOS;
  return (
    <section className="grid gap-4" aria-label={t("host.tab_photos")}>
      <PhotoPicker onFiles={(files) => guarded("photo_added", () => void send(files.map(draftPhoto)))} />
      <p className="text-sm text-muted-foreground">{t("photos.reorderHint")}</p>
      {!canRemove ? <p className="text-sm text-muted-foreground">{t("photos.cannotRemove")}</p> : null}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p, i) => (
          <PhotoTile
            key={p.id}
            index={i}
            count={shown.length}
            src={p.url}
            roomTag={p.room_tag ?? ""}
            caption={p.caption ?? ""}
            canRemove={canRemove}
            dragging={dragging === i}
            onDragStart={() => {
              drag.current = i;
              setDragging(i);
            }}
            onDrop={() => {
              if (drag.current !== null) move(drag.current, i);
              drag.current = null;
              setDragging(null);
            }}
            onMove={(to) => move(i, to)}
            onRemove={() => setRemoving(p)}
            onLabel={(tag, caption) => guarded("photo_labelled", () => void label(p, tag, caption))}
          />
        ))}
      </ul>
      {pending.length ? (
        <ul className="grid gap-2">
          {pending.map((p) => (
            <li key={p.key} className="flex items-center gap-3 rounded-xl border bg-card p-2 text-sm">
              <ArchFrame src={p.preview} alt="" className="h-14 w-12 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{p.file.name}</span>
              <UploadState photo={p} onRetry={() => void send([{ ...p, status: "queued", progress: 0 }])} />
            </li>
          ))}
        </ul>
      ) : null}
      <ReviewWarningDialog
        open={confirm !== null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const run = confirm?.run;
          setConfirm(null);
          run?.();
        }}
      />
      <Dialog open={removing !== null} onOpenChange={(open) => (open ? undefined : setRemoving(null))}>
        <DialogContent closeLabel={t("common.close")}>
          <DialogTitle>{t("photos.removeConfirm")}</DialogTitle>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRemoving(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={() => removing && void remove(removing)}>
              {t("photos.remove")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Progress, waiting, or a failure with "try again", for one photo on its way. */
export function UploadState({ photo, onRetry }: { photo: DraftPhoto; onRetry?: () => void }) {
  const t = useTranslations();
  if (photo.status === "failed") {
    return (
      <span className="flex items-center gap-2 text-destructive">
        {t("photos.failed")}
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RotateCwIcon className="size-3.5" aria-hidden />
            {t("common.retry")}
          </Button>
        ) : null}
      </span>
    );
  }
  if (photo.status === "uploading") {
    const percent = Math.round(photo.progress * 100);
    return (
      <span className="grid w-36 gap-1">
        <span className="text-xs">{t("photos.uploading", { percent })}</span>
        <span
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={photo.file.name}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <span className="block h-full bg-primary" style={{ width: `${percent}%` }} />
        </span>
      </span>
    );
  }
  if (photo.status === "registered") return null;
  return <span className="text-xs text-muted-foreground">{t("photos.queued")}</span>;
}

/**
 * The photos of a listing still being made (the wizard's last step): chosen and checked here, kept in the page,
 * and only sent after the listing is created (research R3). The same tiles as above, without the API.
 */
export function DraftPhotos({
  items,
  onItems,
  onRetry,
}: {
  items: DraftPhoto[];
  onItems: (items: DraftPhoto[]) => void;
  /** Sends the photos that failed again, after the listing was made (research R3). */
  onRetry?: () => void;
}) {
  const t = useTranslations("photos");
  const drag = useRef<number | null>(null);
  return (
    <div className="grid gap-4">
      <PhotoPicker onFiles={(files) => onItems([...items, ...files.map(draftPhoto)])} />
      <p className="text-sm text-muted-foreground">
        {t("count", { count: items.length })} · {t("reorderHint")}
      </p>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <PhotoTile
            key={item.key}
            index={i}
            count={items.length}
            src={item.preview}
            roomTag={item.room_tag}
            caption={item.caption}
            canRemove={item.status !== "registered" && item.status !== "uploading"}
            dragging={false}
            onDragStart={() => (drag.current = i)}
            onDrop={() => {
              if (drag.current !== null && drag.current !== i) onItems(moved(items, drag.current, i));
              drag.current = null;
            }}
            onMove={(to) => onItems(moved(items, i, to))}
            onRemove={() => {
              URL.revokeObjectURL(item.preview);
              onItems(items.filter((x) => x.key !== item.key));
            }}
            onLabel={(room_tag, caption) =>
              onItems(items.map((x) => (x.key === item.key ? { ...x, room_tag, caption } : x)))
            }
          >
            {item.status !== "queued" ? (
              <UploadState photo={item} onRetry={item.status === "failed" ? onRetry : undefined} />
            ) : null}
          </PhotoTile>
        ))}
      </ul>
    </div>
  );
}
