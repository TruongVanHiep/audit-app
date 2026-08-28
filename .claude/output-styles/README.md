# output-styles/

Output style thay đổi **cách Claude trình bày** câu trả lời trong dự án này —
giọng văn, độ dài, cấu trúc — mà không đổi việc nó làm.

Hiện dự án chưa dùng style riêng nào. Phần phong cách đang được quy định trong
[`.claude/rules/ngon-ngu-va-phong-cach.md`](../rules/ngon-ngu-va-phong-cach.md)
là đủ.

## Khi nào cần tới thư mục này

Khi cả nhóm muốn thống nhất một kiểu trình bày cố định, ví dụ "luôn trả lời dạng
checklist ngắn" hay "luôn kèm phần Cạm bẫy ở cuối".

Tạo file markdown có frontmatter:

```markdown
---
name: bao-cao-ngan
description: Trả lời ngắn gọn dạng gạch đầu dòng, luôn kèm mục "Cần lưu ý"
---

Trình bày mọi câu trả lời theo cấu trúc...
```

Chọn style bằng lệnh `/output-style`.

## Phân biệt với rules/

- `rules/` = **làm gì** (quy ước kỹ thuật, ràng buộc dự án)
- `output-styles/` = **trình bày thế nào** (giọng văn, bố cục câu trả lời)
