"use client";
"use no memo";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { CheckCircleIcon, EllipsisVerticalIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { hardDeleteProductAction, unpublishProductAction } from "@/actions/products";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import { DataGrid, DataGridContainer } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRupiah } from "@/lib/money";

export type AdminProductListItem = {
  id: string;
  name: string;
  slug: string;
  priceRupiah: string;
  stock: number;
  isPublished: boolean;
};

type AdminProductListProps = {
  products: AdminProductListItem[];
};

type PendingConfirmation = {
  kind: "unpublish" | "delete";
  product: AdminProductListItem;
};

type Feedback = {
  kind: "success" | "error";
  message: string;
};

const columnHelper = createColumnHelper<AdminProductListItem>();

export function AdminProductList({ products }: AdminProductListProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [processing, setProcessing] = useState(false);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        id: "name",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Produk" />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.name}</p>
            <p className="truncate text-xs text-muted-foreground">/{row.original.slug}</p>
          </div>
        ),
        size: 280,
        meta: { headerTitle: "Produk" },
      }),
      columnHelper.accessor((row) => Number(row.priceRupiah), {
        id: "price",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Harga" className="justify-end" />,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">{formatRupiah(BigInt(row.original.priceRupiah))}</span>
        ),
        size: 140,
        meta: { headerTitle: "Harga", headerClassName: "[&>*]:w-full [&_button]:justify-end", cellClassName: "text-right" },
      }),
      columnHelper.accessor("stock", {
        id: "stock",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Stok" className="justify-end" />,
        cell: ({ row }) =>
          row.original.stock === 0 ? (
            <span className="block text-right font-medium tabular-nums text-warning-foreground">0 — habis</span>
          ) : (
            <span className="block text-right tabular-nums">{row.original.stock}</span>
          ),
        size: 110,
        meta: { headerTitle: "Stok", headerClassName: "[&>*]:w-full [&_button]:justify-end", cellClassName: "text-right" },
      }),
      columnHelper.accessor("isPublished", {
        id: "status",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
        cell: ({ row }) =>
          row.original.isPublished ? (
            <Badge variant="success-light">Tayang</Badge>
          ) : (
            <Badge variant="secondary">Nonaktif</Badge>
          ),
        size: 110,
        meta: { headerTitle: "Status" },
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Aksi produk</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="control"
                    className="w-control px-0"
                    aria-label={`Aksi untuk ${row.original.name}`}
                  />
                }
              >
                <EllipsisVerticalIcon className="size-5" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem onClick={() => router.push(`/admin/produk/${row.original.id}`)}>
                  Ubah produk
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!row.original.isPublished}
                  onClick={() => setConfirmation({ kind: "unpublish", product: row.original })}
                >
                  Nonaktifkan dari katalog
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmation({ kind: "delete", product: row.original })}
                >
                  Hapus permanen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        size: 64,
        enableSorting: false,
        meta: { headerTitle: "Aksi" },
      }),
    ],
    [router],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table is exempted from React Compiler memoization via "use no memo"
  const table = useReactTable({
    data: products,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
  });

  async function executeConfirmation() {
    if (!confirmation) return;
    const { kind, product } = confirmation;
    setProcessing(true);
    setFeedback(null);

    try {
      const result =
        kind === "unpublish" ? await unpublishProductAction(product.id) : await hardDeleteProductAction(product.id);

      setFeedback(
        result.ok
          ? {
              kind: "success",
              message:
                kind === "unpublish"
                  ? `Produk "${product.name}" dinonaktifkan dari katalog.`
                  : `Produk "${product.name}" dihapus permanen.`,
            }
          : { kind: "error", message: result.error.message },
      );
    } catch {
      setFeedback({ kind: "error", message: "Operasi produk gagal. Coba lagi." });
    } finally {
      setProcessing(false);
      setConfirmation(null);
    }
  }

  return (
    <div className="grid gap-4">
      {feedback ? (
        <Alert variant={feedback.kind === "success" ? "success" : "destructive"}>
          {feedback.kind === "success" ? (
            <CheckCircleIcon aria-hidden="true" />
          ) : (
            <ExclamationTriangleIcon aria-hidden="true" />
          )}
          <AlertTitle>{feedback.message}</AlertTitle>
          {feedback.kind === "error" ? <AlertDescription>Periksa kembali lalu coba lagi.</AlertDescription> : null}
        </Alert>
      ) : null}

      <DataGrid
        table={table}
        recordCount={products.length}
        tableLayout={{ dense: true, width: "fixed" }}
        emptyMessage="Belum ada produk. Tambahkan produk pertama agar katalog toko bisa mulai diisi."
      >
        <DataGridContainer className="rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <DataGridTable />
          </div>
        </DataGridContainer>
        <DataGridPagination
          sizes={[10, 25, 50]}
          sizesLabel="Tampilkan"
          sizesDescription="per halaman"
          rowsPerPageLabel="Baris per halaman"
          info="{from} - {to} dari {count} produk"
          previousPageLabel="Ke halaman sebelumnya"
          nextPageLabel="Ke halaman berikutnya"
        />
      </DataGrid>

      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open && !processing) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.kind === "delete" ? "Hapus produk secara permanen?" : "Nonaktifkan produk dari katalog?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.kind === "delete"
                ? `Produk "${confirmation.product.name}" beserta seluruh gambarnya akan dihapus dan tidak dapat dikembalikan.`
                : confirmation
                  ? `Produk "${confirmation.product.name}" akan disembunyikan dari katalog pembeli. Data produk tetap tersimpan dan bisa ditayangkan kembali nanti.`
                  : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="control" disabled={processing}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant={confirmation?.kind === "delete" ? "destructive" : "default"}
              size="control"
              disabled={processing}
              onClick={executeConfirmation}
            >
              {processing
                ? "Memproses..."
                : confirmation?.kind === "delete"
                  ? "Hapus permanen"
                  : "Nonaktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
