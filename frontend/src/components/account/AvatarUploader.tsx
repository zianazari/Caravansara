"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import type { components } from "@/api/schema";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { AVATAR_TYPES, checkAvatarFile, isOwnMediaUrl } from "@/lib/avatar";
import { errorMessage, type Translate } from "@/lib/errors";
import { UserAvatar } from "./UserAvatar";

type User = components["schemas"]["UserOut"];

/**
 * Upload, replace or remove the profile picture (US2/AC10 to AC12, FR-038, FR-039). The file is checked here
 * first (size, type, real first bytes), so a wrong file gets a message before anything is sent. Saving takes
 * three steps: an upload address from the API, the file straight to storage, then PUT /me/avatar. If any step
 * fails, the current picture stays.
 */
export function AvatarUploader({ user }: { user: User }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The preview is a blob: address of the chosen file; it is freed when replaced and when leaving the page.
  const previewRef = useRef<string | null>(null);
  function showPreview(next: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next ? URL.createObjectURL(next) : null;
    setPreview(previewRef.current);
  }
  useEffect(() => () => showPreviewCleanup(previewRef), []);

  async function choose(chosen: File | undefined) {
    setFile(null);
    showPreview(null);
    setProblem(null);
    if (!chosen) return;
    const issue = await checkAvatarFile(chosen);
    if (issue) {
      setProblem(t(`account.${issue}`));
    } else {
      setFile(chosen);
      showPreview(chosen);
    }
  }

  function done(next: User, message: string) {
    queryClient.setQueryData(["me"], next);
    setFile(null);
    showPreview(null);
    toast.success(message);
  }

  async function save() {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      // One request with the file itself: the API checks its size, type and content before anything is stored,
      // so a file that breaks the rules never reaches storage (specs/006-avatar-upload-via-api). The check above
      // still runs first, so the message comes at once and a bad file is not sent at all (FR-008).
      const result = await api.PUT("/api/v1/me/avatar", {
        body: file as unknown as string,
        bodySerializer: (body: unknown) => body as BodyInit,
        headers: { "content-type": file.type },
      });
      if (!result.data) throw result.error;
      done(result.data, t("account.pictureSaved"));
    } catch (error) {
      setProblem(errorMessage(t as unknown as Translate, error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setProblem(null);
    const result = await api.DELETE("/api/v1/me/avatar");
    setBusy(false);
    if (result.data) done(result.data, t("account.pictureRemoved"));
    else setProblem(errorMessage(t as unknown as Translate, result.error));
  }

  return (
    <section aria-labelledby={`${inputId}-title`} className="grid gap-3">
      <h2 id={`${inputId}-title`} className="text-lg font-semibold">
        {t("account.picture")}
      </h2>
      <div className="flex flex-wrap items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview (blob:) of the chosen file
          <img src={preview} alt={t("account.preview")} className="size-24 rounded-full object-cover" />
        ) : (
          <UserAvatar user={user} size="lg" />
        )}
        <div className="grid gap-2">
          <label
            htmlFor={inputId}
            className="cursor-pointer rounded-lg border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            {t("account.choosePicture")}
          </label>
          <input
            id={inputId}
            type="file"
            accept={AVATAR_TYPES.join(",")}
            className="sr-only"
            aria-describedby={`${inputId}-hint`}
            onChange={(event) => void choose(event.target.files?.[0])}
          />
          <p id={`${inputId}-hint`} className="text-sm text-muted-foreground">
            {t("account.pictureHint")}
          </p>
        </div>
      </div>
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {file ? (
          <Button onClick={save} disabled={busy}>
            {busy ? t("account.uploading") : t("account.savePicture")}
          </Button>
        ) : null}
        {!file && isOwnMediaUrl(user.avatar_url) ? (
          <Button variant="outline" onClick={remove} disabled={busy}>
            {t("account.removePicture")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function showPreviewCleanup(ref: RefObject<string | null>) {
  if (ref.current) URL.revokeObjectURL(ref.current);
}
