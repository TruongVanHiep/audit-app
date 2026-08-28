---
description: Dựng lại toàn bộ backend Directus từ script (schema + dữ liệu mẫu + phân quyền)
allowed-tools: Bash, Read
---

Dựng lại backend từ đầu bằng script, theo đúng thứ tự:

```bash
node directus/schema/setup-schema.mjs && node directus/schema/seed-data.mjs && node directus/schema/setup-roles.mjs && node directus/schema/verify.mjs
```

Trước khi chạy, xác nhận Directus đang lên: `docker compose ps` phải thấy
`database` ở trạng thái `healthy` và `directus` đang `Up`. Chưa lên thì
`docker compose up -d` rồi đợi `/server/ping` trả `pong`.

Cả ba script đều idempotent nên chạy trên database đang có dữ liệu cũng an toàn —
**không** cần và **không được** xoá database để chạy lệnh này.

$ARGUMENTS
