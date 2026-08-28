---
description: Chạy bộ test tự tấn công hệ thống phân quyền Directus
allowed-tools: Bash, Read, Edit
---

Chạy `node directus/schema/verify.mjs`.

Script này đăng nhập bằng hai tài khoản auditor thật (không phải admin) rồi thử
làm những việc lẽ ra phải bị chặn: sửa dữ liệu gốc, mạo danh người khác, đọc
phiếu của người khác, sửa phiếu đã nộp.

Báo cáo kết quả:

- **Toàn bộ pass**: nói rõ đã chạy bao nhiêu test và pass hết.
- **Có test fail**: đưa nguyên output ra. Quan trọng — trước khi sửa test,
  hãy xác định xem đó là *lỗi của test* hay là *lỗ hổng bảo mật thật*.
  Dự án này đã từng có một test fail phơi ra lỗ hổng mạo danh thật.
  Điều tra bằng cách gọi API trực tiếp và kiểm tra dữ liệu thực trong DB
  bằng quyền admin, đừng vội kết luận là test viết sai.

Nếu phải sửa quyền, sửa trong `directus/schema/setup-roles.mjs` (nguồn sự thật),
chạy lại script đó, rồi chạy lại verify — đừng sửa tay trong UI Directus.
