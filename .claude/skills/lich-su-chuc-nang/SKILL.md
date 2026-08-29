---
name: lich-su-chuc-nang
description: Nhật ký các chức năng đã xây trong dự án audit-app — quyết định kỹ thuật, lý do, cạm bẫy đã gặp và cách kiểm chứng. Dùng khi cần nhớ lại một phần đã làm, khi tiếp tục công việc dở dang, hoặc khi ghi lại một chức năng vừa hoàn thành.
---

# Nhật ký chức năng

Mỗi chức năng làm xong được ghi lại thành một file trong thư mục này. Mục đích
không phải liệt kê "đã làm gì" — cái đó git log có rồi — mà giữ lại **những thứ
git log không lưu được**: vì sao chọn cách này, đã thử cách nào thất bại, và
cạm bẫy nào đã gặp.

## Danh sách

| File | Chức năng | Trạng thái |
|---|---|---|
| [2026-08-28-backend-schema.md](2026-08-28-backend-schema.md) | Schema Directus + dữ liệu mẫu | ✅ Xong, đã kiểm chứng |
| [2026-08-28-ha-directus-11.md](2026-08-28-ha-directus-11.md) | Hạ Directus 12 → 11 + healthcheck | ✅ Xong, đã kiểm chứng |
| [2026-08-28-phan-quyen-auditor.md](2026-08-28-phan-quyen-auditor.md) | Phân quyền Auditor + test tấn công | ✅ Xong, 17/17 pass |
| [2026-08-28-mobile-nen-tang.md](2026-08-28-mobile-nen-tang.md) | Nền tảng app Expo | ✅ Xong (hoàn tất 29/08) |
| [2026-08-29-man-hinh-checklist.md](2026-08-29-man-hinh-checklist.md) | Màn hình chấm điểm + chạy được lần đầu | ✅ Xong, đã kiểm chứng end-to-end |
| [2026-08-28-cau-hinh-claude.md](2026-08-28-cau-hinh-claude.md) | Cấu hình `.claude/` + quy trình Git | ✅ Xong |
| [2026-08-28-don-dep-repo-git.md](2026-08-28-don-dep-repo-git.md) | Dọn dẹp repo + dựng Gitflow | ✅ Xong, đã clone thử |

## Khi nào ghi

Ghi khi một chức năng **đã chạy được và đã kiểm chứng**, không ghi lúc mới viết
xong code. Chức năng dở dang thì vẫn ghi, nhưng phải đánh dấu rõ ⚠️ và liệt kê
chính xác còn thiếu gì.

## Cách ghi

Tên file: `YYYY-MM-DD-<ten-khong-dau>.md`. Nội dung theo khuôn:

```markdown
# <Tên chức năng>

**Ngày:** YYYY-MM-DD · **Trạng thái:** ✅ Xong / ⚠️ Dở dang

## Làm được gì
<2-4 gạch đầu dòng, cụ thể và đo được>

## Quyết định kỹ thuật
<Chọn cách nào, và VÌ SAO không chọn cách khác. Đây là phần giá trị nhất.>

## Cạm bẫy đã gặp
<Thứ đã thất bại và cách sửa. Ghi cả những thứ tưởng đúng mà sai.>

## File liên quan
<Đường dẫn>

## Cách kiểm chứng lại
<Lệnh cụ thể chạy được, không phải mô tả chung chung>

## Còn thiếu
<Chỉ có nếu trạng thái là ⚠️>
```

Sau khi thêm file mới, **cập nhật bảng Danh sách ở trên** — bảng đó là thứ đọc
đầu tiên khi quay lại dự án.

## Nguyên tắc

- Viết thật. Chức năng chưa chạy thử thì ghi là chưa chạy thử.
- Ưu tiên ghi **cái đã sai** hơn cái đã đúng. Cái đúng đọc code là ra;
  cái đã sai thì không ai biết nữa nếu không ghi.
- Không chép lại nội dung code vào đây. Ghi lý do, dẫn đường dẫn file.
