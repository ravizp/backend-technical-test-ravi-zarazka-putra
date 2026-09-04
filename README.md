# Inventory Procurement API

REST API untuk alur pengadaan barang (procurement) sederhana: dari **Purchase Request**
diajukan staff, **disetujui** approver, dikonversi jadi **Purchase Order** ke supplier,
lalu barang diterima lewat **Goods Receipt** yang otomatis menambah stok gudang.

Dikerjakan sebagai Backend Engineer take-home technical test.

## Daftar isi
- [Setup Backend Repo](#setup)
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Design](#database-design)
- [Environment Variables](#environment-variables)
- [Migration](#migration)
- [Seed](#seed)
- [Run Application](#run-application)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Engineering Decisions](#engineering-decisions)
- [Assumptions](#assumptions)

---

## Overview

Domain dibagi jadi tiga bagian:

| Bagian          | Isi                                                                         |
| --------------- | --------------------------------------------------------------------------- |
| **Master data** | `products`, `suppliers`, `warehouses`, `users`                              |
| **Procurement** | `purchase_requests` → `purchase_orders` → `goods_receipts` (+ item masing2) |
| **Inventory**   | `inventories` (saldo stok) + `inventory_movements` (ledger append-only)     |

Alur happy-path:

```
PR (DRAFT) --submit--> PR (SUBMITTED) --approve--> PR (APPROVED)
   --create PO--> PO (DRAFT) --mark-ordered--> PO (ORDERED)
   --goods receipt--> PO (PARTIALLY_RECEIVED | RECEIVED)  +  stok gudang bertambah
```

Aturan bisnis inti:

- PR tidak bisa di-submit tanpa item; hanya PR `SUBMITTED` yang bisa di-approve/reject.
- PO hanya dari PR `APPROVED`, dan **satu PR maksimal satu PO**.
- Goods Receipt tidak boleh menerima melebihi `ordered_quantity` (termasuk kumulatif
  dari beberapa penerimaan sebagian).
- Setiap Goods Receipt jalan dalam **satu transaksi database**: GR + item → update PO
  → hitung ulang status PO → update saldo stok → tulis movement. Gagal di tengah =
  rollback penuh.
- Master data non-aktif (`is_active = false`) ditolak di transaksi baru.

Detail state machine: [`docs/state-machines.md`](docs/state-machines.md).
Katalog error: [`docs/error-handling.md`](docs/error-handling.md).

---

## Tech Stack

| Area            | Pilihan                                         | Alasan singkat                                               |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| Bahasa          | **TypeScript** (Node.js ≥ 22, ESM)              | Type-safety end-to-end (schema DB → handler → response)      |
| HTTP framework  | **Hono** + `@hono/zod-openapi`                  | Ringan, first-class TypeScript, OpenAPI dari schema Zod      |
| Database        | **PostgreSQL 16**                               | Transaksi ACID + row lock untuk cegah over-receive           |
| ORM / migration | **Drizzle ORM** + **drizzle-kit**               | Schema sebagai kode TS, migration bisa di-regenerate         |
| Validasi        | **Zod v4**                                      | Satu schema dipakai untuk validasi request + dokumen OpenAPI |
| Auth            | **JWT** (`hono/jwt`, HS256) + **bcryptjs**      | Stateless, sesuai requirement (tanpa refresh/registrasi)     |
| API docs        | **Swagger UI** di `/docs` + `docs/openapi.json` | Interaktif saat dev, file ter-commit untuk arsip             |
| Testing         | **Vitest** (integration, DB sungguhan)          | Test menembak app Hono asli lewat `app.request()`            |
| Lint / format   | **ESLint** (typescript-eslint) + **Prettier**   |                                                              |

---

## Project Structure

```
src/
  server.ts                 # entry point: buat app + jalankan HTTP server
  app.ts                    # rakit semua route module + middleware + OpenAPI/Swagger
  openapi.ts                # helper createRouter() (OpenAPIHono + defaultHook validasi)
  config/
    env.ts                  # baca + validasi environment variable (Zod)
  db/
    connection-postgresql.ts # koneksi postgres-js + instance drizzle
    schema/                  # satu file per tabel (create-table-*.ts) + index.ts
    seeders/                 # seeder per entity + index.ts (runner)
  lib/
    jwt.ts                  # signToken / verifyToken
    error-handler-http-status-codes.ts  # class AppError + factory (notFound, conflict, ...)
    document-number.ts      # nextDocumentNumber(tx, "PR"|"PO"|"GR") -> PR-2026-000001
    pagination.ts           # schema + helper paginasi
    db-errors.ts            # deteksi unique/check violation dari error driver
    types.ts               # union status/role/movement type
  middleware/
    error-handler.ts        # onError + notFound (satu-satunya tempat bentuk JSON error)
  modules/
    auth/                   # login, GET /me, middleware protect()
    products/ suppliers/ warehouses/   # CRUD master data (pola sama: routes/schema/service)
    inventory/              # GET /inventory, GET /inventory-movements
    purchase-requests/      # PR: CRUD item, submit, approve, reject
    purchase-orders/        # PO: create dari PR, mark-ordered, cancel, list GR
    goods-receipts/         # GR: create (transaksi atomic) + read
      goods-receipt.serialize.ts   # sisi baca (query + DTO)
      goods-receipt.service.ts     # sisi tulis (transaksi + helper per langkah)

drizzle/migrations/         # 0000_*.sql .. 0012_*.sql (satu migration per tabel)
docs/                       # database-design, state-machines, api-contract, error-handling, ERD, openapi.json
test/
  helpers-testing/          # setup env, global setup (buat+migrate DB test), api(), seedBasics()
  business/                 # integration test aturan bisnis (PR, PO, GR, extra)
ASSUMPTIONS.md              # kumpulan asumsi desain & implementasi
```

Tiap module mengikuti pola **routes → schema → service**:

- `*.routes.ts` — definisi endpoint OpenAPI + middleware (`protect()`), memanggil service.
- `*.schema.ts` — schema Zod request & response (sekaligus jadi komponen OpenAPI).
- `*.service.ts` — logika bisnis + akses DB. Tidak tahu soal HTTP.

---

## Database Design

Detail lengkap (kolom, constraint, index, referential action):
[`docs/database-design.md`](docs/database-design.md).
ERD: [`docs/ERD Inventory Procurement.png`](docs/ERD%20Inventory%20Procurement.png).

Relasi penting:

| Relasi                                            | Kardinalitas | Catatan                                                            |
| ------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| `purchase_requests` → `purchase_request_items`    | 1 : N        | `ON DELETE CASCADE`. `UNIQUE (purchase_request_id, product_id)`    |
| `warehouses` → `purchase_requests`                | 1 : N        | 1 PR untuk tepat 1 warehouse                                       |
| `users` → `purchase_requests`                     | 1 : N        | `requested_by`; `approved_by` nullable (diisi saat approve/reject) |
| `purchase_requests` → `purchase_orders`           | 1 : 0..1     | `UNIQUE (purchase_request_id)` — 1 PR maksimal 1 PO                |
| `purchase_orders` → `purchase_order_items`        | 1 : N        | product + `ordered_quantity` disalin dari item PR                  |
| `suppliers` / `warehouses` → `purchase_orders`    | 1 : N        | `supplier_id` dari request; `warehouse_id` disalin dari PR         |
| `purchase_orders` → `goods_receipts`              | 1 : N        | penerimaan bertahap                                                |
| `goods_receipts` → `goods_receipt_items`          | 1 : N        | item menunjuk `purchase_order_item_id`, bukan `product_id`         |
| `purchase_order_items` → `goods_receipt_items`    | 1 : N        | akumulasi partial terkumpul natural ke satu baris PO               |
| `warehouses` + `products` → `inventories`         | 1 : 1 (pair) | `UNIQUE (warehouse_id, product_id)` — satu saldo per pasangan      |
| `warehouses` + `products` → `inventory_movements` | 1 : N        | ledger append-only; `reference_type`/`reference_id` ke GR          |

Catatan desain:

- Semua PK `uuid` (`gen_random_uuid()`), timestamp `timestamptz` (disimpan UTC).
- Kolom enum (`status`, `role`, `movement_type`) = `text` + `CHECK (... IN (...))`,
  bukan enum native, supaya nambah nilai baru tidak butuh migration ubah tipe.
- FK transaksi → master data: `ON DELETE RESTRICT` (master data yang sudah dipakai tidak
  bisa di-hard delete; non-aktifkan saja).
- `purchase_order_items.received_quantity` di-maintain sebagai running total +
  `CHECK (received_quantity <= ordered_quantity)` sebagai pengaman terakhir.

---

## Setup

### Prasyarat

- **Node.js ≥ 22** (dites di v24)
- **Docker** + Docker Compose (untuk PostgreSQL lokal), atau PostgreSQL 16 yang jalan sendiri

### Langkah

```bash
# 1. Clone Repository
git clone https://github.com/ravizp/backend-technical-test-ravi-zarazka-putra.git

# 2. install dependency
npm install

# 3. siapkan environment
cp .env.example .env        # lalu sesuaikan bila perlu

# 4. jalankan PostgreSQL (Docker)
docker compose up -d        # Postgres di host port 5433

# 5. buat schema
npm run db:migrate

# 6. isi data awal (user, master data, stok)
npm run db:seed

# 7. jalankan API (mode dev, auto-reload)
npm run dev
```

API jalan di `http://localhost:3001` (atau `PORT` di `.env`). Cek `GET /health`.

> Docker Compose juga menyertakan **pgAdmin** (`http://localhost:5050`) dan **Adminer**
> (`http://localhost:8080`) untuk inspeksi DB — opsional.

---

## Environment Variables

Semua variabel divalidasi saat startup oleh [`src/config/env.ts`](src/config/env.ts) — kalau
ada yang kurang/salah, aplikasi menolak start dengan pesan yang jelas.

| Variabel         | Wajib  | Default       | Keterangan                                            |
| ---------------- | ------ | ------------- | ----------------------------------------------------- |
| `NODE_ENV`       | tidak  | `development` | `development` \| `test` \| `production`               |
| `PORT`           | tidak  | `3000`        | Port HTTP server (`.env.example` memakai `3001`)      |
| `PG_HOSTNAME`    | tidak  | `localhost`   | Host PostgreSQL                                       |
| `PG_PORT`        | tidak  | `5432`        | Port PostgreSQL (Docker Compose expose `5433`)        |
| `PG_USERNAME`    | **ya** | —             | User PostgreSQL                                       |
| `PG_PASSWORD`    | **ya** | —             | Password PostgreSQL                                   |
| `PG_DATABASE`    | **ya** | —             | Nama database (`inventory_procurement`)               |
| `JWT_SECRET_KEY` | **ya** | —             | Minimal 8 karakter; pakai string acak panjang di prod |
| `JWT_EXPIRES_IN` | tidak  | `1d`          | Masa berlaku token (format `ms`, mis. `1d`, `12h`)    |
| `BCRYPT_ROUNDS`  | tidak  | `10`          | Cost factor bcrypt (4–15)                             |

`drizzle-kit` (migration) hanya membaca `PG_*` — lihat [`drizzle.config.ts`](drizzle.config.ts).

---

## Migration

Migration ada di [`drizzle/migrations/`](drizzle/migrations), **satu file per tabel**
(`0000_create_table_users.sql` … `0012_create_table_goods_receipt_items.sql`). Schema
sumbernya di `src/db/schema/*.ts`.

```bash
npm run db:migrate     # terapkan semua migration yang belum jalan
npm run db:generate    # regenerate SQL setelah mengubah src/db/schema/*
npm run db:studio      # buka Drizzle Studio (GUI) untuk inspeksi
```

Seluruh schema bisa dibangun ulang dari repo — tidak ada langkah SQL manual.

---

## Seed

```bash
npm run db:seed                 # semua seeder, berurutan
npm run db:seed -- products     # hanya satu seeder
npm run db:seed -- users warehouses
```

Seeder aman dijalankan berulang (`onConflictDoNothing`). Yang di-seed:

- **Users** — 3 `USER` + 3 `APPROVER`. Semua akun memakai password yang sama:

  | Email                   | Role     | Password |
  | ----------------------- | -------- | -------- |
  | `user1@example.com`     | USER     | `123123` |
  | `user2@example.com`     | USER     | `123123` |
  | `user3@example.com`     | USER     | `123123` |
  | `approver1@example.com` | APPROVER | `123123` |
  | `approver2@example.com` | APPROVER | `123123` |
  | `approver3@example.com` | APPROVER | `123123` |

- **Warehouses**, **Suppliers**, **Products** — beberapa contoh master data.
- **Inventories** — saldo stok awal untuk sebagian pasangan warehouse/product.

---

## Run Application

| Perintah            | Fungsi                                                      |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`       | Mode development, auto-reload (`tsx watch src/server.ts`)   |
| `npm run build`     | Compile TypeScript → `dist/` (`tsc -p tsconfig.build.json`) |
| `npm start`         | Jalankan hasil build (`node dist/server.js`)                |
| `npm run typecheck` | `tsc --noEmit`                                              |
| `npm run lint`      | ESLint                                                      |
| `npm run format`    | Prettier                                                    |

Endpoint operasional: `GET /health`, `GET /docs` (Swagger UI), `GET /openapi.json`.

---

## Testing

Test bersifat **integration**: menembak aplikasi Hono asli lewat `app.request()` dengan
database PostgreSQL sungguhan (bukan mock).

```bash
docker compose up -d     # DB harus jalan
npm test                 # sekali jalan
npm run test:watch       # mode watch
```

Cara kerja:

- [`test/helpers-testing/setup-env.ts`](test/helpers-testing/setup-env.ts) **memaksa**
  `PG_DATABASE = inventory_procurement_test` — test tidak pernah menyentuh database dev.
- [`test/helpers-testing/global-setup.ts`](test/helpers-testing/global-setup.ts) membuat
  database test bila belum ada, lalu `DROP SCHEMA` + `migrate` sekali di awal.
- Tiap test: `truncateAll()` + `seedBasics()` (fixtures minimal), jadi urutannya
  deterministik. `fileParallelism: false` karena semua file berbagi satu DB.

Cakupan (`test/business/`): PR (submit tanpa item, approve non-SUBMITTED), PO (hanya dari
PR APPROVED, maksimal 1 PO per PR), Goods Receipt (tolak melebihi ordered termasuk
kumulatif, saldo stok bertambah + movement tercatat, PO penuh → `RECEIVED`), plus:
role `USER` tidak bisa approve, master data non-aktif ditolak, duplicate product ditolak,
reject PR mengubah status.

---

## API Documentation

Tiga bentuk, semua sinkron karena dihasilkan dari schema Zod yang sama:

1. **Swagger UI interaktif** — jalankan API, buka `http://localhost:3001/docs`.
2. **Spesifikasi OpenAPI mentah** — `http://localhost:3001/openapi.json`.
3. **File ter-commit** — [`docs/openapi.json`](docs/openapi.json), di-regenerate dengan:

   ```bash
   npm run docs:openapi
   ```

Narasi kontrak (contoh request/response tiap endpoint) ada di
[`docs/api-contract.md`](docs/api-contract.md).

### Ringkasan endpoint

| Group            | Endpoint                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Auth             | `POST /api/auth/login`, `GET /api/auth/me`                                                                             |
| Products         | `POST/GET /api/products`, `GET/PATCH /api/products/:id`                                                                |
| Suppliers        | `POST/GET /api/suppliers`, `GET/PATCH /api/suppliers/:id`                                                              |
| Warehouses       | `POST/GET /api/warehouses`, `GET/PATCH /api/warehouses/:id`                                                            |
| Inventory        | `GET /api/inventory`, `GET /api/inventory-movements`                                                                   |
| Purchase Request | `POST/GET /api/purchase-requests`, `GET/PATCH /api/purchase-requests/:id`, item CRUD, `/submit`, `/approve`, `/reject` |
| Purchase Order   | `POST/GET /api/purchase-orders`, `GET /api/purchase-orders/:id`, `/mark-ordered`, `/cancel`, `/goods-receipts`         |
| Goods Receipt    | `POST /api/goods-receipts`, `GET /api/goods-receipts/:id`                                                              |

Autentikasi: header `Authorization: Bearer <token>` untuk semua endpoint kecuali
`POST /api/auth/login`.

### Contoh alur cepat (curl)

```bash
# 1. login sebagai USER
TOKEN=$(curl -s localhost:3001/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"user1@example.com","password":"123123"}' | jq -r .token)

# 2. lihat stok
curl -s localhost:3001/api/inventory -H "authorization: Bearer $TOKEN" | jq
```

---

## Engineering Decisions

[Engineering Decisions](#engineering-decisions)

## Assumptions

[Assumptions](#assumptions)
