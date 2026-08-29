# Schema Directus + dữ liệu mẫu

**Ngày:** 2026-08-28 · **Trạng thái:** ✅ Xong, đã kiểm chứng

## Làm được gì

- 6 collection nghiệp vụ: `stores`, `templates`, `template_items`, `audits`,
  `audit_answers`, `findings`, cùng 2 bảng trung gian ảnh
  `audit_answers_photos`, `findings_photos`.
- Toàn bộ quan hệ M2O và M2M-tới-file dựng bằng script, không click tay trong UI.
- Dữ liệu mẫu: 6 cửa hàng, 1 bộ tiêu chí v1, 18 câu hỏi (tổng trọng số 33 →
  điểm tối đa 165 trên thang 5 điểm/tiêu chí).

## Quyết định kỹ thuật

**Viết schema bằng script thay vì click trong UI Directus.** Click nhanh hơn
lúc đầu nhưng không tái tạo được, không đưa vào Git được, và đồng đội không có
cách nào dựng lại môi trường giống hệt. Script `.mjs` là nguồn sự thật. Quyết
định này đã trả công ngay trong ngày: khi phải xoá database để hạ Directus 11,
toàn bộ backend dựng lại trong vài giây.

**Dùng REST API trần (fetch) thay vì `@directus/sdk` cho phần schema.** Node 18+
đã có `fetch` toàn cục nên không cần cài dependency, và quan trọng hơn là nhìn
thẳng được vào HTTP request thật để hiểu Directus làm gì. Phần app mobile thì
ngược lại — dùng SDK vì cần type safety.

**Khoá chính UUID thay vì số tự tăng.** App mobile cần tạo được bản ghi khi
offline (sinh id ngay trên máy) rồi mới đồng bộ lên server. Số tự tăng thì phải
hỏi server mới có id.

**Tách `templates` + `template_items` (khuôn) khỏi `audits` + `audit_answers`
(bài làm).** Khi công ty đổi bộ tiêu chí, các phiếu audit cũ vẫn giữ nguyên câu
hỏi tại thời điểm đó. Nếu gộp chung, sửa tiêu chí là làm sai lệch lịch sử.

**Lưu `audit_answers.value` dạng chuỗi cho mọi kiểu câu trả lời.** Mỗi tiêu chí
một kiểu (`pass_fail` / `score_5` / `number` / `text`), tách thành 4 cột thì
3 cột luôn null. App chịu trách nhiệm đọc/ghi đúng theo `answer_type`.

## Cạm bẫy đã gặp

**Idempotent không tự nhiên mà có.** Mọi hàm `create*` trong `lib.mjs` phải
nhận vào một `Set` những thứ đã tồn tại và tự bỏ qua. Đã kiểm chứng bằng cách
chạy script hai lần liên tiếp — lần hai phải toàn "đã có, bỏ qua" và exit 0.

**M2M tới file cần 4 bước, không phải 1.** Directus lưu M2M bằng bảng trung
gian: phải tạo bảng junction, 2 cột khoá ngoại, 1 field ảo trên bảng gốc, rồi
2 relation. Thiếu bước nào cũng không báo lỗi ngay mà hỏng lúc upload ảnh.

## File liên quan

- [directus/schema/lib.mjs](../../../directus/schema/lib.mjs) — helper bọc REST API
- [directus/schema/setup-schema.mjs](../../../directus/schema/setup-schema.mjs)
- [directus/schema/seed-data.mjs](../../../directus/schema/seed-data.mjs)

## Cách kiểm chứng lại

```bash
node directus/schema/setup-schema.mjs && node directus/schema/setup-schema.mjs
```

Chạy hai lần liên tiếp. Lần hai phải không có dòng `✓` nào cho collection/field
đã tồn tại, và exit code phải là 0.
