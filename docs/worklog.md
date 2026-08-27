# Nhật ký công việc — Docs Hub Web

> **Lịch sử.** Môi trường `mobix.asia/docshub_su5` đã ngừng ngày 27/08/2026;
> production hiện là `https://docshub.io.vn`, deploy tự động qua
> `.github/workflows/deploy.yml`. Giữ trang này để tra lại quyết định cũ.

Ghi lại những gì đã làm trên nhánh `feat/docs-hub-ui` (PR #1), từ mockup HTML
tới bản chạy được trên `mobix.asia/docshub_su5`.

**Phạm vi:** 18 commit · 121 file · +6.760 / −243 dòng
**Trạng thái:** đang chờ review, chưa merge vào `main`

---

## 1. Dựng giao diện từ mockup

Đầu vào là 1 file HTML tĩnh (`docs-hub-mockup.html`, 707 dòng, Tailwind CDN).
Đầu ra là 7 màn hình chạy được trên Next.js 16 theo kiến trúc có sẵn của repo.

| Màn hình | Đường dẫn |
|---|---|
| Đăng nhập | `/login` |
| Chọn dự án | `/projects` |
| Tạo dự án (2 bước) | `/projects/new` |
| Tra cứu (hỏi–đáp) | `/projects/[id]` |
| Quản lý tài liệu | `/projects/[id]/documents` |
| Tải dữ liệu | `/projects/[id]/documents/upload` |
| Quản lý dự án (3 tab) | `/projects/[id]/settings` |

Tuân thủ 3 yêu cầu đặt ra từ đầu:

1. **Theo cấu trúc source sẵn có** — feature-sliced `schemas → api → services →
   hooks → components`, Zod là nguồn sự thật, barrel export, `cn()` + design token.
2. **Component tái sử dụng** — 20 component trong `shared/ui`, mỗi cái phục vụ
   từ 2 màn trở lên. Ví dụ `UploadPanel` dùng chung cho màn Tải dữ liệu và bước 2
   của wizard; `SearchInput` dùng ở 3 màn.
3. **Core xử lý API** — `core/api/endpoints.ts` (registry mọi path) +
   `query-keys.ts`. Đổi backend chỉ sửa 1 file.

Số lượng: auth 5 component · projects 7 · documents 6 · chat 4.

---

## 2. Đa ngôn ngữ và giao diện sáng/tối

- **VI/EN** qua dictionary tự viết trong `core/i18n` — 179 key. Không dùng
  next-intl: 2 ngôn ngữ, không cần routing hay ICU, nên `Record` + cookie là đủ.
  Locale đọc từ cookie phía server nên lần render đầu đã đúng ngôn ngữ, không nháy.
- **Dark/light** qua `next-themes`, lưu cookie. Sau đó bỏ tuỳ chọn "system" vì
  toggle có thể không hiện trạng thái nào khi theme hệ thống lệch với lựa chọn đã
  lưu — trông như hỏng. Mặc định dark.

---

## 3. Ba lỗi có sẵn trong source, chặn hẳn việc đăng nhập

Phát hiện khi chạy thật, không phải khi đọc code. Gom vào 1 commit (`6e15589`)
để revert độc lập nếu cần.

| Lỗi | Hậu quả | Cách sửa |
|---|---|---|
| `@hookform/resolvers@3.10` không tương thích Zod 4 | Resolver **throw** thay vì trả lỗi → mọi form mất thông báo validate | Nâng lên `5.7.1` |
| `/api/auth/*` trả envelope thiếu `meta` | `apiSuccessSchema` từ chối → **đăng nhập đúng vẫn báo sai mật khẩu** | Thêm `successEnvelope`/`failureEnvelope` trong `core/api` |
| `.env.example` để `AUTH_SECRET=` rỗng | Env validation fail → app không boot | Điền placeholder + kèm lệnh generate |

---

## 4. Lọc định dạng tài liệu

Ban đầu nút "Tất cả định dạng" chỉ là nhãn tĩnh như mockup. Làm thành dropdown thật:

- Component `Select` dùng chung, dựng trên `<select>` native — được miễn phí điều
  hướng bàn phím, type-ahead, picker của iOS/Android và semantics cho screen reader.
- Lọc theo **đuôi file**, không theo chuỗi hiển thị: cột `format` là văn bản
  ("Word · 6 trang") nên sẽ vỡ ngay khi backend đổi hoặc dịch chữ.
- `.doc`/`.docx` và `.xls`/`.xlsx` gộp chung vì người dùng nghĩ theo ứng dụng.
- Đổi filter thì reset về trang 1, tránh hiện bảng rỗng.

---

## 5. Triển khai lên VPS

Chạy tại **https://mobix.asia/docshub_su5**, dùng chung hạ tầng với landing page
sẵn có.

```
internet → mobix-landing-nginx (:443, TLS)
             ├── /              → landing (có sẵn, không đụng)
             └── /docshub_su5   → docs-hub-web:3000
                                   └── docshub-mock:4000
```

Hai container không mở port ra ngoài — chỉ nginx sẵn có truy cập được qua network
nội bộ. `basePath` là **build arg** vì Next nhúng nó vào bundle client, không đổi
được lúc chạy.

### Hai sự cố trong quá trình deploy

**1. mobix.asia bị 404 xen kẽ (~50% request).** Compose của dự án này đặt service
tên `app`, trùng với service `app` của landing. Docker đăng ký tên service thành
DNS alias trên network chung → `app` trỏ về **cả 2 container**, nginx chia tải
luân phiên. Sửa bằng cách đổi tên thành `docshub-web`/`docshub-mock`, sau đó xác
minh 10/10 request đều 200.

**2. Sửa `nginx.conf` bằng `sed -i` không ăn.** File là bind-mount; `sed -i` thay
inode nên container vẫn đọc bản cũ. Phải `docker compose up -d --force-recreate
nginx`, reload không đủ.

Trong lúc rollback site có 404 khoảng 90 giây. Đã khôi phục từ backup ngay.

Chi tiết ở `docs/deployment.md`.

---

## 6. Ảnh nền màn đăng nhập

Đổi gradient phẳng thành ảnh thư viện có lớp phủ tối để chữ trắng đọc được.

Bắt được 1 lỗi trước khi deploy: ảnh để `url('/login-hero.jpg')` — chạy đúng ở
local nhưng **404 trên production**, vì Next chỉ tự thêm `basePath` cho asset của
nó, không đụng vào path hardcode trong CSS. Đã đổi thành
`${NEXT_PUBLIC_BASE_PATH}/login-hero.jpg`.

---

## 7. Menu người dùng

Avatar ở thanh trên, mở menu gồm thông tin cá nhân và đăng xuất. Đăng xuất đi qua
`ConfirmDialog` dùng chung thay vì thoát ngay khi lỡ bấm.

`AppTopBar` nhận `actions` qua props thay vì tự import menu — thanh này nằm trong
`shared/` nên phải độc lập với feature; layout `(app)` (nơi đã có session) truyền
vào.

---

## 8. Map API thật (auth · project · member)

Sau khi có `tai-lieu-api-docs-hub.md`. Phần khó nhất nằm ở tầng transport.

### Cạm bẫy chính

Tài liệu ghi rõ: **lỗi nghiệp vụ trả HTTP 200 kèm `success:false`** (sai tên xác
nhận, email trùng, đã là thành viên…). Axios thấy 2xx là resolve → xoá dự án thất
bại sẽ **trông y hệt xoá thành công**.

Giải pháp: `unwrap()` trong `core/api` là điểm nghẽn duy nhất, kiểm tra `success`
trước rồi mới parse payload. Mọi module `api/` đều đi qua đây. Có self-check 10
assertion, khoá chặt đúng case 200-kèm-`success:false`.

`AppError` bổ sung `isBusiness`, `retryable`, `fieldError()` (đọc `details` của
lỗi 400 — backend trả tên field dạng PascalCase) và toàn bộ danh mục mã lỗi.

### Đã map

| Nhóm | Ghi chú |
|---|---|
| Đăng nhập | `username`, token đơn, parse `roles` từ chuỗi JSON thô |
| Dự án | list (phân trang), tạo, sửa, xoá |
| Thành viên | list, mời, đổi vai trò, gỡ |
| Ảnh dự án | 3 bước: presigned URL → PUT thẳng MinIO → complete |

Có tầng **DTO + mapper** riêng: `snake_case` chỉ nằm trong `api/`, component
không biết wire format. Backend đổi tên field thì sửa 1 file.

### Hai thay đổi hành vi

- **Xoá dự án phải gõ lại tên** — backend bắt buộc `confirm_name`, sai thì trả
  `CONFIRM_NAME_MISMATCH`. `ConfirmDialog` thêm prop `confirmPhrase`.
- **Bỏ refresh token** — API chỉ trả 1 token, hết hạn là đăng nhập lại.

### Field thiếu: hiện "—" thay vì bịa số

Backend chưa trả `document_count`, `member_count`, `chunk_count`, tên chủ dự án,
tên thành viên. Các field này để **nullable** và hiển thị `—`. Nếu default về 0
thì người dùng tưởng dự án rỗng thật; `—` mới đúng nghĩa "chưa biết".

Ba toggle bảo mật ở tab Cấu hình hiện "Chưa hỗ trợ" thay vì switch bấm được mà
không làm gì.

---

## 9. Rà soát tài liệu API

Đối chiếu tài liệu với 7 màn đã dựng, liệt kê thành `docs/api-gaps.md` để gửi
thẳng cho team BE. Tóm tắt:

- **P0 (chặn hẳn):** module `document` và `chat` chưa có API nào → 3 màn không chạy
- **P1:** thiếu `GET /projects/{id}`, thiếu counter, member list không có tên user,
  thiếu 5 field settings
- **P2:** refresh token, chốt giá trị `status`, `my_role` cho RBAC, đổi chủ dự án

Ba câu hỏi cần BE trả lời sớm vì ảnh hưởng cách viết code: upload tài liệu qua
backend hay presigned URL; FE biết index xong bằng cách nào (poll/SSE/WebSocket);
chat có stream không.

---

## Kiểm thử

`npm run typecheck` ✅ `npm run lint` ✅ `npm run build` ✅

Ba self-check dạng assert (repo chưa có test runner, Module 8 mới làm):

```bash
npx tsx src/core/api/unwrap.test.ts                          # envelope, 10 assertion
npx tsx src/features/chat/services/citation.service.test.ts  # parse trích dẫn
npx tsx src/features/documents/services/upload-queue.service.test.ts
```

Ngoài ra đã click thật qua browser trên production: đăng nhập, tạo dự án, upload
file (`.txt` nhận / `.png` báo lỗi định dạng), hỏi–đáp có trích dẫn, đổi VI↔EN,
dark↔light, xoá dự án có xác nhận tên.

---

## Còn lại

| Việc | Ghi chú |
|---|---|
| **Chưa test với backend thật** | Không tìm thấy `docs-hub-api` chạy ở đâu — cả `localhost:8080` lẫn VPS đều không có. Code map theo tài liệu và **giả định tài liệu đúng** |
| Màn tài liệu + chat vẫn dùng mock | Chờ backend làm 2 module |
| Dữ liệu mock reset khi restart | In-memory, đúng bản chất demo |
| PR #1 chưa merge | Chờ review |
| **Đổi mật khẩu root VPS** | Mật khẩu đã đi qua chat, nên đổi |
