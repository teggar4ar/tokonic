"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { createProductAction, updateProductAction } from "@/actions/products";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { productCreateSchema, type ProductCreateInput } from "@/lib/validation/products";

const fieldMessages: Record<keyof ProductCreateInput, string> = {
  name: "Nama produk wajib diisi, maksimal 255 karakter.",
  slug: "Slug hanya boleh huruf kecil, angka, dan tanda hubung, contohnya kopi-arabika.",
  description: "Deskripsi produk tidak valid.",
  price: "Harga harus bilangan bulat rupiah, minimal 0.",
  stock: "Stok harus bilangan bulat, minimal 0.",
  weightGrams: "Berat harus bilangan bulat gram, minimal 1.",
  isPublished: "Status tayang tidak valid.",
};

type ProductFormProps =
  | { mode: "create"; product?: undefined }
  | { mode: "edit"; product: ProductCreateInput & { id: string } };

export function ProductForm({ mode, product }: ProductFormProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateSchema),
    defaultValues:
      mode === "edit"
        ? {
            name: product.name,
            slug: product.slug,
            description: product.description,
            price: product.price,
            stock: product.stock,
            weightGrams: product.weightGrams,
            isPublished: product.isPublished,
          }
        : {
            name: "",
            slug: "",
            description: "",
            price: 0,
            stock: 0,
            weightGrams: 1,
            isPublished: false,
          },
  });

  async function submit(values: ProductCreateInput) {
    setFeedback(null);

    try {
      const result =
        mode === "edit"
          ? await updateProductAction({ id: product.id, previousSlug: product.slug, ...values })
          : await createProductAction(values);

      if (!result.ok) {
        setFeedback({ kind: "error", message: result.error.message });
        return;
      }

      if (mode === "create") {
        router.push(`/admin/produk/${result.data.id}`);
        return;
      }

      setFeedback({ kind: "success", message: "Perubahan produk berhasil disimpan." });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "Produk belum berhasil disimpan. Coba lagi." });
    }
  }

  function fieldError(field: keyof ProductCreateInput) {
    if (!errors[field]) return null;
    return (
      <p id={`${field}-error`} className="text-sm text-destructive" role="alert">
        {fieldMessages[field]}
      </p>
    );
  }

  function fieldProps(field: keyof ProductCreateInput) {
    return {
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": errors[field] ? `${field}-error` : undefined,
    } as const;
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-8" noValidate>
      <section className="grid gap-4 border-b border-border pb-8">
        <div>
          <h2 className="text-lg font-semibold">Informasi produk</h2>
          <p className="mt-1 text-sm text-muted-foreground">Nama, alamat halaman, dan deskripsi yang dilihat pembeli.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="name">Nama produk</Label>
          <Input id="name" maxLength={255} {...fieldProps("name")} {...register("name")} />
          {fieldError("name")}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="slug">Slug halaman</Label>
          <Input id="slug" placeholder="kopi-arabika" {...fieldProps("slug")} {...register("slug")} />
          <p className="text-xs text-muted-foreground">Menjadi alamat halaman produk, misalnya /produk/kopi-arabika.</p>
          {fieldError("slug")}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Deskripsi</Label>
          <Textarea id="description" rows={5} {...fieldProps("description")} {...register("description")} />
          {fieldError("description")}
        </div>
      </section>

      <section className="grid gap-4 border-b border-border pb-8">
        <div>
          <h2 className="text-lg font-semibold">Harga dan persediaan</h2>
          <p className="mt-1 text-sm text-muted-foreground">Semua nilai berupa bilangan bulat.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="price">Harga (Rp)</Label>
            <Input
              id="price"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className="tabular-nums"
              {...fieldProps("price")}
              {...register("price", { valueAsNumber: true })}
            />
            {fieldError("price")}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="stock">Stok</Label>
            <Input
              id="stock"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className="tabular-nums"
              {...fieldProps("stock")}
              {...register("stock", { valueAsNumber: true })}
            />
            {fieldError("stock")}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="weightGrams">Berat (gram)</Label>
            <Input
              id="weightGrams"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className="tabular-nums"
              {...fieldProps("weightGrams")}
              {...register("weightGrams", { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">Dipakai untuk menghitung ongkos kirim.</p>
            {fieldError("weightGrams")}
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-start gap-3">
          <Controller
            control={control}
            name="isPublished"
            render={({ field }) => (
              <Checkbox
                id="isPublished"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
              />
            )}
          />
          <div className="grid gap-1">
            <Label htmlFor="isPublished">Tayangkan di katalog</Label>
            <p className="text-sm text-muted-foreground">
              Produk yang tayang bisa dilihat dan dibeli pembeli. Nonaktifkan untuk menyembunyikannya tanpa menghapus data.
            </p>
          </div>
        </div>
        {fieldError("isPublished")}
      </section>

      {feedback ? (
        <p
          className={`flex items-center gap-2 text-sm font-medium ${feedback.kind === "error" ? "text-destructive" : "text-success"}`}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.kind === "error" ? (
            <ExclamationTriangleIcon className="size-5 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircleIcon className="size-5 shrink-0" aria-hidden="true" />
          )}
          {feedback.message}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan..." : mode === "create" ? "Simpan produk" : "Simpan perubahan"}
        </Button>
      </div>
    </form>
  );
}
