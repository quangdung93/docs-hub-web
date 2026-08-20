# Yêu cầu bổ sung API — docs-hub-api

Đối chiếu `tai-lieu-api-docs-hub.md` với FE đã dựng (7 màn hình). Phần `auth`,
`user`, `project` đã map xong và chạy được. Tài liệu này liệt kê những gì còn
thiếu để chạy thật, xếp theo mức độ chặn.

Ghi chú chung: FE đã dùng đúng envelope `{success, data, error, meta}`, quy ước
lỗi nghiệp vụ trả HTTP 200 kèm `success:false`, và phân trang qua
`meta.pagination`. **Các API mới xin giữ nguyên các quy ước này.**

---

## P0 — Bug đang có trên production (phát hiện khi test thật 20/08/2026)

Đã chạy toàn bộ 22 endpoint của `https://api.docshub.io.vn` qua BFF của FE bằng
tài khoản `admin@local`. Ba module `auth`/`user`/`project` khớp tài liệu, kể cả
các mã lỗi nghiệp vụ (`CONFIRM_NAME_MISMATCH`, `IMAGE_INVALID`, `FILE_TOO_LARGE`,
`AVATAR_NOT_UPLOADED` đều trả đúng). Hai vấn đề dưới đây thì phải sửa ở BE.

### 0.1. `avatar/upload-url` trả hostname nội bộ Docker — luồng ảnh hỏng hoàn toàn

`POST /projects/{id}/avatar/upload-url` trả về:

```
http://minio:9000/document-hub/projects/{id}/avatar?X-Amz-Algorithm=...
```

`minio` là service name trong Docker network, **trình duyệt không resolve được**
(đã kiểm tra: không có bản ghi DNS công khai, `minio.docshub.io.vn` và
`storage.docshub.io.vn` đều không tồn tại). Theo đúng tài liệu thì FE phải `PUT`
thẳng file lên URL này từ browser — nên bước 2b sẽ luôn fail.

Thêm nữa scheme là `http`, trong khi FE chạy trên `https://docshub.io.vn`: kể cả
khi host resolve được, browser vẫn chặn vì mixed content.

**Cần:** MinIO có endpoint công khai qua HTTPS, và presigned URL phải ký theo
đúng public host đó (`MINIO_PUBLIC_ENDPOINT` hoặc tương đương), không phải
`minio:9000`. Ký bằng host nội bộ rồi FE tự đổi host sẽ làm sai chữ ký.

### 0.2. Tài khoản seed `admin@local` không phải email hợp lệ

`username` của tài khoản mặc định là `admin@local` — thiếu TLD nên trượt mọi
validate email chuẩn. FE đã xử lý phía mình (coi `username` là định danh đăng
nhập, không validate như email). Nêu ra để BE biết: nếu có chỗ nào ràng buộc
`username` phải là email thì tài khoản seed sẽ tự mâu thuẫn.

### 0.3. Token JWT — xác nhận cách FE đang dùng

Token BE ký có payload `{user_id, email, roles, iss, sub, exp, iat}` — không có
`aud`, không có tên hiển thị. FE **không verify chữ ký** (không giữ secret của
BE, và cũng không nên), chỉ decode để lấy `roles`/`email` cho việc render và
điều hướng; mọi quyết định phân quyền vẫn do BE kiểm ở từng request.

Nếu sau này BE muốn FE verify được, xin expose **JWKS endpoint** (RS256) thay vì
chia sẻ secret HS256.

---

## P0 — Chặn hẳn, không có thì màn hình không chạy được

### 1. Module `document` (chưa có gì)

Chặn 2 màn: **Quản lý tài liệu** và **Tải dữ liệu**.

| Method | Path đề xuất | Body / Query | Response |
|---|---|---|---|
| GET | `/internal/api/v1/projects/{id}/documents` | `page,limit,keyword,status,format` | `DocumentResponse[]` + phân trang |
| POST | `/internal/api/v1/projects/{id}/documents` | multipart `file` | `DocumentResponse` (201) |
| DELETE | `/internal/api/v1/projects/{id}/documents/{docId}` | — | 204 |
| GET | `/internal/api/v1/projects/{id}/documents/{docId}/download` | — | file hoặc presigned URL |

`DocumentResponse` FE đang cần:

```ts
{ id: string; project_id: string; name: string;
  mime_type: string; size_bytes: number;
  page_count: number | null;      // hiện ở dòng phụ "PDF · 24 trang"
  chunk_count: number | null;      // cột "Số đoạn", null khi chưa index xong
  status: "queued" | "processing" | "indexed" | "failed";
  error_message: string | null;    // khi status = failed, để hiện lý do
  updated_at: string }
```

**Câu hỏi cần chốt:**

- **Upload qua backend hay presigned URL như avatar?** Nếu dùng presigned thì
  cho luồng 3 bước giống avatar, FE làm y hệt được.
- **FE biết khi nào index xong bằng cách nào?** Đây là câu quan trọng nhất, ảnh
  hưởng trực tiếp tới code:
  - (a) FE tự poll `GET /documents` mỗi vài giây → cần biết nên poll bao lâu 1 lần;
  - (b) SSE/WebSocket đẩy trạng thái về;
  - (c) hoặc có endpoint riêng kiểu `GET /documents/{id}/status` cho nhẹ.
  Hiện FE đang giả định (a). Nếu BE làm (b) thì tốt hơn nhiều, đỡ tải server.
- **Giới hạn dung lượng và định dạng thật là gì?** FE đang chặn client-side ở
  20 MB và PDF/DOCX/TXT/MD — cần khớp với BE để không có file qua được FE mà BE
  từ chối.

Mã lỗi nghiệp vụ dự kiến cần: `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`,
`DUPLICATE_DOCUMENT` (nếu chặn trùng tên).

### 2. Module `chat` (chưa có gì)

Chặn màn **Tra cứu thông tin** — tính năng lõi của sản phẩm.

| Method | Path đề xuất | Body / Query | Response |
|---|---|---|---|
| GET | `/internal/api/v1/projects/{id}/chat/history` | `page,limit` | `ChatMessageResponse[]` |
| POST | `/internal/api/v1/projects/{id}/chat` | `{question}` | `ChatMessageResponse` |

`ChatMessageResponse` FE đang cần:

```ts
{ id: string; role: "user" | "assistant"; content: string;
  citations: Array<{
    index: number;          // số [1] [2] xuất hiện trong content
    document_id: string;
    document_name: string;
    page: number;
    excerpt: string;        // đoạn trích để hiện ở panel bên phải
  }>;
  created_at: string }
```

**Câu hỏi cần chốt:**

- **Có stream token không?** Nếu có (SSE) thì cho biết format sự kiện. FE hiện
  làm request/response thường; đổi sang stream chỉ sửa 1 file `api/`.
- **Trích dẫn đánh dấu trong `content` thế nào?** FE đang parse marker dạng
  `[1]`, `[2]` và map với mảng `citations` theo `index`. Nếu BE dùng format khác
  (vd `[^1]` hoặc tag riêng) thì báo sớm.
- **Có xoá/sửa hội thoại không?** Chưa cần gấp.

---

## P1 — Không chặn nhưng đang phải làm cách vòng, tốn request

### 3. `GET /internal/api/v1/projects/{id}` — lấy chi tiết 1 dự án

Hiện **không có**. Màn Tra cứu, Quản lý tài liệu và Cấu hình đều cần thông tin
1 dự án cụ thể. FE đang phải gọi `GET /projects?limit=100` rồi lọc trong mảng —
chạy được nhưng sai về mặt thiết kế và vỡ khi 1 user có trên 100 dự án.

### 4. Counter trong `ProjectResponse`

Thiếu 3 field, FE đang hiện dấu `—` thay vì số:

```ts
document_count: number;
member_count: number;
chunk_count: number;      // tổng số đoạn đã index, hiện ở tab Tổng quan
```

Card dự án ở màn chọn dự án và ô "Tổng quan" trong Cấu hình đều hiển thị các số
này theo mockup.

### 5. `GET /projects/{id}/members` — trả kèm thông tin user

Hiện chỉ có `user_id`. Bảng thành viên theo mockup hiển thị avatar + tên + chức
danh, nên FE đang phải hiện `#a1b2c3d4` (id cắt ngắn).

Xin bổ sung vào `ProjectMemberResponse`:

```ts
user: { id: string; full_name: string; email: string; job_title?: string }
```

Nếu không join được thì cho **`GET /users?ids=a,b,c`** (lấy nhiều user 1 lần) —
FE tự ghép. Đừng để FE phải gọi `GET /users/{id}` từng người, 5 thành viên là 5
request (N+1).

### 6. Cấu hình dự án — thiếu field so với mockup

`settings` hiện có `{model, top_k, chunk_size, allowed_formats}`. Màn Cấu hình
theo mockup còn 5 mục nữa, FE đang hiện "Chưa hỗ trợ":

```ts
embedding_model: string;   // "Mô hình embedding"
chunk_overlap: number;     // "Độ chồng lấn"
audit_log: boolean;        // toggle "Ghi audit log truy cập tài liệu"
members_only: boolean;     // toggle "Chỉ thành viên dự án được truy cập"
allow_export: boolean;     // toggle "Cho phép xuất kết quả ra Word/Markdown"
```

Kèm theo: **API ghi settings**. Hiện `PATCH /projects/{id}` có nhận `settings`
nhưng chưa rõ ghi được field nào — cần xác nhận, hoặc tách endpoint riêng.

Nếu 3 toggle bảo mật chưa nằm trong kế hoạch thì báo để FE **bỏ hẳn khỏi UI**,
đỡ hiển thị chức năng không tồn tại.

---

## P2 — Nên có, ảnh hưởng trải nghiệm

### 7. Refresh token

Login chỉ trả 1 `token`. Token hết hạn là user bị đá về màn đăng nhập giữa chừng,
mất việc đang làm. Xin bổ sung refresh token + `POST /auth/refresh`, hoặc cho
biết **thời hạn token** để FE cảnh báo trước khi hết.

### 8. `status` của dự án — giá trị hợp lệ

Tài liệu ghi `status: string` không liệt kê giá trị. FE đang giả định
`active | archived`. Xin xác nhận danh sách đầy đủ (dùng `oneof` như các field
khác).

### 9. RBAC

Tài liệu ghi rõ **RBAC đang tắt** — mọi user đăng nhập đều sửa/xóa được dự án
của người khác. FE chưa ẩn nút theo quyền vì chưa có thông tin vai trò của user
hiện tại trong dự án.

Khi bật RBAC, xin cho biết vai trò của người đang đăng nhập ở mỗi dự án — thêm
`my_role: "owner"|"editor"|"viewer"` vào `ProjectResponse` là gọn nhất. FE sẽ ẩn
nút theo đó.

### 10. Cho phép đổi chủ dự án

Tài liệu ghi owner cố định từ lúc tạo. Thực tế người ta nghỉ việc / chuyển team.
Không gấp nhưng nên có trong kế hoạch.

---

## Tóm tắt cho BE

| # | Việc | Mức |
|---|---|---|
| 0 | Presigned URL avatar trả `minio:9000` → browser không gọi được | **P0 (bug)** |
| 1 | Module `document` (4 API + trạng thái index) | **P0** |
| 2 | Module `chat` (2 API + cấu trúc citation) | **P0** |
| 3 | `GET /projects/{id}` | P1 |
| 4 | 3 counter trong `ProjectResponse` | P1 |
| 5 | Member list kèm tên/email user | P1 |
| 6 | 5 field settings còn thiếu + API ghi settings | P1 |
| 7 | Refresh token | P2 |
| 8 | Chốt giá trị `status` dự án | P2 |
| 9 | `my_role` khi bật RBAC | P2 |
| 10 | Đổi chủ dự án | P2 |

**Câu hỏi cần trả lời sớm nhất** (ảnh hưởng cách FE viết code, không chỉ là thêm field):

1. Tài liệu upload: qua backend hay presigned URL?
2. FE biết index xong bằng cách nào — poll, SSE, hay WebSocket?
3. Chat có stream không?
