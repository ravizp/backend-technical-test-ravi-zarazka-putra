# Desain Database

Diagram ER: [`../ERD Inventory Procurement.png`](../ERD%20Inventory%20Procurement.png)

Database yang dipakai: **PostgreSQL**. Migration: **Drizzle Kit** (`npm run db:migrate`).
Seluruh schema bisa dibangun ulang dari repository, tidak ada langkah SQL manual.

Aturan umum:

- Semua tabel punya primary key `id uuid` (default `gen_random_uuid()`).
- `created_at` / `updated_at` bertipe `timestamptz`, default `now()`. `updated_at`
  di-update oleh aplikasi setiap kali row berubah.
- Case study ini tidak membahas harga/uang, jadi tidak ada kolom price.
- Kolom yang sifatnya enum (`status`, `role`, `movement_type`) disimpan sebagai `text`
  plus `CHECK (... IN (...))`, bukan enum native PostgreSQL. Alasannya supaya
  menambah nilai baru tidak perlu migration khusus untuk ubah tipe enum.

---

## 1. Master data

### `products`

| kolom                   | tipe        | keterangan                     |
| ----------------------- | ----------- | ------------------------------ |
| id                      | uuid        | PK                             |
| sku                     | text        | **UNIQUE**, not null           |
| name                    | text        | not null                       |
| unit                    | text        | not null (contoh `PCS`, `BOX`) |
| is_active               | boolean     | not null, default `true`       |
| created_at / updated_at | timestamptz |                                |

Aturan: product yang `is_active = false` tidak boleh dipakai pada transaksi **baru**
(item PR, item PO). Row lama yang sudah terlanjur mereferensikan product tersebut tetap
sah.

### `suppliers`

| kolom                   | tipe        | keterangan               |
| ----------------------- | ----------- | ------------------------ |
| id                      | uuid        | PK                       |
| name                    | text        | not null                 |
| email                   | text        | not null                 |
| phone                   | text        | not null                 |
| is_active               | boolean     | not null, default `true` |
| created_at / updated_at | timestamptz |                          |

Aturan: supplier yang tidak aktif tidak boleh dipilih untuk Purchase Order **baru**.

### `warehouses`

| kolom                   | tipe        | keterangan               |
| ----------------------- | ----------- | ------------------------ |
| id                      | uuid        | PK                       |
| code                    | text        | **UNIQUE**, not null     |
| name                    | text        | not null                 |
| location                | text        | not null                 |
| is_active               | boolean     | not null, default `true` |
| created_at / updated_at | timestamptz |                          |

Aturan: warehouse yang tidak aktif tidak boleh dipakai pada transaksi **baru**.

### `users`

| kolom                   | tipe        | keterangan                                      |
| ----------------------- | ----------- | ----------------------------------------------- |
| id                      | uuid        | PK                                              |
| name                    | text        | not null                                        |
| email                   | text        | **UNIQUE**, not null — dipakai sebagai login    |
| password_hash           | text        | not null (bcrypt)                               |
| role                    | text        | not null, `CHECK (role IN ('USER','APPROVER'))` |
| created_at / updated_at | timestamptz |                                                 |

Di-seed minimal 1 user role `USER` dan 1 user role `APPROVER`.

### `document_sequences`

Untuk generate nomor dokumen `PR-YYYY-000001` / `PO-...` / `GR-...` secara berurutan dan
aman dari race condition.

| kolom       | tipe | keterangan            |
| ----------- | ---- | --------------------- |
| id          | uuid | PK                    |
| doc_type    | text | `PR` \| `PO` \| `GR`  |
| year        | int  |                       |
| last_number | int  | not null, default `0` |

**UNIQUE (`doc_type`, `year`)**. Pengambilan nomor dilakukan di transaksi yang sama
dengan insert dokumennya, memakai `UPDATE ... RETURNING last_number + 1` (row lock),
sehingga dua request yang jalan bersamaan tidak mungkin dapat nomor yang sama.

---

## 2. Inventory

### `inventories` — saldo stok saat ini

| kolom                   | tipe        | keterangan                                     |
| ----------------------- | ----------- | ---------------------------------------------- |
| id                      | uuid        | PK                                             |
| warehouse_id            | uuid        | FK → warehouses                                |
| product_id              | uuid        | FK → products                                  |
| quantity                | int         | not null, default `0`, `CHECK (quantity >= 0)` |
| created_at / updated_at | timestamptz |                                                |

**UNIQUE (`warehouse_id`, `product_id`)** — tepat satu row saldo per product per
warehouse. Endpoint "stock by warehouse" dan "stock by product" membaca langsung dari
tabel ini.

### `inventory_movements` — ledger (append-only)

| kolom          | tipe        | keterangan                                                          |
| -------------- | ----------- | ------------------------------------------------------------------- |
| id             | uuid        | PK                                                                  |
| warehouse_id   | uuid        | FK → warehouses                                                     |
| product_id     | uuid        | FK → products                                                       |
| movement_type  | text        | `CHECK (movement_type IN ('PURCHASE_RECEIPT'))` — bisa nambah nanti |
| quantity       | int         | signed; `+` untuk stok masuk. `CHECK (quantity <> 0)`               |
| reference_type | text        | contoh `GOODS_RECEIPT`                                              |
| reference_id   | uuid        | id dokumen sumber (untuk sekarang row `good_receipts`)              |
| created_by     | uuid        | FK → users (nullable)                                               |
| created_at     | timestamptz | tidak ada `updated_at` — row tidak pernah diubah                    |

Setiap perubahan stok menulis satu row movement **dan** meng-update
`inventories.quantity` di transaksi yang sama. Ledger dipakai untuk audit trail, saldo
dipakai untuk baca cepat. Alasan kenapa keduanya ada dijelaskan di bagian "Engineering
Decisions" pada README.

---

## 3. Purchase Request

### `purchase_requests`

| kolom                   | tipe        | keterangan                                                                       |
| ----------------------- | ----------- | -------------------------------------------------------------------------------- |
| id                      | uuid        | PK                                                                               |
| request_number          | text        | **UNIQUE**, format `PR-YYYY-000001`                                              |
| warehouse_id            | uuid        | FK → warehouses                                                                  |
| requested_by            | uuid        | FK → users                                                                       |
| status                  | text        | `CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED'))`, default `DRAFT` |
| approved_by             | uuid        | FK → users, nullable (diisi saat approve/reject)                                 |
| approved_at             | timestamptz | nullable                                                                         |
| rejection_reason        | text        | nullable, wajib diisi kalau `status = REJECTED` (validasi di aplikasi)           |
| submitted_at            | timestamptz | nullable                                                                         |
| created_at / updated_at | timestamptz |                                                                                  |

### `purchase_request_items`

| kolom                   | tipe        | keterangan                                     |
| ----------------------- | ----------- | ---------------------------------------------- |
| id                      | uuid        | PK                                             |
| purchase_request_id     | uuid        | FK → purchase_requests (**ON DELETE CASCADE**) |
| product_id              | uuid        | FK → products                                  |
| quantity                | int         | `CHECK (quantity > 0)`                         |
| created_at / updated_at | timestamptz |                                                |

**UNIQUE (`purchase_request_id`, `product_id`)** — satu product hanya boleh muncul satu
kali dalam satu PR.

---

## 4. Purchase Order

### `purchase_orders`

| kolom                   | tipe        | keterangan                                                                                           |
| ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| id                      | uuid        | PK                                                                                                   |
| po_number               | text        | **UNIQUE**, format `PO-YYYY-000001`                                                                  |
| purchase_request_id     | uuid        | FK → purchase_requests, **UNIQUE** — 1 PR maksimal menghasilkan 1 PO                                 |
| supplier_id             | uuid        | FK → suppliers                                                                                       |
| warehouse_id            | uuid        | FK → warehouses (disalin dari PR)                                                                    |
| status                  | text        | `CHECK (status IN ('DRAFT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED'))`, default `DRAFT` |
| created_by              | uuid        | FK → users                                                                                           |
| created_at / updated_at | timestamptz |                                                                                                      |

### `purchase_order_items`

| kolom             | tipe | keterangan                                              |
| ----------------- | ---- | ------------------------------------------------------- |
| id                | uuid | PK                                                      |
| purchase_order_id | uuid | FK → purchase_orders (**ON DELETE CASCADE**)            |
| product_id        | uuid | FK → products (disalin dari item PR)                    |
| ordered_quantity  | int  | `CHECK (ordered_quantity > 0)`                          |
| received_quantity | int  | not null, default `0`, `CHECK (received_quantity >= 0)` |
| —                 | —    | `CHECK (received_quantity <= ordered_quantity)`         |

**UNIQUE (`purchase_order_id`, `product_id`)**.

`received_quantity` adalah running total yang di-maintain (denormalisasi), di-update di
transaksi yang sama dengan setiap Goods Receipt — bukan dihitung ulang dari
`good_receipt_items` setiap kali dibaca.

---

## 5. Goods Receipt

### `good_receipts`

| kolom             | tipe        | keterangan                                              |
| ----------------- | ----------- | ------------------------------------------------------- |
| id                | uuid        | PK                                                      |
| gr_number         | text        | **UNIQUE**, format `GR-YYYY-000001`                     |
| purchase_order_id | uuid        | FK → purchase_orders                                    |
| received_by       | uuid        | FK → users                                              |
| received_at       | timestamptz | not null                                                |
| created_at        | timestamptz | tidak ada `updated_at` — GR tidak diedit setelah dibuat |

### `good_receipt_items`

| kolom                  | tipe        | keterangan                                 |
| ---------------------- | ----------- | ------------------------------------------ |
| id                     | uuid        | PK                                         |
| good_receipt_id        | uuid        | FK → good_receipts (**ON DELETE CASCADE**) |
| purchase_order_item_id | uuid        | FK → purchase_order_items                  |
| received_quantity      | int         | `CHECK (received_quantity > 0)`            |
| created_at             | timestamptz |                                            |

Item GR direferensikan ke `purchase_order_item_id` (bukan langsung ke `product_id`).
Efeknya: aturan "product yang diterima harus ada di PO" otomatis dijaga oleh foreign
key, dan penerimaan bertahap (partial) lintas beberapa GR terkumpul secara natural ke
satu baris PO.

---

## 6. Index

Primary key dan UNIQUE di atas sudah otomatis membuat index. Tambahan index eksplisit:

| index                                                              | alasan                             |
| ------------------------------------------------------------------ | ---------------------------------- |
| `purchase_requests (status)`                                       | list / filter berdasarkan status   |
| `purchase_requests (warehouse_id)`, `(requested_by)`               | lookup FK + filter                 |
| `purchase_orders (status)`                                         | list / filter berdasarkan status   |
| `purchase_orders (supplier_id)`, `(warehouse_id)`                  | lookup FK                          |
| `purchase_request_items (purchase_request_id)`                     | ambil semua item milik satu PR     |
| `purchase_order_items (purchase_order_id)`                         | ambil semua item milik satu PO     |
| `good_receipts (purchase_order_id)`                                | ambil semua GR milik satu PO       |
| `good_receipt_items (good_receipt_id)`, `(purchase_order_item_id)` | ambil / agregasi                   |
| `inventory_movements (warehouse_id, product_id)`                   | riwayat stok per product/warehouse |
| `inventory_movements (reference_type, reference_id)`               | telusuri movement ke dokumen asal  |

---

## 7. Referential action

- PR → item PR, PO → item PO, GR → item GR: **ON DELETE CASCADE** (item tidak punya arti
  tanpa header-nya).
- Semua FK ke master data (`product_id`, `supplier_id`, `warehouse_id`, kolom `*_by` ke
  users): **ON DELETE RESTRICT** — master data yang sudah dipakai transaksi tidak boleh
  di-hard delete; non-aktifkan saja (`is_active = false`).
