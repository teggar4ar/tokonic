"use client";

import { useState } from "react";
import { registerProductImageAction, removeProductImageAction, replaceProductImageAction } from "../../actions/product-images";
import { buildProductImagePath } from "../../lib/image";
import { prepareProductImage } from "../../lib/browser-image";
import { createClient } from "../../lib/supabase/browser";
import { productImageBucket } from "../../lib/validation/product-images";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function ProductImageManager({ productId, images }: { productId: string; images: Array<{ id: string; objectPath: string; displayOrder: number }> }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(file: File, image?: { id: string; displayOrder: number }) {
    setBusy(true);
    setMessage("");
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
      setMessage("Gambar berhasil disimpan.");
      if ("warning" in result) setMessage("Gambar berhasil diganti. Gambar lama perlu dibersihkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operasi gambar gagal.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-4">
    {images.length < 5 && <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />}
    {images.map((image) => <div key={image.id} className="flex items-center gap-2">
      <Input aria-label={`Ganti gambar ${image.displayOrder + 1}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, image); }} />
      <Button type="button" disabled={busy} onClick={async () => { setBusy(true); const result = await removeProductImageAction(image.id); setMessage(result.ok ? "Gambar berhasil dihapus." : result.error.message); setBusy(false); }}>Hapus</Button>
    </div>)}
    {message && <p role="status">{message}</p>}
  </div>;
}
