# agent-memory/

Bộ nhớ bền của **subagent**, tách riêng khỏi auto memory của phiên chính.

## Khác gì auto memory của phiên chính?

| | Auto memory phiên chính | agent-memory |
|---|---|---|
| Nằm ở | `~/.claude/projects/<dự-án>/memory/` | thư mục này |
| Ai đọc | Cuộc hội thoại chính | Chỉ subagent tương ứng |
| Nội dung | Sở thích của bạn, bối cảnh dự án | Thứ subagent đó tự học qua nhiều lần chạy |

Auto memory của phiên chính **không** được nạp vào subagent, và ngược lại. Đó là
chủ ý: subagent có context window riêng, nhét thêm bộ nhớ của phiên chính vào
chỉ làm loãng việc nó đang phải làm.

## Cách bật

Thêm `memory` vào frontmatter của subagent trong `.claude/agents/`:

```markdown
---
name: directus-permission-reviewer
description: ...
memory: true
---
```

Subagent sẽ tự ghi ghi chú vào thư mục này khi phát hiện điều đáng nhớ qua các
lần chạy — ví dụ những lỗ hổng đã từng gặp ở dự án này, hay những chỗ đã kiểm
tra kỹ và xác nhận an toàn.

Hiện `directus-permission-reviewer` **chưa bật** `memory`. Bật khi nào bạn thấy
nó lặp lại cùng một phát hiện qua nhiều phiên.

## Ghi chú

Thư mục này do runtime tự tạo và tự quản. Bạn đọc/sửa/xoá file trong đây được
(đều là markdown thường), nhưng đừng tự tạo file bằng tay và mong subagent hiểu.
