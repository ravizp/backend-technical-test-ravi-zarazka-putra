# API Contract

Kontrak ini ditulis sebelum implementasi supaya endpoint konsisten dan bisa jadi draft
API docs. Format error mengikuti [`error-handling.md`](error-handling.md).

- Base path: `/api`
- Format: JSON. Field JSON pakai `camelCase` (kolom DB `snake_case` dipetakan).
- Waktu: string ISO 8601 UTC (`2026-09-04T09:00:00.000Z`).
- Id: UUID v4.
- Auth: header `Authorization: Bearer <token>` (JWT). Semua endpoint butuh token
  kecuali `POST /api/auth/login`.
- Response sukses **tidak** dibungkus amplop. List memakai `{ data, page, pageSize, total }`.
- Body sukses: `200` (baca/aksi), `201` (resource baru).

Peran (`role`) pada tabel:

- `public` — tidak perlu token
- `auth` — user terautentikasi, peran apa pun
- `USER` — hanya role `USER` (dan untuk sebagian aksi harus pemilik resource)
- `APPROVER` — hanya role `APPROVER`
- `auth*` — user terautentikasi, tapi cakupan data dipersempit oleh peran (lihat
  keterangan endpoint)

---

## 1. Ringkasan endpoint

### Auth

| method | path          | role   | keterangan                      |
| ------ | ------------- | ------ | ------------------------------- |
| POST   | `/auth/login` | public | Tukar email+password jadi token |
| GET    | `/auth/me`    | auth   | Data user dari token            |

### Products

| method | path            | role | keterangan                                |
| ------ | --------------- | ---- | ----------------------------------------- |
| POST   | `/products`     | auth | Buat product                              |
| GET    | `/products`     | auth | List (filter `isActive`, `q`, paginasi)   |
| GET    | `/products/:id` | auth | Detail                                    |
| PATCH  | `/products/:id` | auth | Ubah sebagian field (termasuk `isActive`) |

### Suppliers

| method | path             | role | keterangan                              |
| ------ | ---------------- | ---- | --------------------------------------- |
| POST   | `/suppliers`     | auth | Buat supplier                           |
| GET    | `/suppliers`     | auth | List (filter `isActive`, `q`, paginasi) |
| GET    | `/suppliers/:id` | auth | Detail                                  |
| PATCH  | `/suppliers/:id` | auth | Ubah sebagian field                     |

### Warehouses

| method | path              | role | keterangan                              |
| ------ | ----------------- | ---- | --------------------------------------- |
| POST   | `/warehouses`     | auth | Buat warehouse                          |
| GET    | `/warehouses`     | auth | List (filter `isActive`, `q`, paginasi) |
| GET    | `/warehouses/:id` | auth | Detail                                  |
| PATCH  | `/warehouses/:id` | auth | Ubah sebagian field                     |

### Inventory

| method | path                   | role | keterangan                                                                          |
| ------ | ---------------------- | ---- | ----------------------------------------------------------------------------------- |
| GET    | `/inventory`           | auth | Saldo stok. Filter `warehouseId` dan/atau `productId`                               |
| GET    | `/inventory-movements` | auth | Riwayat pergerakan stok. Filter `warehouseId`, `productId`, `referenceId`, paginasi |

### Purchase Request

| method | path                                   | role                  | keterangan                                                                                 |
| ------ | -------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| POST   | `/purchase-requests`                   | USER                  | Buat PR (boleh langsung dengan items)                                                      |
| GET    | `/purchase-requests`                   | auth\*                | List. `USER` hanya PR miliknya; `APPROVER` semua. Filter `status`, `warehouseId`, paginasi |
| GET    | `/purchase-requests/:id`               | auth\*                | Detail + items. `USER` hanya PR miliknya (selain itu `404`)                                |
| PATCH  | `/purchase-requests/:id`               | USER (pemilik, DRAFT) | Ubah `warehouseId`                                                                         |
| POST   | `/purchase-requests/:id/items`         | USER (pemilik, DRAFT) | Tambah 1 item                                                                              |
| PATCH  | `/purchase-requests/:id/items/:itemId` | USER (pemilik, DRAFT) | Ubah `quantity`                                                                            |
| DELETE | `/purchase-requests/:id/items/:itemId` | USER (pemilik, DRAFT) | Hapus item                                                                                 |
| POST   | `/purchase-requests/:id/submit`        | USER (pemilik)        | `DRAFT` → `SUBMITTED`                                                                      |
| POST   | `/purchase-requests/:id/approve`       | APPROVER              | `SUBMITTED` → `APPROVED`                                                                   |
| POST   | `/purchase-requests/:id/reject`        | APPROVER              | `SUBMITTED` → `REJECTED` (+`reason`)                                                       |

### Purchase Order

| method | path                                | role | keterangan                                                    |
| ------ | ----------------------------------- | ---- | ------------------------------------------------------------- |
| POST   | `/purchase-orders`                  | USER | Buat PO dari PR `APPROVED` (+`supplierId`)                    |
| GET    | `/purchase-orders`                  | auth | List (filter `status`, `supplierId`, `warehouseId`, paginasi) |
| GET    | `/purchase-orders/:id`              | auth | Detail + items                                                |
| POST   | `/purchase-orders/:id/mark-ordered` | USER | `DRAFT` → `ORDERED`                                           |
| POST   | `/purchase-orders/:id/cancel`       | USER | `DRAFT`/`ORDERED` → `CANCELLED`                               |

### Goods Receipt

| method | path                                  | role | keterangan                              |
| ------ | ------------------------------------- | ---- | --------------------------------------- |
| POST   | `/goods-receipts`                     | USER | Catat penerimaan barang untuk sebuah PO |
| GET    | `/goods-receipts/:id`                 | auth | Detail + items                          |
| GET    | `/purchase-orders/:id/goods-receipts` | auth | List GR milik satu PO                   |

---

## 2. Konvensi umum

### Paginasi & filter

Query params pada endpoint list:

| param      | default | keterangan                              |
| ---------- | ------- | --------------------------------------- |
| `page`     | `1`     | mulai dari 1                            |
| `pageSize` | `20`    | maksimal `100`                          |
| `q`        | —       | pencarian teks (mis. name / sku / code) |
| `isActive` | —       | `true` / `false` untuk master data      |
| `status`   | —       | filter status (PR / PO)                 |

Bentuk response list:

```json
{
  "data": [/* ... */],
  "page": 1,
  "pageSize": 20,
  "total": 57
}
```

### Objek error

```json
{ "error": { "code": "PURCHASE_REQUEST_NOT_APPROVED", "message": "..." } }
```

---

## 3. Auth

### POST `/api/auth/login` — `public`

Request:

```json
{ "email": "user@example.com", "password": "secret123" }
```

Response `200`:

```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "0c1f...",
    "name": "John",
    "email": "user@example.com",
    "role": "USER"
  }
}
```

Error: `VALIDATION_ERROR` (422), `INVALID_CREDENTIALS` (401).

### GET `/api/auth/me` — `auth`

Response `200`:

```json
{ "id": "0c1f...", "name": "John", "email": "user@example.com", "role": "USER" }
```

Error: `UNAUTHORIZED` (401).

---

## 4. Master data (products / suppliers / warehouses)

Ketiganya berpola sama. Contoh memakai **products**.

### POST `/api/products` — `auth`

Request:

```json
{ "sku": "OIL-001", "name": "Industrial Oil", "unit": "PCS", "isActive": true }
```

Response `201`:

```json
{
  "id": "a1...",
  "sku": "OIL-001",
  "name": "Industrial Oil",
  "unit": "PCS",
  "isActive": true,
  "createdAt": "2026-09-04T09:00:00.000Z",
  "updatedAt": "2026-09-04T09:00:00.000Z"
}
```

Error: `VALIDATION_ERROR` (422), `SKU_ALREADY_EXISTS` (409).

### GET `/api/products` — `auth`

Query: `page`, `pageSize`, `q` (cocokkan `sku`/`name`), `isActive`.
Response `200`: list standar (lihat §2).

### GET `/api/products/:id` — `auth`

Response `200`: objek product. Error: `PRODUCT_NOT_FOUND` (404) → memakai `NOT_FOUND`.

### PATCH `/api/products/:id` — `auth`

Request (semua opsional):

```json
{ "name": "Industrial Oil HD", "unit": "L", "isActive": false }
```

Response `200`: objek product terbaru.
Error: `VALIDATION_ERROR` (422), `NOT_FOUND` (404), `SKU_ALREADY_EXISTS` (409) bila `sku`
diubah ke nilai yang sudah dipakai.

Perbedaan field per resource:

- **suppliers**: `name`, `email`, `phone`, `isActive`. Konflik: `EMAIL_ALREADY_EXISTS` bila email di-unique-kan (opsional).
- **warehouses**: `code` (unik), `name`, `location`, `isActive`. Konflik: `WAREHOUSE_CODE_ALREADY_EXISTS`.

---

## 5. Inventory

### GET `/api/inventory` — `auth`

Query: `warehouseId`, `productId` (salah satu / keduanya / kosong).
Response `200`:

```json
{
  "data": [
    {
      "warehouseId": "w1...",
      "warehouseCode": "JKT",
      "productId": "p1...",
      "productSku": "OIL-001",
      "quantity": 120,
      "updatedAt": "2026-09-04T10:00:00.000Z"
    }
  ]
}
```

- "Stock by warehouse" → `?warehouseId=w1`
- "Stock by product" → `?productId=p1`

### GET `/api/inventory-movements` — `auth`

Query: `warehouseId`, `productId`, `referenceId`, `page`, `pageSize`.
Response `200`: list standar dengan item:

```json
{
  "id": "m1...",
  "warehouseId": "w1...",
  "productId": "p1...",
  "movementType": "PURCHASE_RECEIPT",
  "quantity": 60,
  "referenceType": "GOODS_RECEIPT",
  "referenceId": "gr1...",
  "referenceNumber": "GR-2026-000001",
  "createdBy": "u1...",
  "createdAt": "2026-09-04T10:00:00.000Z"
}
```

---

## 6. Purchase Request

### POST `/api/purchase-requests` — `USER`

Request (`items` opsional):

```json
{
  "warehouseId": "w1...",
  "items": [
    { "productId": "p1...", "quantity": 100 },
    { "productId": "p2...", "quantity": 50 }
  ]
}
```

Response `201`:

```json
{
  "id": "pr1...",
  "requestNumber": "PR-2026-000001",
  "warehouseId": "w1...",
  "requestedBy": "u1...",
  "status": "DRAFT",
  "approvedBy": null,
  "approvedAt": null,
  "rejectionReason": null,
  "submittedAt": null,
  "items": [{ "id": "it1...", "productId": "p1...", "quantity": 100 }],
  "createdAt": "...",
  "updatedAt": "..."
}
```

Error: `VALIDATION_ERROR` (422), `WAREHOUSE_INACTIVE` (422), `PRODUCT_INACTIVE` (422),
`PURCHASE_REQUEST_DUPLICATE_PRODUCT` (422).

### GET `/api/purchase-requests` — `auth*`

Query: `status`, `warehouseId`, `page`, `pageSize`.
Cakupan: `USER` otomatis di-filter ke PR miliknya (`requestedBy = dirinya`); `APPROVER`
melihat semua PR semua status.

### GET `/api/purchase-requests/:id` — `auth*`

Response `200`: PR + `items`.
Cakupan: `APPROVER` boleh melihat PR mana pun; `USER` hanya PR miliknya, selain itu
dibalas `PURCHASE_REQUEST_NOT_FOUND` (404) agar keberadaannya tidak bocor.
Error: `PURCHASE_REQUEST_NOT_FOUND` (404).

### PATCH `/api/purchase-requests/:id` — `USER` (pemilik, `DRAFT`)

```json
{ "warehouseId": "w2..." }
```

Error: `PURCHASE_REQUEST_NOT_FOUND` (404), `FORBIDDEN` (403) bila bukan pemilik,
`PURCHASE_REQUEST_NOT_EDITABLE` (409) bila bukan `DRAFT`, `WAREHOUSE_INACTIVE` (422).

### POST `/api/purchase-requests/:id/items` — `USER` (pemilik, `DRAFT`)

```json
{ "productId": "p3...", "quantity": 10 }
```

Response `201`: item baru. Error: `PURCHASE_REQUEST_NOT_EDITABLE` (409),
`PURCHASE_REQUEST_DUPLICATE_PRODUCT` (422), `PRODUCT_INACTIVE` (422),
`VALIDATION_ERROR` (422) bila `quantity <= 0`.

### PATCH `/api/purchase-requests/:id/items/:itemId` — `USER` (pemilik, `DRAFT`)

```json
{ "quantity": 25 }
```

### DELETE `/api/purchase-requests/:id/items/:itemId` — `USER` (pemilik, `DRAFT`)

Response `204`.

### POST `/api/purchase-requests/:id/submit` — `USER` (pemilik)

Tidak ada body. `DRAFT` → `SUBMITTED`, set `submittedAt`.
Error: `FORBIDDEN` (403), `PURCHASE_REQUEST_EMPTY` (422),
`PURCHASE_REQUEST_INVALID_TRANSITION` (409) bila bukan `DRAFT`,
`PRODUCT_INACTIVE` (422) bila ada item dengan product yang sudah dinonaktifkan.

### POST `/api/purchase-requests/:id/approve` — `APPROVER`

Tidak ada body. `SUBMITTED` → `APPROVED`, set `approvedBy`, `approvedAt`.
Error: `FORBIDDEN` (403), `PURCHASE_REQUEST_NOT_SUBMITTED` (409).

### POST `/api/purchase-requests/:id/reject` — `APPROVER`

```json
{ "reason": "Budget belum tersedia" }
```

`SUBMITTED` → `REJECTED`, set `approvedBy`, `approvedAt`, `rejectionReason`.
Error: `FORBIDDEN` (403), `PURCHASE_REQUEST_NOT_SUBMITTED` (409),
`VALIDATION_ERROR` (422) bila `reason` kosong.

---

## 7. Purchase Order

### POST `/api/purchase-orders` — `USER`

```json
{ "purchaseRequestId": "pr1...", "supplierId": "s1..." }
```

- Product & quantity item PO disalin dari PR. `warehouseId` disalin dari PR.
- `status` awal `DRAFT`, `receivedQuantity` tiap item `0`.

Response `201`:

```json
{
  "id": "po1...",
  "poNumber": "PO-2026-000001",
  "purchaseRequestId": "pr1...",
  "supplierId": "s1...",
  "warehouseId": "w1...",
  "status": "DRAFT",
  "items": [
    {
      "id": "poi1...",
      "productId": "p1...",
      "orderedQuantity": 100,
      "receivedQuantity": 0
    }
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

Error: `VALIDATION_ERROR` (422), `PURCHASE_REQUEST_NOT_FOUND` (404),
`PURCHASE_REQUEST_NOT_APPROVED` (409), `PURCHASE_ORDER_ALREADY_EXISTS` (409),
`SUPPLIER_INACTIVE` (422).

### GET `/api/purchase-orders` — `auth`

Query: `status`, `supplierId`, `warehouseId`, `page`, `pageSize`.

### GET `/api/purchase-orders/:id` — `auth`

Response `200`: PO + `items`. Error: `PURCHASE_ORDER_NOT_FOUND` (404).

### POST `/api/purchase-orders/:id/mark-ordered` — `USER`

Tidak ada body. `DRAFT` → `ORDERED`.
Error: `PURCHASE_ORDER_INVALID_TRANSITION` (409) bila bukan `DRAFT`.

### POST `/api/purchase-orders/:id/cancel` — `USER`

Tidak ada body. `DRAFT`/`ORDERED` → `CANCELLED`.
Error: `PURCHASE_ORDER_INVALID_TRANSITION` (409) bila sudah ada penerimaan atau status
final.

---

## 8. Goods Receipt

### POST `/api/goods-receipts` — `USER`

```json
{
  "purchaseOrderId": "po1...",
  "receivedAt": "2026-09-05T08:00:00.000Z",
  "items": [{ "purchaseOrderItemId": "poi1...", "receivedQuantity": 60 }]
}
```

Proses (satu transaksi, atomic):

1. Buat `good_receipts` + `good_receipt_items`.
2. Tambah `received_quantity` tiap `purchase_order_items` terkait.
3. Hitung ulang status PO (`ORDERED` / `PARTIALLY_RECEIVED` / `RECEIVED`).
4. Tambah `inventories.quantity` (warehouse PO, product item).
5. Tulis 1 `inventory_movements` (`PURCHASE_RECEIPT`, `+qty`, reference ke GR).

Kalau salah satu langkah gagal, seluruh transaksi di-rollback.

Response `201`:

```json
{
  "id": "gr1...",
  "grNumber": "GR-2026-000001",
  "purchaseOrderId": "po1...",
  "receivedBy": "u1...",
  "receivedAt": "2026-09-05T08:00:00.000Z",
  "items": [
    {
      "id": "gri1...",
      "purchaseOrderItemId": "poi1...",
      "productId": "p1...",
      "receivedQuantity": 60
    }
  ],
  "purchaseOrder": { "id": "po1...", "status": "PARTIALLY_RECEIVED" },
  "createdAt": "..."
}
```

Error:

- `VALIDATION_ERROR` (422) — body salah / `receivedQuantity <= 0`
- `PURCHASE_ORDER_NOT_FOUND` (404)
- `PURCHASE_ORDER_NOT_RECEIVABLE` (409) — PO `DRAFT` / `RECEIVED` / `CANCELLED`
- `GOODS_RECEIPT_EMPTY` (422) — `items` kosong
- `GOODS_RECEIPT_INVALID_ITEM` (422) — `purchaseOrderItemId` bukan milik PO ini
- `GOODS_RECEIPT_QUANTITY_EXCEEDED` (422) — total terima > `orderedQuantity`

### GET `/api/goods-receipts/:id` — `auth`

Response `200`: GR + `items`. Error: `GOODS_RECEIPT_NOT_FOUND` (404).

### GET `/api/purchase-orders/:id/goods-receipts` — `auth`

Response `200`: `{ "data": [ /* GR ringkas */ ] }`.

---

## 9. Asumsi kontrak (ringkasan)

Detail di [`../ASSUMPTIONS.md`](../ASSUMPTIONS.md).

- CRUD master data boleh oleh user terautentikasi mana pun (tidak ada role khusus admin
  di requirement).
- **Purchase Request:** `USER` hanya melihat PR miliknya; `APPROVER` melihat semua PR
  semua status. **Purchase Order / Goods Receipt / Inventory:** boleh dibaca semua user
  terautentikasi. Aksi tulis & transisi status dibatasi role/kepemilikan.
- Master data dihapus secara soft (`isActive = false`), tidak ada endpoint hard delete.
- PR & PO tidak punya endpoint delete — hanya perubahan status.
- `PATCH` dipakai untuk update parsial; field yang tidak dikirim tidak diubah.
