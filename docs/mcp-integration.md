# MCP integration — trạng thái và việc cần làm

Tài liệu cho người tiếp nhận. Cập nhật 02/09/2026.

## Phân chia trách nhiệm

MCP server là **một web server bình thường**, giống `api.docshub.io.vn`. Khác biệt duy
nhất là nó nói giao thức MCP: nhận POST JSON-RPC với các method chuẩn (`initialize`,
`tools/list`, `tools/call`) và trả về đúng khuôn Claude hiểu được.

Khi chạy `claude mcp add --transport http <tên> <url> --header "..."`, Claude Code chỉ
ghi vào config trên máy người dùng rằng có server ở địa chỉ đó. Mỗi lần chat, nó tự gọi
HTTP tới đấy.

| Phần | Ai làm | Trạng thái |
|---|---|---|
| MCP server (code, chạy service) | **Backend** | Đang làm |
| Subdomain + nginx | FE (quản domain) | ✅ `deployments/ec2/nginx/mcp.docshub.io.vn.conf` |
| Trang test tích hợp | FE | ✅ `/mcp` |

FE **không** viết MCP server: nó phải truy cập database, giữ credential và chạy 24/7.

## Trang `/mcp`

Đăng nhập rồi vào `https://docshub.io.vn/mcp`. Hai việc:

1. **Kết nối thử** — nhập URL + token, bấm Connect. Trang chạy đúng luồng bắt tay
   (`initialize` → `notifications/initialized` → `tools/list`), hiện từng bước kèm HTTP
   status và thời gian, rồi liệt kê tool server khai báo. Bấm vào một tool để gọi thử
   với tham số JSON tự nhập.
2. **Lệnh cài đặt** — khối `claude mcp add ...` và `claude mcp remove ...` tự dựng theo
   URL/token đang nhập, có nút copy.

Không cần cài Claude Code hay mở terminal để biết server sống hay chết.

### Vì sao phải đi qua `/api/mcp-probe`

CSP của app ghim `connect-src 'self'`, nên trình duyệt không gọi thẳng sang host khác
được. Route `/api/mcp-probe` làm chặng cross-host phía server — cùng mô hình với
`/api/storage-put` cho upload avatar. Không nới CSP vì một trang test.

Route này là **probe**, không phải MCP client: chuyển tiếp đúng một request rồi trả
nguyên kết quả, kể cả lỗi. Không retry, không follow redirect, không diễn giải — công
cụ tự sửa lỗi giúp thì không thể dùng để phát hiện lỗi.

Token do người test nhập, gửi kèm từng request, **không lưu ở server**. Phía trình
duyệt cũng chỉ lưu URL và tên kết nối vào `localStorage`; token thì không, vì bearer
token nằm trong web storage sẽ sống lâu hơn tab và mọi script trên origin đều đọc được.

## Cần hỏi đội backend khi bàn giao

1. **Service bind cổng nào trên host?** → sửa `proxy_pass` trong file nginx (đang để
   8080 làm mặc định).
2. **Endpoint là `/mcp` hay đường dẫn khác?**
3. **Xác thực kiểu gì?** Ví dụ `spf-memory-palace` dùng bearer token dài hạn. Lưu ý
   JWT của docs-hub-api chỉ sống **15 phút** (đo ngày 02/09/2026), nên không dán cứng
   vào `--header` được — sẽ hết hạn giữa chừng. Cần API key dài hạn, hoặc server tự
   login bằng service account và tự refresh.
4. **Có yêu cầu `Mcp-Session-Id` không?** Trang test tự truyền lại nếu server cấp.

## Sau khi có URL thật

Sửa `DEFAULT_URL` trong `src/features/mcp/components/mcp-tester-screen.tsx` nếu khác
`https://mcp.docshub.io.vn/mcp`. Người dùng vẫn sửa được trực tiếp trên trang.

## Kiểm chứng đã làm

Chưa có server thật để test, nên tôi dựng một MCP server mẫu tối giản (mock) và chạy
đối chứng. Kết quả:

- Token sai → dừng ở `initialize`, hiện `Unauthorized`, HTTP 401
- Token đúng → cả 3 bước xanh, lấy được session id, liệt kê đúng 2 tool
- Gọi tool trả **SSE** → parse đúng, hiện nội dung tài liệu
- Host không tồn tại → `MCP_UNREACHABLE`
- URL sai định dạng / scheme `ftp://` → chặn ở route, không gửi đi

Server mẫu nằm ngoài repo (scratchpad), không phải hàng cần bảo trì.
