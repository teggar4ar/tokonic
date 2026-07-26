"use client";

import { useState } from "react";
import { PhotoIcon } from "@heroicons/react/24/outline";

import { publicProductImageUrl } from "@/lib/storage-url";

type ProductGalleryProps = {
  productName: string;
  imagePaths: string[];
};

export function ProductGallery({ productName, imagePaths }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activePath = imagePaths[activeIndex] ?? imagePaths[0] ?? null;

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        {activePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicProductImageUrl(activePath)}
            alt={`${productName} — gambar ${activeIndex + 1} dari ${imagePaths.length}`}
            width={960}
            height={960}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2">
            <PhotoIcon aria-hidden="true" className="size-12 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">Belum ada gambar produk</p>
          </div>
        )}
      </div>
      {imagePaths.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Pilih gambar produk">
          {imagePaths.map((path, index) => (
            <li key={path}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Tampilkan gambar ${index + 1} dari ${imagePaths.length}`}
                aria-pressed={index === activeIndex}
                className={`block size-control overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  index === activeIndex ? "border-accent" : "border-transparent hover:border-border"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={publicProductImageUrl(path)}
                  alt=""
                  width={88}
                  height={88}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
