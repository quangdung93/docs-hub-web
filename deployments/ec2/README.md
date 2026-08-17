# Chạy docs-hub-web trên EC2

Next.js chạy ở chế độ `standalone` trong container, nghe `127.0.0.1:3000`;
nginx trên host nhận HTTPS ở `docshub.io.vn` rồi proxy vào.

Máy này chạy chung với `docs-hub-api` (xem `deployments/ec2/README.md` bên repo
đó). Web join network của stack API để gọi thẳng `http://api:8080`, không vòng
qua internet.

## Thứ tự triển khai

1. **Stack API phải chạy trước** — web dùng network `document-hub-ec2_default`
   do nó tạo ra. Kiểm tra: `docker network ls | grep document-hub-ec2`.

2. **Cấu hình env**

   ```bash
   cp .env.ec2.example .env.ec2
   vi .env.ec2      # điền AUTH_SECRET: openssl rand -base64 32
   ```

3. **Chạy**

   ```bash
   make ec2-up      # build (~3-5 phút lần đầu) + khởi động
   make ec2-logs
   curl -s -o /dev/null -w '%{http_code}\n' localhost:3000   # 200
   ```

4. **nginx + TLS** (một lần)

   ```bash
   sudo cp deployments/ec2/nginx/docshub.io.vn.conf /etc/nginx/sites-available/docshub.io.vn
   sudo ln -sf /etc/nginx/sites-available/docshub.io.vn /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d docshub.io.vn --redirect
   ```

## Cập nhật code

```bash
git pull
make ec2-restart
```

## Khi EC2 quá yếu để build

`next build` ngốn RAM hơn mức một instance 2 vCPU / 4GB chịu được — build tại chỗ
có thể làm nghẽn cả máy (kể cả sshd). Khi đó build ở máy dev rồi nạp image sang,
không cần registry:

```bash
# tại máy dev
make ec2-image-push EC2_HOST=ubuntu@<ip> SSH_KEY=~/duong/dan/key.pem

# trên EC2
cd /home/web/docs-hub-web && sudo make ec2-start   # chạy image vừa nạp, không build
```

Máy dev Apple Silicon build `--platform linux/amd64` (mặc định của `PLATFORM`)
nên chạy qua emulation và chậm hơn hẳn build native.

## Lưu ý

- **`NEXT_PUBLIC_*` được inline lúc build**, không phải lúc chạy. Đổi chúng thì
  phải `make ec2-restart` (có `--build`), sửa mỗi biến môi trường là không đủ.
- **`ENABLE_MOCKS` phải là `false`** ngoài local, nếu không web sẽ trả dữ liệu
  giả của MSW.
- **`API_URL` trỏ vào docker network** (`http://api:8080/public/api/v1`). API
  không mở cổng ra internet nên đừng đổi sang `http://<ip>:8080`.
- Cổng 3000 chỉ bind loopback. Kiểm tra trực tiếp thì SSH tunnel:
  `ssh -i key.pem -L 3000:127.0.0.1:3000 ubuntu@<ip>`.
