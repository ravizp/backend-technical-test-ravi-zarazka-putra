# Assumptions

Requirement tidak menjelaskan semua kondisi bisnis secara eksplisit. Di bawah ini
keputusan yang diambil selama desain & implementasi. Dokumen ini bersifat _living_ —
setiap asumsi baru dicatat di sini begitu diambil.

Referensi detail: [`docs/database-design.md`](docs/database-design.md),
[`docs/state-machines.md`](docs/state-machines.md),
[`docs/api-contract.md`](docs/api-contract.md),
[`docs/error-handling.md`](docs/error-handling.md).

---

## 1. Autentikasi & user

1. Autentikasi memakai **JWT stateless**. Tidak ada refresh token, tidak ada logout
   sisi server — token berlaku sampai `JWT_EXPIRES_IN` habis.
2. Tidak ada endpoint registrasi / lupa password / verifikasi email (sesuai "tidak
   diperlukan" di requirement). User dibuat **hanya lewat seeder**.
3. Seeder menyediakan minimal 1 user `USER` dan 1 user `APPROVER`. Kredensial
   dicantumkan di README.
4. `role` seorang user tetap (tidak ada endpoint ganti role).
5. Satu user punya **tepat satu** role — kolom `role` tunggal dengan
   `CHECK (role IN ('USER','APPROVER'))`. Role bersifat **eksklusif**: tidak ada user
   yang sekaligus `USER` dan `APPROVER`.

## 2. Peran & otorisasi

1. Requirement hanya mendefinisikan `USER` dan `APPROVER`. `APPROVER` khusus approval
   PR. **Semua aksi lain** (buat/kelola master data, buat PR, buat PO, mark as ordered,
   cancel PO, catat Goods Receipt) dilakukan oleh `USER`.
2. **Visibilitas Purchase Request:**
   - `USER` hanya melihat PR **miliknya sendiri** (`requested_by = dirinya`). Endpoint
     list otomatis di-filter; `GET` detail PR milik orang lain dibalas `404`
     (`PURCHASE_REQUEST_NOT_FOUND`) supaya keberadaannya tidak bocor.
   - `APPROVER` melihat **semua** PR, **semua status** (bukan hanya `SUBMITTED`) — perlu
     untuk melihat riwayat keputusan.
3. **Visibilitas Purchase Order / Goods Receipt / Inventory / master data:** boleh
   dibaca oleh user terautentikasi mana pun. `USER` menjalankan seluruh proses
   procurement hilir sehingga tidak dibatasi di sana.
4. Edit & submit sebuah PR hanya boleh oleh **pemilik** PR (`requested_by`). USER lain
   tidak bisa, walaupun sama-sama role `USER`.
5. CRUD master data (product / supplier / warehouse) boleh oleh user terautentikasi mana
   pun — tidak ada role "admin" terpisah di requirement.

## 3. Master data

1. Entity non-aktif (`is_active = false`) hanya diblokir saat dipakai di transaksi
   **baru**. Data yang sudah terlanjur mereferensikannya tetap valid.
2. Tidak ada hard delete untuk master data — non-aktifkan saja. FK dari transaksi ke
   master data memakai `ON DELETE RESTRICT`.
3. `products.sku` dan `warehouses.code` unik. `users.email` unik (dipakai untuk login).
4. Tidak ada kolom harga / pajak / mata uang — di luar scope case study.

## 4. Purchase Request

1. Satu PR untuk tepat 1 warehouse, bisa banyak product (dari requirement).
2. Satu product hanya boleh muncul **satu kali** per PR — `UNIQUE (purchase_request_id, product_id)`.
   Menambah product yang sudah ada ditolak, bukan digabung quantity-nya.
3. `quantity` tiap item harus `> 0` (dijaga schema + `CHECK`).
   Semua kolom quantity (`purchase_request_items.quantity`,
   `purchase_order_items.ordered_quantity` / `received_quantity`,
   `good_receipt_items.received_quantity`) bertipe **integer** — tidak menerima desimal.
   Unit barang (`PCS`, `BOX`) selalu bilangan bulat untuk case study ini.
4. PR bisa dibuat langsung dengan `items`, atau kosong lalu item ditambah belakangan
   selama masih `DRAFT`.
5. Saat **submit**, dicek: minimal 1 item, dan semua product item masih aktif. Kalau ada
   product yang keburu dinonaktifkan setelah ditambahkan, submit ditolak.
6. PR yang `REJECTED` tidak bisa di-resubmit. Kalau masih dibutuhkan, buat PR baru.
7. Setelah `SUBMITTED`, PR tidak bisa diedit siapa pun (tidak ada fitur "tarik kembali"
   ke `DRAFT`).
8. `rejection_reason` wajib diisi saat reject.

## 5. Purchase Order

1. PO hanya bisa dibuat dari PR berstatus `APPROVED`, dan satu PR maksimal menghasilkan
   1 PO (`UNIQUE (purchase_request_id)` di `purchase_orders`).
2. Saat PO dibuat: product + `ordered_quantity` disalin dari item PR; `warehouse_id`
   disalin dari PR; `supplier_id` ditentukan di request pembuatan PO.
3. PO mulai dari status `DRAFT`. Ada langkah **"Mark as Ordered"** terpisah (`DRAFT` →
   `ORDERED`) sebelum barang bisa diterima.
4. PO hanya bisa di-`CANCELLED` selama belum ada penerimaan (`DRAFT` atau `ORDERED`).
   Setelah `PARTIALLY_RECEIVED`, pembatalan dianggap di luar scope (butuh proses retur).
5. Status `PARTIALLY_RECEIVED` / `RECEIVED` **tidak** di-set manual — dihitung ulang
   dari `purchase_order_items` setiap kali ada Goods Receipt berhasil.
6. Tidak ada endpoint edit item PO — isinya terkunci dari PR.

## 6. Goods Receipt & inventory

1. Goods Receipt selalu mereferensikan 1 PO dan boleh berisi beberapa item.
2. Item GR menunjuk `purchase_order_item_id` (bukan `product_id` bebas), jadi
   "product yang diterima harus ada di PO" dijaga oleh FK.
3. `received_quantity` tiap item GR harus `> 0`. Total kumulatif per baris PO tidak
   boleh melebihi `ordered_quantity` — kalau melebihi, seluruh request ditolak.
4. `receivedAt` dikirim oleh client (boleh mundur, untuk mencatat pengiriman yang
   telat dicatat). Kalau tidak dikirim, default waktu server.
5. Satu Goods Receipt yang berhasil dijalankan dalam **satu transaksi database**:
   buat GR + item → update `received_quantity` PO → hitung ulang status PO → update
   `inventories.quantity` → tulis `inventory_movements`. Kalau ada langkah gagal,
   semuanya di-rollback (tidak ada data setengah jadi).
6. Untuk mencegah _over-receive_ akibat dua GR paralel, baris `purchase_orders` dan
   `purchase_order_items` terkait dikunci (`SELECT ... FOR UPDATE`) di dalam transaksi.
7. Stok disimpan **dua lapis**: `inventories.quantity` (saldo, untuk baca cepat) dan
   `inventory_movements` (ledger append-only, untuk audit). Keduanya diubah dalam
   transaksi yang sama sehingga selalu konsisten.
8. Untuk case study ini `movement_type` hanya `PURCHASE_RECEIPT` dan `quantity` selalu
   positif (hanya stok masuk).

## 7. Penomoran dokumen

1. Nomor dokumen berformat `PR-YYYY-000001`, `PO-YYYY-000001`, `GR-YYYY-000001`
   (6 digit, nol di depan).
2. Counter **reset setiap tahun** per `doc_type` (tabel `document_sequences`, unik per
   `doc_type` + `year`).
3. Nomor dialokasikan di transaksi yang sama dengan insert dokumennya memakai row lock,
   jadi tidak ada nomor dobel walau ada request bersamaan.

## 8. Umum

1. Semua timestamp disimpan UTC (`timestamptz`), dikembalikan sebagai ISO 8601.
2. Field JSON `camelCase`; kolom DB `snake_case`.
3. `PATCH` = update parsial; field yang tidak dikirim tidak diubah.
4. Paginasi list: `page` mulai 1, `pageSize` default 20, maksimal 100.
5. `error.message` berbahasa Inggris singkat (konvensi kode). Yang jadi kontrak stabil
   adalah `error.code`.
6. Schema dibangun ulang sepenuhnya lewat migration Drizzle — tidak ada langkah SQL
   manual.

## 9. Lingkungan pengembangan & tooling

_Asumsi yang muncul selama development (Phase 2–8), bukan bagian dari desain awal._

1. PostgreSQL lokal dijalankan lewat Docker Compose dan di-expose di host port **5433**,
   bukan `5432` — port default sering sudah dipakai instalasi PostgreSQL native di mesin
   pengembang. `docker-compose.yml`, `.env.example`, dan `drizzle.config.ts` sudah
   memakai `5433`.
2. **Node.js ≥ 22** diasumsikan tersedia. `.env` dibaca lewat `process.loadEnvFile()`
   bawaan Node, jadi tidak ada dependency `dotenv`.
3. TypeScript dipatok di `~5.9` (bukan rilis pre-release yang lebih baru) supaya
   kompatibel dengan peer-dependency `typescript-eslint`.
4. Migration ditulis **satu file per tabel** (`0000_*` … `0012_*`), bukan satu file
   besar, agar mudah dibaca dan di-review per tabel.
5. Seeder **idempoten** (`onConflictDoNothing` pada kolom unik) — aman dijalankan
   berulang tanpa menggandakan data.
6. Test bersifat **integration** dan memakai PostgreSQL sungguhan (bukan mock), dengan
   database terpisah `inventory_procurement_test`:
   - `test/helpers-testing/global-setup.ts` membuat DB itu bila belum ada, lalu
     `DROP SCHEMA` + `migrate` sekali di awal run.
   - `test/helpers-testing/setup-env.ts` **memaksa** `PG_DATABASE` ke DB test, sehingga
     test tidak mungkin menyentuh database dev walau `.env` mengarah ke sana.
   - Test dijalankan **serial** (`fileParallelism: false`) karena semua file berbagi
     satu DB; tiap test memanggil `truncateAll()` + `seedBasics()` supaya deterministik.
7. `BCRYPT_ROUNDS` diturunkan ke `4` saat test demi kecepatan; default `10` untuk
   dev/produksi.
