---
paths:
  - "directus/**/*.mjs"
  - "docker-compose.yml"
---

# Quy tắc cho backend Directus

## Phiên bản — KHÔNG được nâng

`docker-compose.yml` ghim `directus/directus:11.17.4`. Tuyệt đối không đổi sang
`:latest` hay v12.

Lý do: từ Directus 12, custom permission rules (lọc theo dòng, preset, giới hạn
field) cần license trả phí — API trả `403 custom_permission_rules_enabled is a
restricted resource`. App audit bắt buộc phải có row-level security nên không
dùng v12 miễn phí được.

Directus **không hạ phiên bản được** (migration chỉ chạy tiến). Nâng nhầm là
phải xoá database tạo lại.

## Script schema

- Mọi script phải **idempotent**: chạy lại lần 2, 3, n lần đều không lỗi,
  cái gì đã có thì bỏ qua hoặc cập nhật.
- `setup-roles.mjs` dùng **upsert** (PATCH nếu đã tồn tại), để code luôn là
  nguồn sự thật kể cả khi ai đó lỡ sửa quyền trong UI.
- Sửa schema thì phải sửa cả `mobile/src/lib/types.ts` cho khớp.

## Phân quyền — preset KHÔNG phải rào chắn

`presets` chỉ là giá trị mặc định khi client không gửi field đó lên. Client gửi
giá trị khác thì giá trị của client thắng.

Muốn thực sự chặn phải dùng `validation`. Luôn dùng **cả hai**:
preset để tiện, validation để an toàn.

Giới hạn đã kiểm chứng: `validation` chỉ soi được field trực tiếp của bản ghi.
Luật xuyên quan hệ như `{ audit: { auditor: {...} } }` bị Directus hiểu sai và
chặn luôn cả request hợp lệ. Muốn kiểm tra quyền sở hữu xuyên quan hệ phải dùng
Directus Flow (trigger filter `items.create`).

## Bắt buộc sau mỗi lần đổi quyền

Chạy `node directus/schema/verify.mjs`. Script này đăng nhập bằng tài khoản
auditor thật rồi tự tấn công hệ thống. Phải pass toàn bộ mới coi là xong.
