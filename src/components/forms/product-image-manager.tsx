"use client";

import { useRef, useState } from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { registerProductImageAction, removeProductImageAction, replaceProductImageAction } from "@/actions/product-images";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Button } from "@/components/ui/button";
import { buildProductImagePath } from "@/lib/image";
import { prepareProductImage } from "@/lib/browser-image";
import { createClient } from "@/lib/supabase/browser";
import { productImageBucket, productImageMaximumCount } from "@/lib/validation/product-images";

type ProductImage = { id: string; objectPath: string; displayOrder: number };

type Feedback = { kind: "success" | "warning" | "error"; message: string };

const acceptedTypes = "image/jpeg,image/png,image/webp";

function publicImageUrl(objectPath: string) {
  return createClient().storage.from(productImageBucket).getPublicUrl(objectPath).data.publicUrl;
}

export function ProductImageManager({ productId, images }: { productId: string; images: ProductImage[] }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRefs = useRef(new Map<string, HTMLInputElement>());

  async function upload(file: File, image?: { id: string; displayOrder: number }) {
    setBusy(true);
    setFeedback(null);
    let path = "";
    try {
      const prepared = await prepareProductImage(file);
      path = buildProductImagePath(productId, crypto.randomUUID(), prepared.mimeType);
      const supabase = createClient();
      const { error } = await supabase.storage.from(productImageBucket).upload(path, prepared.file, { contentType: prepared.mimeType, upsert: false });
      if (error) throw new Error("Unggah gambar gagal.");
      const result = image
        ? await replaceProductImageAction({ imageId: image.id, objectPath: path, mimeType: prepared.mimeType, byteSize: prepared.byteSize, width: prepared.width, height: prepared.height })
        : await registerProductImageAction({ productId, objectPath: path, mimeType: prepared.mimeType, byteSize: prepared.byteSize, width: prepared.width, height: prepared.height, displayOrder: images.length });
      if (!result.ok) {
        await supabase.storage.from(productImageBucket).remove([path]);
        throw new Error(result.error.message);
      }
      if ("warning" in result) {
        setFeedback({ kind: "warning", message: "Gambar berhasil diganti, tetapi gambar lama perlu dibersihkan." });
      } else {
        setFeedback({ kind: "success", message: image ? "Gambar berhasil diganti." : "Gambar berhasil disimpan." });
      }
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Operasi gambar gagal. Coba lagi." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(image: ProductImage) {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await removeProductImageAction(image.id);
      setFeedback(
        result.ok
          ? { kind: "success", message: `Gambar ${image.displayOrder + 1} berhasil dihapus.` }
          : { kind: "error", message: result.error.message },
      );
    } catch {
      setFeedback({ kind: "error", message: "Gambar belum berhasil dihapus. Coba lagi." });
    } finally {
      setBusy(false);
    }
  }

  const remainingSlots = productImageMaximumCount - images.length;

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Maksimal {productImageMaximumCount} gambar berformat JPEG, PNG, atau WebP. Gambar dikompresi otomatis hingga
        maksimal 2 MB. Gambar pertama menjadi gambar utama katalog.
      </p>

      {feedback ? (
        <Alert variant={feedback.kind === "success" ? "success" : feedback.kind === "warning" ? "warning" : "destructive"}>
          {feedback.kind === "success" ? (
            <CheckCircleIcon aria-hidden="true" />
          ) : (
            <ExclamationTriangleIcon aria-hidden="true" />
          )}
          <AlertTitle>{feedback.message}</AlertTitle>
          {feedback.kind === "error" ? <AlertDescription>Periksa kembali lalu coba lagi.</AlertDescription> : null}
        </Alert>
      ) : null}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {images.map((image) => (
          <li key={image.id} className="grid content-start gap-2">
            <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL outside next/image remotePatterns */}
              <img
                src={publicImageUrl(image.objectPath)}
                alt={`Gambar produk ${image.displayOrder + 1}`}
                className="size-full object-cover"
                loading="lazy"
              />
              <span className="absolute left-2 top-2 rounded-md bg-primary/80 px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {image.displayOrder === 0 ? "Utama" : `Gambar ${image.displayOrder + 1}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <input
                ref={(element) => {
                  if (element) replaceInputRefs.current.set(image.id, element);
                  else replaceInputRefs.current.delete(image.id);
                }}
                type="file"
                accept={acceptedTypes}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void upload(file, image);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={() => replaceInputRefs.current.get(image.id)?.click()}
              >
                <ArrowPathIcon className="size-4" aria-hidden="true" />
                Ganti
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={busy}
                aria-label={`Hapus gambar ${image.displayOrder + 1}`}
                onClick={() => void remove(image)}
              >
                <TrashIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}

        {remainingSlots > 0 ? (
          <li>
            <input
              ref={addInputRef}
              type="file"
              accept={acceptedTypes}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => addInputRef.current?.click()}
              className="grid aspect-square w-full place-content-center justify-items-center gap-2 rounded-lg border border-dashed border-border bg-surface text-muted-foreground transition-colors outline-none hover:border-accent hover:text-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            >
              {busy ? (
                <ArrowPathIcon className="size-6 animate-spin" aria-hidden="true" />
              ) : (
                <PlusIcon className="size-6" aria-hidden="true" />
              )}
              <span className="text-sm font-medium">{busy ? "Memproses..." : "Tambah gambar"}</span>
              <span className="text-xs">{remainingSlots} slot tersisa</span>
            </button>
          </li>
        ) : null}
      </ul>

      {images.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <PhotoIcon className="size-5 shrink-0" aria-hidden="true" />
          Belum ada gambar. Produk tanpa gambar tetap bisa tayang, tetapi gambar membantu pembeli percaya.
        </p>
      ) : null}
    </div>
  );
}
