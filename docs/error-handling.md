# Error Handling

Semua endpoint memakai format error yang sama. Tidak ada endpoint yang membuat JSON
error sendiri — semua error dilempar sebagai exception dan dibentuk di satu tempat
(`src/middleware/error-handler.ts`, fungsi `onError`).

---

## 1. Format response

```json
{
  "error": {
    "code": "PURCHASE_REQUEST_NOT_APPROVED",
    "message": "Purchase Request must be approved before creating a Purchase Order.",
    "details": null
  }
}
```

| field           | tipe             | keterangan                                                                        |
| --------------- | ---------------- | --------------------------------------------------------------------------------- |
| `error.code`    | string           | Kode stabil, huruf besar + underscore. Dipakai client untuk cek jenis error       |
| `error.message` | string           | Pesan yang bisa dibaca manusia. Boleh berubah, jangan dipakai untuk logika        |
| `error.details` | any \| tidak ada | Opsional. Diisi untuk error validasi (daftar field yang salah) atau info tambahan |

- `message` memakai Bahasa Inggris singkat supaya konsisten dengan konvensi kode.
- Response sukses **tidak** dibungkus — hanya error yang punya amplop `{ error: ... }`.

---

## 2. HTTP status code

| status | dipakai untuk                                                                          |
| ------ | -------------------------------------------------------------------------------------- |
| `400`  | Request tidak bisa diproses secara umum (`BAD_REQUEST`)                                |
| `401`  | Belum login / token tidak valid (`UNAUTHORIZED`)                                       |
| `403`  | Sudah login tapi role tidak berhak (`FORBIDDEN`)                                       |
| `404`  | Resource / route tidak ditemukan                                                       |
| `409`  | Konflik dengan state / data sekarang (unique bentrok, transisi status salah, dobel PO) |
| `422`  | Body lolos parsing tapi gagal validasi (format/range) atau melanggar business rule     |
| `500`  | Error tak terduga di server (`INTERNAL_SERVER_ERROR`)                                  |

Catatan pembagian `409` vs `422`:

- **`409`** — request-nya valid, tapi bentrok dengan kondisi sekarang: SKU sudah ada,
  PR sudah punya PO, PO sudah `RECEIVED`, transisi status tidak diizinkan.
- **`422`** — bentuk request salah atau nilainya melanggar aturan: `quantity <= 0`,
  product tidak aktif, total terima melebihi yang dipesan.

---

## 3. Error validasi input

Body yang gagal di-parse schema (Zod) selalu jadi:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "path": ["items", 0, "quantity"], "message": "Number must be greater than 0" }]
  }
}
```

- Status: `422`
- `details` = daftar issue dari Zod (`path` + `message`), supaya client tahu field mana
  yang salah.

---

## 4. Katalog error code

### Umum / HTTP

| code                    | status | kapan                                                |
| ----------------------- | ------ | ---------------------------------------------------- |
| `VALIDATION_ERROR`      | 422    | Body gagal validasi schema                           |
| `UNAUTHORIZED`          | 401    | Tidak ada / salah token                              |
| `FORBIDDEN`             | 403    | Role tidak berhak (mis. USER coba approve PR)        |
| `NOT_FOUND`             | 404    | Resource by id tidak ada                             |
| `ROUTE_NOT_FOUND`       | 404    | URL tidak terdaftar                                  |
| `CONFLICT`              | 409    | Konflik generik yang tidak punya code lebih spesifik |
| `INTERNAL_SERVER_ERROR` | 500    | Exception tak tertangani                             |

### Auth

| code                  | status | kapan                             |
| --------------------- | ------ | --------------------------------- |
| `INVALID_CREDENTIALS` | 401    | Email / password salah saat login |

### Master data

| code                            | status | kapan                                                 |
| ------------------------------- | ------ | ----------------------------------------------------- |
| `SKU_ALREADY_EXISTS`            | 409    | Buat / ubah product dengan SKU yang sudah dipakai     |
| `WAREHOUSE_CODE_ALREADY_EXISTS` | 409    | Buat / ubah warehouse dengan code yang sudah dipakai  |
| `EMAIL_ALREADY_EXISTS`          | 409    | Email user sudah dipakai (kalau ada endpoint terkait) |
| `PRODUCT_INACTIVE`              | 422    | Pakai product `is_active = false` di transaksi baru   |
| `SUPPLIER_INACTIVE`             | 422    | Pakai supplier tidak aktif untuk PO baru              |
| `WAREHOUSE_INACTIVE`            | 422    | Pakai warehouse tidak aktif di transaksi baru         |

### Purchase Request

| code                                  | status | kapan                                                |
| ------------------------------------- | ------ | ---------------------------------------------------- |
| `PURCHASE_REQUEST_NOT_FOUND`          | 404    | PR by id tidak ada                                   |
| `PURCHASE_REQUEST_NOT_EDITABLE`       | 409    | Edit item / warehouse saat status bukan `DRAFT`      |
| `PURCHASE_REQUEST_EMPTY`              | 422    | Submit PR yang tidak punya item                      |
| `PURCHASE_REQUEST_DUPLICATE_PRODUCT`  | 422    | Tambah product yang sudah ada di PR yang sama        |
| `PURCHASE_REQUEST_NOT_SUBMITTED`      | 409    | Approve / reject PR yang statusnya bukan `SUBMITTED` |
| `PURCHASE_REQUEST_INVALID_TRANSITION` | 409    | Transisi status PR yang tidak diizinkan              |
| `PURCHASE_REQUEST_NOT_APPROVED`       | 409    | Buat PO dari PR yang statusnya bukan `APPROVED`      |

> Catatan: kalau USER yang bukan pemilik PR mencoba edit/submit, dipakai `FORBIDDEN`.

### Purchase Order

| code                                | status | kapan                                                                                             |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `PURCHASE_ORDER_NOT_FOUND`          | 404    | PO by id tidak ada                                                                                |
| `PURCHASE_ORDER_ALREADY_EXISTS`     | 409    | PR sumber sudah punya PO                                                                          |
| `PURCHASE_ORDER_INVALID_TRANSITION` | 409    | Transisi status PO yang tidak diizinkan (mis. `ORDERED` → `DRAFT`, cancel setelah ada penerimaan) |
| `PURCHASE_ORDER_NOT_RECEIVABLE`     | 409    | Goods Receipt saat PO `DRAFT` / `RECEIVED` / `CANCELLED`                                          |

### Goods Receipt

| code                              | status | kapan                                                          |
| --------------------------------- | ------ | -------------------------------------------------------------- |
| `GOODS_RECEIPT_NOT_FOUND`         | 404    | GR by id tidak ada                                             |
| `GOODS_RECEIPT_EMPTY`             | 422    | Buat GR tanpa item                                             |
| `GOODS_RECEIPT_INVALID_ITEM`      | 422    | Item GR menunjuk `purchase_order_item` yang bukan milik PO ini |
| `GOODS_RECEIPT_QUANTITY_EXCEEDED` | 422    | `received_quantity` kumulatif melebihi `ordered_quantity`      |

> `received_quantity <= 0` ditangkap lebih dulu oleh validasi schema → `VALIDATION_ERROR`.

---

## 5. Konsistensi

- Setiap error melewati satu handler `onError`. Handler mengenali:
  - `AppError` (error domain yang kita lempar sendiri) → pakai `status`, `code`,
    `message`, `details` dari objeknya.
  - `ZodError` → `422` + `VALIDATION_ERROR`.
  - `HTTPException` bawaan Hono → dipetakan ke `HTTP_EXCEPTION`.
  - selain itu → `500` + `INTERNAL_SERVER_ERROR`, error asli di-log ke server, detail
    internal tidak dibocorkan ke client.
- Route yang tidak terdaftar ditangani `notFound` → `404` + `ROUTE_NOT_FOUND`.
- Ketika sebuah operasi gagal di tengah transaksi (mis. Goods Receipt), transaksi
  di-rollback penuh sebelum error dikembalikan — tidak ada data setengah jadi.
