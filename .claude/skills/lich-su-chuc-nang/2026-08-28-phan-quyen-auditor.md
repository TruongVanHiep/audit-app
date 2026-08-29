# Phân quyền Auditor + test tự tấn công

**Ngày:** 2026-08-28 · **Trạng thái:** ✅ Xong, 17/17 test pass

## Làm được gì

- Access Policy + Role `Auditor` + 26 permission, dựng bằng script.
- 2 tài khoản mẫu: `auditor@example.com` và `auditor2@example.com`
  (mật khẩu `Auditor123!`).
- Bộ test `verify.mjs` đăng nhập bằng tài khoản auditor thật rồi tự tấn công
  hệ thống — 17 test, pass toàn bộ.

## Quyết định kỹ thuật

**Lọc dữ liệu ở tầng quyền Directus, không lọc ở app.** App không gửi bộ lọc
"auditor = tôi" lên server; quyền đã lo việc đó. Quên lọc ở app cũng không rò
rỉ dữ liệu người khác. Nếu làm ngược lại, chỉ cần một màn hình quên `filter` là
lộ toàn bộ dữ liệu.

**Script dùng upsert thay vì chỉ tạo mới.** Ai đó lỡ sửa quyền trong UI thì
chạy lại `setup-roles.mjs` sẽ kéo về đúng như khai báo trong code.

## Cạm bẫy đã gặp

### 1. Preset KHÔNG chặn được mạo danh — lỗ hổng thật đã tìm ra

`presets` chỉ là **giá trị mặc định** khi client không gửi field đó lên. Client
gửi giá trị khác thì giá trị của client thắng.

Với preset `auditor: $CURRENT_USER`, auditor A vẫn tạo được phiếu gán cho
auditor B bằng cách gửi thẳng `auditor: <id của B>`. Đã chứng minh bằng cách
kiểm tra dữ liệu thực trong DB bằng quyền admin:

```
684efb14  auditor = auditor2@example.com
9327bec5  auditor = auditor2@example.com
```

Cả hai phiếu đều do auditor A tạo.

**Vá bằng `validation`:**

```js
validation: { _and: [
  { auditor: { _eq: '$CURRENT_USER' } },
  { status:  { _eq: 'draft' } },
]}
```

Quy tắc rút ra: **preset để tiện, validation để an toàn — luôn dùng cả hai.**

### 2. Dấu hiệu nhận biết: HTTP 204 thay vì bản ghi

`POST /items/audits` trả `204 No Content` với `data: null` nghĩa là bản ghi đã
được tạo nhưng người tạo **không đọc lại được** — tức là nó đã bị gán cho người
khác. Ban đầu tưởng là lỗi test, hoá ra là dấu vết của lỗ hổng.

### 3. `validation` không đi xuyên quan hệ được

Thử `{ audit: { auditor: { _eq: '$CURRENT_USER' } } }` trên `audit_answers:create`
→ Directus hiểu sai và chặn luôn cả request hợp lệ:
`Validation failed for field "audit". Value is required.`

`validation` chỉ soi được field trực tiếp của bản ghi đang tạo.

### 4. Bảng trung gian M2M cần quyền riêng

`audit_answers_photos` và `findings_photos` phải được cấp quyền riêng. Quên là
app upload ảnh thành công nhưng không gắn được vào câu trả lời.

## Còn hở (đã biết, chưa vá)

Auditor cố ý vẫn có thể **chèn câu trả lời rác vào phiếu audit của người khác**
— vì `create` không có filter theo dòng (Directus bỏ qua `permissions` filter
khi tạo mới) và `validation` không xuyên quan hệ được.

Đọc/sửa/xoá đã chặn được, chỉ riêng tạo mới là hở. Cách vá đúng: dùng Directus
Flow (trigger filter `items.create`) kiểm tra quyền sở hữu ở phía server.

## File liên quan

- [directus/schema/setup-roles.mjs](../../../directus/schema/setup-roles.mjs)
- [directus/schema/verify.mjs](../../../directus/schema/verify.mjs)

## Cách kiểm chứng lại

```bash
node directus/schema/verify.mjs
```

Phải ra `17 pass, 0 fail`. Có test fail thì **đừng vội sửa test** — xác định
xem đó là lỗi test hay lỗ hổng thật, bằng cách gọi API trực tiếp và kiểm tra
dữ liệu thực trong DB bằng quyền admin.
