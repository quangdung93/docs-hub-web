# Báo lỗi API — docs-hub-api

Kết quả test trên `https://api.docshub.io.vn`, tài khoản `admin@local`, ngày
21/08/2026. Toàn bộ endpoint có trong Swagger đã được gọi thử.

Mỗi mục ghi rõ: endpoint, hiện tượng, và cách tái hiện.

---

## 1. `POST /internal/api/v1/projects/{id}/documents/uploads` — 500 từ lần upload thứ hai

**Mức độ: nghiêm trọng — chặn toàn bộ tính năng upload.**

Lần upload đầu tiên sau khi service khởi động thì thành công. Từ lần thứ hai trở
đi, **mọi** request đều trả:

```
HTTP 500
{"success":false,"data":null,
 "error":{"code":"SYS_500","message":"Không thể tạo revision","retryable":false}}
```

### Đã thử để khoanh vùng

| Thay đổi                                                   | Kết quả       |
| ---------------------------------------------------------- | ------------- |
| Đổi định dạng file (TXT, MD, CSV, PDF, DOCX, XLSX)          | 500 ở tất cả  |
| Đổi sang version khác (version seed sẵn)                    | 500           |
| Đổi sang version mới tạo qua `POST /versions`               | 500           |
| Đổi sang project khác (`20000000-...-0001`, chưa từng dùng) | 500           |

Không phụ thuộc file, version hay project.

### Phần validate vẫn chạy đúng

| Trường hợp                                | Kết quả                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| File `.bin` (định dạng không hỗ trợ)      | `400 REQ_400` — "Chỉ hỗ trợ TXT, Markdown, CSV, PDF text-layer, DOCX và XLSX"     |
| `sha256` sai                              | `400 REQ_400` — "SHA-256 file không khớp"                                        |
| Không truyền version lẫn change request   | `400 REQ_400` — "Phải chọn đúng một version hoặc change request"                 |
| `project_version_id` không thuộc project  | `400 REQ_400` — "Scope không thuộc project"                                      |

Các case 400 vẫn trả về đúng ngay cả khi case hợp lệ đang 500. Vậy lỗi **không
nằm ở tầng validate**, mà ở bước ghi storage / gọi RAGFlow phía sau.

Hiện tượng "chạy được đúng một lần rồi hỏng vĩnh viễn" thường là rò rỉ
connection hoặc file handle không được giải phóng.

### Vấn đề đi kèm: request lỗi vẫn ghi DB

Ở lần upload thành công, thứ tự xử lý cho thấy vấn đề: bản ghi `document` và
`revision` **đã commit vào DB** trước khi bước sau thất bại. Kết quả là revision
kẹt ở `status: "queued"` vĩnh viễn — không tự chạy tiếp, và cũng không retry
được vì:

```
POST /documents/{docId}/revisions/{revId}/retry
→ {"code":"DOCUMENT_RETRY_INVALID","message":"Chỉ revision thất bại mới được retry"}
```

Revision đang ở `queued` chứ không phải `failed` nên bị từ chối.

Đề nghị: bọc bước tạo revision trong transaction, hoặc rollback khi bước sau
thất bại. Ngoài ra nên cho phép retry cả revision kẹt `queued` quá lâu.

### Ghi chú: phần lưu file hoạt động đúng

Ở lần upload thành công, file lưu nguyên vẹn. Tải lại bằng
`GET /revisions/{id}/download` rồi so sánh:

```
File gốc: 8feca1b0a0cd5be7ff4290bddc4c79ef88e6716832ee249f0736f32d3333101e
Tải về:   8feca1b0a0cd5be7ff4290bddc4c79ef88e6716832ee249f0736f32d3333101e
```

SHA-256 khớp 100%. Phần đọc/ghi object storage không có vấn đề.

---

## 2. `GET /internal/api/v1/projects/{id}/documents` — filter `status`, `type`, `version_id` trả 500

**Mức độ: cao.**

Ba query param có trong Swagger nhưng gọi vào là 500:

```
GET /documents                          → 200
GET /documents?page=1&limit=5           → 200
GET /documents?q=api                    → 200
GET /documents?status=indexed           → 500  SYS_500
GET /documents?type=application/pdf     → 500  SYS_500
GET /documents?version_id=<uuid hợp lệ> → 500  SYS_500
```

Mỗi param gây lỗi độc lập, không cần kết hợp. `page`, `limit`, `q` bình thường.

Message trả về là lỗi chung "Đã có lỗi hệ thống. Vui lòng thử lại sau.", không
phải lỗi validate — nhiều khả năng lỗi khi build câu query.

---

## 3. `POST /internal/api/v1/projects/{id}/retrieval` — có trong Swagger nhưng chưa deploy

**Mức độ: cao — đây là API của tính năng tra cứu.**

```
POST /internal/api/v1/projects/{id}/retrieval
→ 404 page not found
```

Trả về **404 dạng text trần**, không phải envelope JSON như các lỗi khác — dấu
hiệu route chưa được đăng ký, chứ không phải resource không tồn tại.

Để so sánh, cùng project và cùng token:

```
POST /internal/api/v1/projects/{id}/versions → 201 (bình thường)
```

Nên không phải vấn đề project hay xác thực. Xin xác nhận bản deploy hiện tại đã
bao gồm route này chưa.

---

## 4. `POST /internal/api/v1/projects/{id}/avatar/upload-url` — presigned URL trỏ hostname nội bộ

**Mức độ: cao — chặn toàn bộ luồng ảnh đại diện.**

Endpoint trả về:

```
http://minio:9000/document-hub/projects/{id}/avatar?X-Amz-Algorithm=...
```

Hai vấn đề:

1. **`minio` là service name trong Docker network.** Không có bản ghi DNS công
   khai — đã kiểm tra `minio`, `minio.docshub.io.vn`, `storage.docshub.io.vn`,
   `s3.docshub.io.vn`, không cái nào resolve được. Client bên ngoài không thể
   PUT lên URL này.
2. **Scheme là `http`** trong khi hệ thống chạy trên HTTPS.

Lưu ý: không thể sửa host ở phía client, vì host nằm trong phần được ký — đổi
host là chữ ký mất hiệu lực.

Cần cấu hình MinIO có endpoint công khai qua HTTPS và ký presigned URL theo host
đó (`MINIO_PUBLIC_ENDPOINT` hoặc tương đương).

`POST /documents/uploads/presign` trả về `http://minio:9000/...` — cùng vấn đề.

---

## 5. `POST /internal/api/v1/auth/logout` — không thu hồi token

**Mức độ: cao (bảo mật).**

Gọi logout trả về thành công, nhưng token cũ **vẫn dùng được bình thường**:

```
POST /auth/logout        → 200 success
GET  /auth/me (token cũ) → 200, vẫn trả về user
```

Token vẫn hợp lệ cho đến khi hết hạn theo `exp`. Nghĩa là logout hiện không có
tác dụng thực sự về phía server — token bị lộ vẫn dùng được kể cả sau khi user
đã đăng xuất.

---

## 6. Không có refresh token — phiên hết hạn sau 15 phút

**Mức độ: cao (trải nghiệm).**

`POST /auth/login` chỉ trả về một `token` duy nhất, không có refresh token.
Payload token decode ra:

```json
{ "exp": 1787214108, "iat": 1787213208 }
```

`exp - iat = 900` giây = **15 phút**. Hết 15 phút là phải đăng nhập lại, mất
việc đang làm giữa chừng.

Đề nghị bổ sung refresh token + `POST /auth/refresh`, lưu refresh token trong DB
để thu hồi được — đồng thời giải quyết luôn mục 5 ở trên.

---

## 7. `GET /internal/api/v1/projects/{id}/documents` — response thiếu thông tin revision

**Mức độ: trung bình — không lỗi, nhưng gây tải không cần thiết.**

Response hiện tại của mỗi document:

```json
{
  "id": "...",
  "project_id": "...",
  "title": "...",
  "description": "...",
  "document_key": "...",
  "version": 1,
  "created_at": "...",
  "updated_at": "..."
}
```

Không có thông tin file: tên file, dung lượng, MIME type, trạng thái ingestion —
tất cả đều nằm ở revision, mà list không trả revision.

Hệ quả: muốn biết trạng thái của N document phải gọi thêm N request
`GET /documents/{id}`. 20 document = 21 request.

**Đề nghị bổ sung `latest_revision` vào từng phần tử:**

```json
"latest_revision": {
  "id": "...",
  "revision_no": 1,
  "file_name": "bao_cao.xlsx",
  "media_type": "application/vnd...spreadsheetml.sheet",
  "size_bytes": 16092,
  "status": "ready",
  "ragflow_sync_status": "pending",
  "error_detail": null
}
```

---

## 8. Thiếu `DELETE /internal/api/v1/projects/{id}/versions/{versionId}`

**Mức độ: trung bình.**

Có `POST /versions` (tạo) và `GET /versions` (liệt kê), nhưng không có endpoint
xoá. Version tạo nhầm không gỡ được bằng API.

Hiện trong project `Docs Hub Demo` (`10000000-0000-4000-8000-000000000001`) còn
3 version nháp tạo lúc test, nhờ team xoá trực tiếp dưới DB:

- `v9.9.9-fe-probe`
- `v9.9.8-probe2`
- `v-fe-e2e-probe`

---

## 9. Thiếu `GET /internal/api/v1/projects/{id}` — lấy chi tiết một project

**Mức độ: trung bình.**

Chỉ có `GET /projects` (danh sách). Muốn lấy thông tin một project cụ thể phải
gọi danh sách rồi tự lọc — sai khi số project vượt quá `limit`.

---

## 10. `ProjectResponse` thiếu các counter

**Mức độ: thấp.**

Không có `document_count`, `member_count`, `chunk_count`. Muốn hiển thị các số
này phải gọi thêm nhiều endpoint và tự đếm.

---

## 11. `GET /internal/api/v1/projects/{id}/members` — chỉ trả `user_id`

**Mức độ: thấp.**

`ProjectMemberResponse` chỉ có `user_id`, không có tên hay email. Muốn hiển thị
danh sách thành viên phải gọi `GET /users/{id}` cho từng người — 5 thành viên là
5 request.

Đề nghị join sẵn:

```json
"user": { "id": "...", "full_name": "...", "email": "...", "job_title": "..." }
```

Hoặc nếu không join được thì cho `GET /users?ids=a,b,c` để lấy nhiều user một lần.

---

## 12. Tài khoản seed `admin@local` không phải email hợp lệ

**Mức độ: thấp — ghi nhận để tránh mâu thuẫn về sau.**

`username` của tài khoản mặc định là `admin@local`, thiếu phần TLD nên không qua
được validate email theo chuẩn. Nếu về sau có ràng buộc `username` phải là email
hợp lệ thì chính tài khoản seed sẽ không đăng nhập được.

---

## 13. JWT thiếu thông tin; `roles` trả về dạng chuỗi JSON

**Mức độ: thấp — đề xuất.**

Payload token hiện tại:

```json
{
  "user_id": "...",
  "email": "admin@local",
  "roles": "[...]",
  "iss": "docs-hub-api",
  "sub": "...",
  "exp": 0,
  "iat": 0
}
```

Hai ghi chú:

1. Không có claim tên hiển thị, nên chỉ có `username` để hiển thị.
2. `roles` trong response của `POST /auth/login` là **chuỗi JSON**, không phải
   mảng — phải parse hai lần. Trả thẳng mảng sẽ nhất quán hơn.

Nếu muốn bên gọi verify được chữ ký, đề nghị expose **JWKS endpoint** (RS256)
thay vì chia sẻ secret HS256.

---

## 14. `status` của project — chưa rõ tập giá trị hợp lệ

**Mức độ: thấp.**

Tài liệu ghi `status: string` nhưng không liệt kê giá trị. Xin xác nhận danh
sách đầy đủ (dùng `oneof` như các field khác). Hiện quan sát được `active`.

---

## Phụ lục — đã test và hoạt động đúng

Ghi lại để khoanh vùng, các phần này không cần sửa.

### Định dạng file được chấp nhận

Đã xác nhận bằng test thực tế:

- **Nhận:** TXT, Markdown, CSV, PDF (có text-layer), DOCX, XLSX
- **Từ chối:** các định dạng khác, trả `REQ_400` kèm message liệt kê rõ
- **Không nhận** `.doc` / `.xls` đời cũ (chỉ nhận OOXML)

### Endpoint hoạt động đúng

| Nhóm     | Endpoint                                                                     |
| -------- | ---------------------------------------------------------------------------- |
| auth     | `POST /auth/login`, `GET /auth/me`                                           |
| user     | list, create, detail, update, update status, delete, check-email             |
| project  | list, create, update, delete, members (list/invite/accept/change role/remove) |
| version  | `GET /versions`, `POST /versions`                                            |
| document | `GET /documents` (không filter), `GET /documents/{id}`, `PATCH`, `DELETE`    |
| revision | `/status`, `/download`, `/view`                                              |

Các mã lỗi nghiệp vụ trả về đúng như tài liệu: `CONFIRM_NAME_MISMATCH`,
`IMAGE_INVALID`, `FILE_TOO_LARGE`, `AVATAR_NOT_UPLOADED`, `ALREADY_MEMBER`,
`INVITE_NOT_PENDING`, `CANNOT_MODIFY_OWNER`, `CONFLICT_VERSION`,
`DUPLICATE_EMAIL`, `AUTH_401`, `DOCUMENT_RETRY_INVALID`, `NOT_FOUND`.

Envelope `{success, data, error, meta}`, quy ước lỗi nghiệp vụ trả HTTP 200 kèm
`success:false`, và `meta.pagination` đều nhất quán.

Luồng thành viên đã test đủ vòng: tạo user → tạo project → mời (pending) →
accept (active, có `joined_at`) → đổi role → xoá (204).

---

## Tổng hợp

| #   | Endpoint / vấn đề                                                        | Mức độ          |
| --- | ------------------------------------------------------------------------ | --------------- |
| 1   | `POST /documents/uploads` — 500 từ lần thứ 2; request lỗi vẫn ghi DB     | **Nghiêm trọng** |
| 2   | `GET /documents` — filter `status`/`type`/`version_id` trả 500           | Cao             |
| 3   | `POST /retrieval` — 404, chưa deploy                                     | Cao             |
| 4   | `avatar/upload-url` + `uploads/presign` — trả host nội bộ `minio:9000`   | Cao             |
| 5   | `POST /auth/logout` — không thu hồi token                                | Cao             |
| 6   | Không có refresh token, phiên chỉ 15 phút                                | Cao             |
| 7   | `GET /documents` — thiếu `latest_revision`, gây N+1                      | Trung bình      |
| 8   | Thiếu `DELETE /versions/{id}`                                            | Trung bình      |
| 9   | Thiếu `GET /projects/{id}`                                               | Trung bình      |
| 10  | `ProjectResponse` thiếu `document_count` / `member_count` / `chunk_count` | Thấp            |
| 11  | `GET /members` chỉ trả `user_id`, không có tên/email                     | Thấp            |
| 12  | Tài khoản seed `admin@local` không phải email hợp lệ                     | Thấp            |
| 13  | JWT thiếu tên hiển thị; `roles` trả về dạng chuỗi JSON                   | Thấp            |
| 14  | Chưa chốt tập giá trị `status` của project                               | Thấp            |
