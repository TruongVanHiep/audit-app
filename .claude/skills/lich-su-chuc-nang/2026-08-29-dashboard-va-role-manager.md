# Dashboard Insights + role Manager

**Ngày:** 2026-08-29 · **Trạng thái:** ✅ Xong — quyền 16/16, dashboard đã sửa
lỗi hiển thị 0 và kiểm chứng lại tên khoá bằng mã nguồn

## Làm được gì

- Role **Manager**: xem mọi phiếu, duyệt phiếu, giao việc khắc phục.
- Hai dashboard Insights dựng bằng script: "Tổng quan Audit" và
  "Nhật ký & Giám sát".
- Cột `region` phi chuẩn hoá từ `stores` xuống `audits`.
- `seed-demo-audits.mjs`: 60 phiếu + 67 finding trong 90 ngày qua.

## Quyết định kỹ thuật

**Không viết dashboard riêng.** Directus Data Studio + Insights đã là dashboard
web hoàn chỉnh và không bị khoá license trên bản 11. Chỉ nên viết dashboard
riêng khi cần giao diện cho người ngoài tổ chức, nhúng vào hệ thống có sẵn,
hoặc loại báo cáo Insights không làm được.

**Manager KHÔNG sửa được `audit_answers`.** Đó là bằng chứng. Hệ thống audit mà
cấp trên sửa được điểm cấp dưới đã chấm thì toàn bộ dữ liệu mất giá trị — không
ai phân biệt được "cửa hàng tốt thật" với "cửa hàng được nâng điểm". Chấm nhầm
thì huỷ phiếu làm lại, không sửa lén.

**Quyền duyệt phiếu bị siết ba lớp:** `fields: ['status']` (không đụng được
cột khác), `filter: status = submitted` (không đụng phiếu đang làm dở),
`validation: status in [reviewed, cancelled]` (không lùi về draft để mở khoá
cho auditor sửa).

**Dữ liệu demo cố ý không đều.** Miền Bắc 88.8% > Trung 77.9% > Nam 56.0%, và
HCM-002 kém hẳn. Dashboard mà không lộ ra được khác biệt đó thì là dashboard
hỏng — đây chính là cách kiểm chứng nó.

## Cạm bẫy đã gặp

### 1. Directus 11 không gộp nhóm xuyên quan hệ

```
/items/audits?aggregate[avg]=score_percent&groupBy=store.region  ->  500
```

Lọc xuyên quan hệ thì **chạy bình thường** (`filter[store][region][_eq]=north`),
chỉ riêng `groupBy` là không. Nên phải phi chuẩn hoá `region` xuống `audits` —
cũng là cách làm chuẩn của bảng dữ liệu báo cáo: bảng sự kiện mang theo chiều
phân tích của nó. App điền giá trị lúc tạo phiếu.

### 2. `metric` dùng `aggregate_function`, không phải `function`

Lần thử đầu mình dùng `function` — API vẫn nhận vì nó chỉ lưu JSON, không kiểm
tra. Panel sẽ hiển thị hỏng mà không báo lỗi ở đâu cả. Tên khoá đúng lấy từ
tài liệu chính thức, không đoán.

### 3. Dấu hiệu idempotent bị dương tính giả

Khi thêm `region` vào `interface Audit`, mình dùng dấu hiệu
`region: Region | null;` để kiểm tra đã thêm chưa — nhưng `interface Store` đã
có sẵn đúng dòng đó, nên script báo "đã có, bỏ qua" trong khi thực tế chưa thêm.
`tsc` không bắt được vì chỗ gửi dữ liệu có ép kiểu `as never`.

Bài học: dấu hiệu kiểm tra phải **duy nhất trong cả file**.

### 4. Tài liệu web sai tên khoá `options` — panel ra 0 mà không báo lỗi

Dashboard dựng xong hiển thị **toàn số 0**. Không có lỗi ở đâu cả: API trả 200,
panel vẫn vẽ ra, chỉ là số liệu rỗng.

Nguyên nhân: Directus **không kiểm tra `options` khi lưu panel** — nó nhận mọi
JSON. Gõ sai tên khoá thì lưu vẫn thành công, và Directus đọc khoá nó cần thấy
`undefined` nên không gộp gì.

Tài liệu trên trang chủ ghi snake_case, nhưng mã nguồn v11.17.4 dùng camelCase:

| Panel | Tài liệu web (sai) | Mã nguồn v11.17.4 (đúng) |
|---|---|---|
| metric | `aggregate_function` | `function` |
| metric | `conditional_styles` | `conditionalFormatting` |
| bar-chart | `x_axis` / `y_axis` | `xAxis` / `yAxis` |
| bar-chart | `value_decimals` | `decimals` |
| list | `sort_field` / `display_template` | `sortField` / `displayTemplate` |

Bài học: với thứ mà API không validate, **tài liệu không đủ tin cậy — phải đọc
mã nguồn đúng tag phiên bản**:

    https://github.com/directus/directus/blob/v11.17.4/app/src/panels/<ten>/index.ts

### 5. Heredoc của Bash nuốt ký tự escape

Viết file `.mjs` bằng `cat <<'EOF'` làm mất backslash trong regex và làm hỏng
chuỗi có dấu nháy. Với file có regex hoặc escape phức tạp thì phải dùng công cụ
ghi file trực tiếp.

## Chưa kiểm chứng

**Giao diện dashboard chưa xem tận mắt.** Không đăng nhập được vào Directus
Data Studio qua công cụ trình duyệt — form Vue không nhận text gõ vào, mạng
không hề có request `POST /auth/login`.

Nghi ngờ đó hoá ra đúng: panel hiển thị toàn 0 vì sai tên khoá (xem cạm bẫy 4).
Đã sửa và kiểm chứng lại tên khoá bằng mã nguồn. Số liệu đúng phải là:
phiếu đã nộp 51 · điểm TB 76.6% · chờ duyệt 16 · lỗi nghiêm trọng 14.

## File liên quan

- [directus/schema/setup-manager.mjs](../../../directus/schema/setup-manager.mjs)
- [directus/schema/verify-manager.mjs](../../../directus/schema/verify-manager.mjs)
- [directus/schema/setup-dashboard.mjs](../../../directus/schema/setup-dashboard.mjs)
- [directus/schema/seed-demo-audits.mjs](../../../directus/schema/seed-demo-audits.mjs)

## Cách kiểm chứng lại

```bash
node directus/schema/verify-manager.mjs
```

Phải ra 16/16 pass. Còn giao diện thì mở `http://localhost:8055/admin/insights`
bằng `manager@example.com` / `Manager123!` và nhìn tận mắt — nhất là hai biểu đồ
cột có vẽ ra được không.
