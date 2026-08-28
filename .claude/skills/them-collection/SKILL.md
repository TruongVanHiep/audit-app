---
name: them-collection
description: Thêm một collection mới vào schema Directus của app audit, đầy đủ từ script schema, kiểu TypeScript, phân quyền, tới test. Dùng khi cần thêm bảng dữ liệu mới (ví dụ lịch phân công, danh mục SKU, phản hồi cửa hàng).
---

# Thêm collection mới vào schema Directus

Quy trình đầy đủ để thêm một bảng dữ liệu mà không bỏ sót bước nào. Bỏ sót một
bước ở đây thường không lộ ra ngay — nó lộ ra khi auditor đang đứng giữa cửa
hàng và app trả lỗi 403.

## Thứ tự bắt buộc

### 1. Khai báo schema

Sửa `directus/schema/setup-schema.mjs`. Dùng các helper có sẵn trong `lib.mjs`:
`createCollection`, `createField`, `createM2O`, `createFilesM2M`, và các
shorthand `dropdown` / `text1` / `textMulti` / `num` / `toggle` / `timestamp`.

Giữ đúng khuôn mẫu đang có:
- Khoá chính **uuid** (helper `createCollection` đã lo), để app tạo được bản ghi
  khi offline rồi mới đồng bộ sau.
- Lấy `const f = await listFields('<collection>')` một lần rồi truyền vào mọi
  lời gọi `createField` — đó là thứ giữ tính idempotent.
- Mỗi field có `note` giải thích bằng tiếng Việt.

Chạy `node directus/schema/setup-schema.mjs` **hai lần**. Lần hai phải toàn
"đã có, bỏ qua" và exit 0. Không idempotent thì chưa xong.

### 2. Cập nhật kiểu TypeScript

Sửa `mobile/src/lib/types.ts`:
- Thêm `interface` cho collection mới, khớp từng field.
- Thêm nó vào `interface Schema`, nếu không SDK sẽ không nhận ra tên collection.
- Kiểu literal cho dropdown phải khớp đúng chuỗi `value` khai trong schema.

### 3. Phân quyền

Sửa mảng `PERMISSIONS` trong `directus/schema/setup-roles.mjs`. Với mỗi action
cần hỏi:

- **read**: auditor được thấy dòng nào? Dữ liệu của người dùng thì phải có
  filter `$CURRENT_USER`, trực tiếp hoặc xuyên quan hệ.
- **create**: có field nào cần ép giá trị không? Nếu có thì đặt **cả**
  `presets` **và** `validation`. Chỉ preset là chặn được mạo danh.
- **update / delete**: có được sửa sau khi đã nộp không?

Có field ảnh M2M thì nhớ cấp quyền cho **bảng trung gian** `<collection>_photos`
— quên bước này là app upload ảnh xong nhưng không gắn được vào bản ghi.

Chạy `node directus/schema/setup-roles.mjs`. Script dùng upsert nên chạy lại
sẽ kéo quyền về đúng như khai báo trong code.

### 4. Viết test tấn công

Thêm nhóm test vào `directus/schema/verify.mjs`. Tối thiểu:
- auditor A **không** đọc/sửa/xoá được bản ghi của auditor B
- auditor **không** mạo danh được người khác khi tạo (dùng `mustBeRejected`)
- auditor **không** ghi được vào dữ liệu gốc chỉ-đọc

Chạy `node directus/schema/verify.mjs`, phải pass toàn bộ.

### 5. Tầng gọi API

Thêm hàm vào `mobile/src/lib/api.ts`. Quy tắc: liệt kê `fields` cụ thể, không
dùng `'*'` — mỗi field thừa là thêm byte trên mạng 4G của người đi hiện trường.

## Cạm bẫy hay gặp

- **Quên bảng trung gian M2M** trong danh sách quyền → upload ảnh thành công
  nhưng không gắn được vào bản ghi.
- **Chỉ đặt preset, quên validation** → client gửi giá trị khác là ghi đè được.
- **Sửa quyền trong UI Directus thay vì trong script** → lần chạy
  `setup-roles.mjs` tiếp theo ghi đè mất, hoặc tệ hơn là môi trường của bạn
  khác môi trường của đồng đội mà không ai biết.
- **Quên thêm vào `interface Schema`** → TypeScript không báo lỗi rõ ràng,
  chỉ suy ra kiểu `never` ở chỗ gọi.
