---
description: Kiểm tra sức khoẻ toàn bộ stack (Docker, Directus, dữ liệu, IP LAN)
allowed-tools: Bash, PowerShell, Read
---

Kiểm tra và báo cáo gọn trạng thái môi trường phát triển:

1. **Docker**: `docker compose ps` — container nào đang chạy, healthy không.
2. **Directus**: `curl -s http://localhost:8055/server/ping` và `/server/info`
   — xác nhận đúng phiên bản **11.17.4** (nếu ra v12 là có người đổi image, cảnh báo ngay).
3. **Dữ liệu**: đăng nhập admin, đếm số bản ghi trong `stores`, `templates`,
   `template_items`, `audits`.
4. **IP LAN**: lấy IPv4 của adapter Wi-Fi, so với `EXPO_PUBLIC_DIRECTUS_URL`
   trong `mobile/.env`. Lệch nhau thì báo và đề nghị sửa — đây là nguyên nhân
   phổ biến nhất khiến app trên điện thoại không kết nối được.

Trình bày dạng bảng ngắn. Có vấn đề thì nói rõ cách sửa.
