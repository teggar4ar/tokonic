# Tokonic — Ringkasan Diskusi (Bahan PRD)

## 1. Latar Belakang & Konsep Produk

Banyak seller e-commerce mengeluhkan tingginya biaya admin/komisi yang dipotong marketplace dari hasil penjualan mereka. **Tokonic** adalah produk web toko online sederhana untuk satu toko (single-tenant), yang ditawarkan sebagai layanan berlangganan ke seller lain (model bisnis SaaS).

## 2. Model Bisnis & Target Pasar

- **Arsitektur**: Single-tenant — setiap seller mendapat instance toko terpisah (bukan satu platform multi-tenant/self-serve). Dipilih untuk memudahkan validasi awal sebelum scale ke multi-tenant.
- **Target seller**: UMKM kecil/individu.
- **Model harga**: Setup fee + biaya langganan flat per bulan (bukan potongan persentase dari penjualan) — ini jadi selling point utama dibanding marketplace.
- **Strategi validasi**: Mulai dengan 3–5 seller pertama secara manual (deploy satu-satu), kumpulkan feedback, baru pertimbangkan multi-tenant kalau proses onboarding manual sudah jadi bottleneck (misal sudah ada 15–20 toko).

## 3. Alur Transaksi End-to-End

1. Buyer checkout → pilih ongkir (dihitung via API ongkir)
2. Buyer bayar via payment gateway → status order `paid`
3. Webhook payment gateway update status otomatis, notifikasi ke seller
4. Seller packing → kirim barang secara **manual** (ke counter ekspedisi atau minta dijemput kurir) → input nomor resi manual ke sistem
5. Status order `shipped`, buyer bisa cek resi
6. Barang sampai → buyer konfirmasi terima (atau auto-complete setelah beberapa hari) → status `completed`
7. Dana settle otomatis ke rekening seller dari payment gateway (dipotong fee gateway ~2-3%, jauh lebih kecil dari potongan marketplace)

**Keputusan penting**: Booking kurir otomatis (integrasi API pickup) sengaja **di-skip** untuk MVP. Input resi tetap manual oleh seller.

## 4. Diskusi Strategis: Urgensi Fitur Order (vs Transaksi Manual via WA)

Ada risiko buyer & seller bypass sistem setelah komunikasi via WhatsApp (transfer manual langsung). Ini dianggap wajar dan tidak sepenuhnya bisa dicegah (terutama buyer setia/repeat). Kesimpulan:

- Fitur order tetap penting, tapi value utamanya **bukan** mencegah kebocoran transaksi ke WA, melainkan:
  - Kepercayaan lebih tinggi buat buyer baru (dibanding transfer manual ke rekening pribadi orang asing)
  - Pencatatan otomatis buat seller (stok, histori transaksi) — makin krusial saat volume order sudah lumayan banyak (bukan cuma 1-2 transaksi/hari)
- Desain: tombol WhatsApp diposisikan untuk pertanyaan **pre-purchase** saja, alur "Beli Sekarang" tetap lewat checkout di aplikasi.

## 5. Fitur Final MVP

### A. Sisi Pembeli (Storefront)
- Halaman utama toko (nama, logo, daftar produk)
- Katalog produk (grid: foto, nama, harga, status stok)
- Detail produk (multi-foto, deskripsi, varian sederhana opsional, tombol "Tanya via WhatsApp" dengan link `wa.me` + pesan template)
- Keranjang belanja
- Checkout (data buyer, pilihan ongkir, ringkasan total)
- Pembayaran via payment gateway (QRIS, VA, e-wallet)
- Cek status pesanan tanpa login (via kode order/no. HP)

### B. Sisi Seller (Admin Panel)
- Login admin
- Manajemen produk (CRUD, upload foto, harga & stok)
- Manajemen pesanan (list + status, detail order, update status, input resi manual)
- Notifikasi order baru (email atau link WA)
- Pengaturan toko (nama, alamat asal, no. WA, info rekening)
- Ringkasan penjualan sederhana (total order & omzet per hari/bulan)

### C. Sistem/Backend
- Integrasi API ongkir (hitung biaya kirim saat checkout)
- Integrasi payment gateway (generate invoice + webhook)
- Webhook handler (auto-update status `paid`)
- Auto-decrement stok saat order `paid`
- Auto-complete order (cron job, opsional)

### Notifikasi ke Seller (final)
Tidak menggunakan WhatsApp Business API berbayar. Menggunakan link `wa.me` yang di-generate begitu pembayaran sukses — **buyer sendiri** yang mengirim pesan konfirmasi ke WA seller (bukan sistem yang kirim otomatis dari server). Notifikasi email di-skip dulu untuk MVP.

### Sengaja di-skip untuk MVP
- Live chat in-app (diganti tombol WA)
- Booking kurir otomatis
- Multi-gudang, diskon/voucher kompleks, review produk
- Multi-admin/role management
- Analytics mendalam
- Notifikasi email

## 6. Struktur Aplikasi (Routing)

Satu aplikasi (codebase sama), dipisah lewat path URL, bukan dua aplikasi/domain terpisah:

```
tokonic.com/              → storefront (buyer), publik
tokonic.com/produk/[id]
tokonic.com/keranjang
tokonic.com/checkout

tokonic.com/admin/login   → login seller
tokonic.com/admin         → dashboard admin, diproteksi middleware/layout auth
tokonic.com/admin/produk
tokonic.com/admin/pesanan
```

Proteksi akses `/admin/*` dilakukan lewat middleware/layout yang cek session, bukan menyembunyikan URL.

## 7. Skema Database

Tabel utama: `sellers`, `products`, `product_images`, `orders`, `order_items`, `order_status_history` (opsional, untuk audit trail).

Keputusan desain penting:
- `sellers` akan berisi 1 baris saja (single-tenant), tapi tetap dibuat sebagai tabel (bukan hardcode) untuk memudahkan migrasi ke multi-tenant di masa depan.
- Data buyer (`buyer_name`, `buyer_phone`, `buyer_address`) disimpan langsung di tabel `orders`, bukan tabel `users` terpisah — karena buyer tidak perlu membuat akun.
- `product_name` dan `price` di-copy ke `order_items` (bukan hanya referensi ke `products`) — agar histori order menyimpan snapshot harga/nama saat transaksi, tidak berubah kalau data produk diedit kemudian.
- Kolom uang (`price`, `total`, dll) menggunakan tipe `INTEGER` (rupiah, bukan desimal) untuk menghindari masalah floating-point.
- Validasi transisi status order (`pending → paid → packed → shipped → completed`, atau ke `cancelled` sebelum `shipped`) dilakukan di level aplikasi (logic), bukan constraint database.

*(Skema SQL lengkap sudah dibahas di percakapan sebelumnya dan bisa dilampirkan terpisah bila dibutuhkan untuk PRD.)*

## 8. Tech Stack Final

| Aspek | Pilihan |
|---|---|
| Nama aplikasi | **Tokonic** |
| Framework | Next.js (full-stack, App Router) |
| Database | MySQL |
| ORM | Prisma |
| UI Component Library | ReUI (berbasis React/shadcn/Tailwind) |
| Payment gateway | Duitku (mode POP, integrasi manual via REST API — bukan pakai library resmi Node.js karena kurang maintained/tidak type-safe) |
| API ongkir | RajaOngkir atau Biteship |
| Image storage | Cloudinary |
| Validasi & form | Zod + React Hook Form |
| State management (cart) | React state/Context dulu (Zustand bisa menyusul bila cart makin kompleks); cart disimpan di localStorage, belum perlu tabel `carts` di database untuk MVP |
| Notifikasi | WA manual (link `wa.me`, dikirim oleh buyer, bukan sistem); email di-skip dulu |
| Error tracking | Sentry (menyusul, tidak di fase awal) |
| Testing | Manual testing untuk sebagian besar flow; Vitest hanya untuk bagian kritis (kalkulasi harga, validasi transisi status order, webhook handler pembayaran) |
| Hosting (rencana) | Vercel (aplikasi) + PlanetScale/Railway (MySQL) |

## 9. Alasan Keputusan Stack (untuk konteks PRD)

- Awalnya dipertimbangkan Laravel + Inertia.js + MySQL, namun diputuskan pindah ke **Next.js full-stack** agar development satu bahasa (TypeScript) saja, tanpa perlu context-switching antara PHP dan JS — dinilai lebih ringan untuk solo/small team yang baru pertama kali membangun toko online.
- MinIO sempat dipertimbangkan untuk image storage (self-hosted, S3-compatible), namun akhirnya dipilih **Cloudinary** untuk MVP agar tidak menambah beban maintenance infrastruktur (server, backup) di tahap awal.

## 10. Item Terbuka / Belum Dibahas Detail

Beberapa hal berikut telah disebutkan sebagai langkah lanjutan namun belum dieksekusi dalam diskusi ini, dan bisa jadi bagian dari PRD atau dokumen teknis terpisah:
- Struktur project/scaffolding Next.js secara konkret
- Urutan pengerjaan development (roadmap/sprint breakdown)
- Skema SQL lengkap (DDL) — sudah pernah dibahas detail di percakapan, perlu dilampirkan terpisah jika diperlukan
- Detail integrasi teknis Duitku (signature generation, endpoint sandbox vs production)
- Ketersediaan domain/branding final untuk nama "Tokonic"

