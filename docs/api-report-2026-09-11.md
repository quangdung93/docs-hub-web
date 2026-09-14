# Báo lỗi API — docs-hub-api (11/09/2026)

Kết quả rà soát lại toàn bộ Swagger tại `https://api.docshub.io.vn/swagger/index.html`,
đối chiếu với những endpoint frontend đang gọi thật.

**Cách kiểm chứng:** mọi mục dưới đây đều được gọi thật bằng `curl` trên
production với tài khoản `admin@docshub.io.vn`, không chỉ đọc spec — vì Swagger
hiện có ít nhất một chỗ ghi sai đường dẫn (mục 1). Dữ liệu test lấy từ project
`Mobix` (6 tài liệu) và project `Test`.

**Quan hệ với `docs/api-gaps.md`:** ba mục 2, 3 và 6 dưới đây đã được báo trong
file đó (lần lượt là mục 2, 7 và 8) và đến nay vẫn chưa sửa. Các mục còn lại là
phát hiện mới.

**Cập nhật 14/09/2026 — mục 4.** Team BE đã bổ sung `?include_deleted=true` cho
`GET /documents`, đúng hướng 1 mà mục đó đề xuất. Mục 4 đã viết lại theo hiện
trạng: phần đã làm, và hai phần còn thiếu. Các mục khác chưa đo lại, số liệu vẫn
là của ngày 11/09.

---

## Tổng hợp

| #   | Endpoint / vấn đề                                                     | Mức độ           | Trạng thái        |
| --- | --------------------------------------------------------------------- | ---------------- | ----------------- |
| 1   | Swagger ghi sai prefix đường dẫn nhóm `reports`                       | **Nghiêm trọng** | Mới               |
| 2   | `GET /documents` — filter `status` / `type` / `version_id` trả 500     | Cao              | Báo lại lần 2     |
| 3   | `GET /documents` — thiếu revision, buộc client gọi N+1                | Cao              | Báo lại lần 2     |
| 4   | Audit log — `include_deleted` đã có, detail vẫn 404, chưa có activity log | Trung bình   | ✅ một phần        |
| 5   | `POST /versions` — nuốt field `note` không báo lỗi                    | Trung bình       | Mới               |
| 6   | Thiếu `DELETE /versions/{versionId}`                                  | Trung bình       | Báo lại lần 2     |
| 7   | Thiếu `DELETE /conversations/{conversationId}`                        | Trung bình       | Mới               |
| 8   | `size_bytes` — mô tả chưa nói rõ phải khớp tuyệt đối                  | Thấp             | Mới               |
| 9   | Đặt tên path param chưa nhất quán giữa các nhóm                       | Thấp             | Mới               |

---

## 1. Swagger ghi sai prefix đường dẫn nhóm `reports`

**Mức độ: nghiêm trọng.** Người đọc spec sẽ gọi đúng theo tài liệu và nhận 404.

Trong tổng số 34 path, 32 path khai đầy đủ prefix `/internal/api/v1`; riêng
hai path của nhóm `reports` thì không.

| Swagger ghi                            | Đường dẫn thật                                            |
| -------------------------------------- | --------------------------------------------------------- |
| `POST /projects/{id}/reports`          | `POST /internal/api/v1/projects/{id}/reports`              |
| `GET /projects/{id}/reports/history`   | `GET /internal/api/v1/projects/{id}/reports/history`       |

### Cách tái hiện

```bash
# Đúng như Swagger ghi → 404
curl -i -H "Authorization: Bearer $TOKEN" \
  "https://api.docshub.io.vn/projects/$PID/reports/history"

# Thêm prefix → 200
curl -i -H "Authorization: Bearer $TOKEN" \
  "https://api.docshub.io.vn/internal/api/v1/projects/$PID/reports/history"
```

Nguyên nhân nhiều khả năng nằm ở annotation `@Router` của handler nhóm reports
thiếu phần base path, trong khi 32 path còn lại đều khai đầy đủ.

---

## 2. `GET /internal/api/v1/projects/{id}/documents` — ba filter trả 500

Đã báo trong `api-gaps.md` mục 2 (phát hiện 21/08), kiểm chứng lại hôm nay vẫn
nguyên. Swagger khai báo 5 tham số lọc, chỉ 2 tham số hoạt động.

| Tham số        | Kết quả                                            |
| -------------- | -------------------------------------------------- |
| `q`            | 200, lọc đúng                                      |
| `page`, `limit`| 200                                                |
| `status`       | **500 `SYS_500`**                                  |
| `type`         | **500 `SYS_500`**                                  |
| `version_id`   | **500 `SYS_500`**                                  |

Thông báo trả về là `"Đã có lỗi hệ thống. Vui lòng thử lại sau."` — tức lỗi phía
server, không phải 400 báo tham số sai. Đã thử `version_id` vừa với UUID hợp lệ
vừa với UUID không tồn tại, kết quả 500 như nhau, nên không phải do dữ liệu.

### Cách tái hiện

```bash
curl -i -H "Authorization: Bearer $TOKEN" \
  "https://api.docshub.io.vn/internal/api/v1/projects/$PID/documents?status=indexed"
```

### Ảnh hưởng

Frontend hiện phải tải toàn bộ danh sách rồi lọc phía client. Phân trang
server-side vì thế không dùng được, và thời gian tải sẽ tăng tuyến tính theo số
tài liệu của project.

---

## 3. `GET /documents` thiếu thông tin revision, buộc client gọi N+1

Đã báo trong `api-gaps.md` mục 7, vẫn chưa có.

Response của endpoint list chỉ gồm:

```
id, project_id, title, description, document_key, version,
created_at, updated_at, created_by
```

Không có mảng `revisions`, do đó thiếu toàn bộ: `size_bytes`, `file_name`,
`status` (trạng thái ingest), `revision_no`.

Bảng tài liệu trên giao diện cần đúng những cột đó, nên frontend buộc phải gọi
thêm `GET /documents/{document_id}` cho **từng dòng**. Một project 20 tài liệu
tốn 21 request cho một lần mở trang.

### Đề xuất

Cho endpoint list trả kèm revision mới nhất của mỗi document, hoặc bổ sung tham
số dạng `?include=latest_revision`. Đây là thay đổi gỡ được nút thắt hiệu năng
lớn nhất hiện tại.

---

## 4. Audit log — đã làm một nửa, còn thiếu hai phần

> **Cập nhật 14/09/2026.** Mục này ban đầu ghi "không có endpoint nào cho lịch sử
> thay đổi". Sau đó team BE đã bổ sung `?include_deleted=true`, giải quyết đúng
> hướng 1 đề xuất bên dưới. Phần còn lại vẫn nguyên. Nội dung mục đã viết lại
> theo hiện trạng.

### Đã có: `?include_deleted=true` cho `GET /documents` ✅

Thêm tham số này thì response trả cả tài liệu đã xóa mềm, kèm hai trường mới
`is_deleted` và `deleted_at` trong `domain.Document`.

Kiểm chứng lại ngày 14/09/2026 trên project `Test`:

| Request                                    | Kết quả                        |
| ------------------------------------------ | ------------------------------ |
| `GET /documents`                           | 200 — 1 bản ghi, 0 đã xóa      |
| `GET /documents?include_deleted=true`      | 200 — 7 bản ghi, 6 đã xóa      |

Frontend đã dùng cái này: tab "Lịch sử thay đổi" giờ hiển thị được mục "Đã xóa"
kèm mốc thời gian.

### Còn thiếu 1: `GET /documents/{document_id}` vẫn 404 với bản ghi đã xóa

Đây là phần làm chưa trọn. Endpoint list đã trả tài liệu đã xóa, nhưng endpoint
detail thì chưa — kể cả khi truyền thêm `include_deleted=true`:

```bash
curl -i -H "Authorization: Bearer $TOKEN" \
  ".../projects/$PID/documents/$DELETED_ID"                      # 404
curl -i -H "Authorization: Bearer $TOKEN" \
  ".../projects/$PID/documents/$DELETED_ID?include_deleted=true" # 404
curl -i -H "Authorization: Bearer $TOKEN" \
  ".../projects/$PID/documents/$DELETED_ID/revisions"            # 404
```

Ảnh hưởng cụ thể: `GET /documents` không trả kèm revision (mục 3), nên frontend
phải gọi detail cho **từng dòng** để lấy size, định dạng và trạng thái. Với dòng
đã xóa thì lời gọi đó chắc chắn hỏng, nên client phải tự nhận biết và bỏ qua —
đổi lại, tài liệu đã xóa hiện không có kích thước lẫn số revision để hiển thị.

Đề nghị cho detail và revisions nhận cùng tham số `include_deleted` như list.

### Còn thiếu 2: chưa có audit log cho các thao tác khác

Đã thử lại 7 đường dẫn ứng viên, **tất cả vẫn 404**:

```
/internal/api/v1/projects/{id}/activities
/internal/api/v1/projects/{id}/history
/internal/api/v1/projects/{id}/audit-logs
/internal/api/v1/projects/{id}/events
/internal/api/v1/projects/{id}/changes
/internal/api/v1/audit-logs
/internal/api/v1/activities
```

Trong Swagger chỉ có một path chứa chữ `history` là `/reports/history` — đó là
lịch sử xuất báo cáo, không liên quan.

Nên tab "Lịch sử thay đổi" vẫn phải dựng từ mảng `revisions`, và vẫn không thấy
được các thao tác **không tạo revision**: đổi tên tài liệu, sửa mô tả, tạo
project version, mời hoặc gỡ thành viên.

Để phủ hết các thao tác này, cần một endpoint activity log ghi nhận mọi thao tác
trên project — `include_deleted` chỉ xử lý được trường hợp xóa tài liệu.

---

## 5. `POST /internal/api/v1/projects/{id}/versions` — nuốt field `note`

Swagger khai body chỉ có `label` (required). Gửi kèm `note` thì API trả 201 bình
thường nhưng field đó biến mất, không có cảnh báo nào.

### Cách tái hiện

```bash
curl -i -X POST -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"label":"probe-note-check","note":"GHI CHU KIEM CHUNG"}' \
  "https://api.docshub.io.vn/internal/api/v1/projects/$PID/versions"
```

Response 201, các field trả về:

```
id, project_id, label, sequence_no, status, created_by, created_at, updated_at
```

Không có `note`.

### Ảnh hưởng

Màn hình tạo version trên giao diện hiện có ô nhập ghi chú. Người dùng điền xong
và tưởng đã lưu, nhưng dữ liệu bị bỏ đi âm thầm.

### Đề xuất

Chọn một trong hai: lưu `note` thật và trả về trong response, hoặc từ chối field
lạ bằng 400 để client biết đường xử lý.

---

## 6. Thiếu `DELETE /internal/api/v1/projects/{id}/versions/{versionId}`

Đã báo trong `api-gaps.md` mục 8, vẫn chưa có. Cả hai dạng đều trả 404:

```bash
curl -i -X DELETE -H "Authorization: Bearer $TOKEN" \
  "https://api.docshub.io.vn/internal/api/v1/projects/$PID/versions/$VERSION_ID"   # 404

curl -i -X DELETE -H "Authorization: Bearer $TOKEN" \
  "https://api.docshub.io.vn/internal/api/v1/projects/$PID/versions"               # 404
```

### Hệ quả thực tế

Tạo nhầm một version là không gỡ được. Ngay trong lần kiểm chứng mục 5, một
version tên `probe-note-check` đã được tạo trên project `Test` và hiện không xóa
được:

```
project_id: b371a8b8-78a3-43da-8214-3c8e46f6bd1b   (Test)
version_id: 3dc19952-3270-4cda-ac18-ee30ec3fc718
label     : probe-note-check
```

Nhờ team BE xóa tay giúp bản ghi này.

---

## 7. Thiếu `DELETE` cho conversation

```bash
curl -i -X DELETE -H "Authorization: Bearer $TOKEN" \
  "https://api.docshub.io.vn/internal/api/v1/projects/$PID/conversations/$CONV_ID"
# → 404
```

Màn hình chat đã có sẵn nút xóa hội thoại nhưng hiện chỉ hiển thị thông báo
"tính năng đang phát triển", vì chưa có endpoint để gọi.

---

## 8. `size_bytes` — mô tả chưa nói rõ ràng buộc

Swagger mô tả `size_bytes` là optional, dùng "để đối chiếu". Hành vi thật:

| Cách gửi                   | Kết quả                                            |
| -------------------------- | -------------------------------------------------- |
| Bỏ hẳn `size_bytes`        | **202**, upload thành công                         |
| Gửi lệch đúng 1 byte       | **400** `"Kích thước khai báo không khớp"`          |

Đúng là optional, nhưng khi đã gửi thì phải khớp **chính xác từng byte**. Mô tả
hiện tại chưa thể hiện điều đó, nên người tích hợp rất dễ tính nhầm (ví dụ lấy
độ dài chuỗi thay vì số byte thật) rồi nhận 400 khó truy nguyên.

### Đề xuất

Ghi rõ trong mô tả field: "nếu gửi thì phải bằng đúng số byte của file, lệch sẽ
trả 400".

---

## 9. Đặt tên path param chưa nhất quán

Nhóm users dùng `{id}`:

```
/internal/api/v1/users/{id}
/internal/api/v1/users/{id}/status
```

Nhóm members lại dùng `{userId}` cho cùng khái niệm:

```
/internal/api/v1/projects/{id}/members/{userId}
```

Không gây lỗi, chỉ là điểm cần cân nhắc khi chuẩn hóa tài liệu.

---

## Ghi chú về phạm vi kiểm chứng

Toàn bộ số liệu lấy từ môi trường **production** (`api.docshub.io.vn`) trong
ngày 11/09/2026, bằng tài khoản admin. Các lỗi dạng `SYS_500` có thể phụ thuộc
dữ liệu của từng project cụ thể — nên test lại trên môi trường của team BE trước
khi kết luận nguyên nhân gốc.

Những endpoint đã kiểm chứng và hoạt động đúng trong đợt này: `auth/login`,
`auth/refresh`, `auth/me`, `projects` (list / detail / create), `versions` (list
/ create), `documents` (list / detail / upload / delete), `documents/uat-report`,
`reports` (generate / history), `conversations` (list / create / messages).
