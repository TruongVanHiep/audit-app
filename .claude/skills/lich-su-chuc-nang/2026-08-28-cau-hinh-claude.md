# Cấu hình `.claude/` + quy trình Git

**Ngày:** 2026-08-28 · **Trạng thái:** ✅ Xong

## Làm được gì

- Dựng đủ 9 mục trong `.claude/`: `settings.json`, `settings.local.json`,
  `rules/`, `skills/`, `commands/`, `output-styles/`, `agents/`, `workflows/`,
  `agent-memory/`.
- 3 lệnh tắt: `/trang-thai`, `/kiem-tra-quyen`, `/dung-lai-backend`.
- 1 subagent `directus-permission-reviewer` chuyên rà lỗ hổng phân quyền.
- Quy trình Git theo mô hình **Gitflow** (`main` + `develop` + `feature/`
  `release/` `hotfix/` `bugfix/`), kèm quy tắc đánh version SemVer.

## Quyết định kỹ thuật

**Rule dùng `paths` frontmatter để chỉ nạp khi cần.** Rule Directus chỉ nạp khi
đụng `directus/**` hoặc `docker-compose.yml`; rule mobile chỉ nạp khi đụng
`mobile/src/**`. Tiết kiệm context so với nhét tất cả vào một CLAUDE.md.

**`settings.json` chặn 2 lệnh nguy hiểm:** `docker compose down -v` (xoá volume)
và `rm -rf`. Đồng thời cho phép sẵn các lệnh chạy đi chạy lại (4 script schema,
`docker compose ps/logs/up`, `curl localhost:8055`) để đỡ bị hỏi quyền liên tục.

**Không viết tay file mẫu vào `workflows/` và `agent-memory/`.** Hai thư mục
này do runtime tự sinh — workflow lưu bằng cách bấm `s` trong `/workflows`,
agent-memory sinh khi subagent bật `memory: true`. Chỉ để README giải thích.

**Nhật ký chức năng gom vào MỘT skill** (`lich-su-chuc-nang`) thay vì mỗi chức
năng một skill riêng. Claude chọn skill dựa trên `description`, nên 10 bản ghi
lịch sử làm skill sẽ chen vào chỗ của skill thật và gây nhiễu.

**Gitflow thay vì trunk-based.** App audit phát hành theo version, cần môi
trường staging để QA test trước khi lên production — đúng hình dạng Gitflow.

## Cạm bẫy đã gặp

**Rule đặt sai chỗ thì không có tác dụng gì cả.** Ba file rule bị chuyển vào
`.claude/skills/rules/`. Claude Code chỉ đọc rule từ `.claude/rules/`, còn
`skills/` thì cần cấu trúc `<tên>/SKILL.md`. Ở vị trí đó chúng không được nạp
vào đâu — im lặng, không báo lỗi.

**Rule và settings chỉ nạp lúc khởi động phiên.** Tạo xong thì phiên đang chạy
chưa áp dụng, phải mở phiên mới.

**Bẫy Gitflow: quên merge ngược `release/` về `develop`.** Merge release vào
`main` xong rồi quên merge về `develop` → mọi fix lúc QA biến mất ở version
sau, lỗi cũ quay lại. Đã viết thành quy tắc bắt buộc trong git-workflow.md.

## Phát hiện về repo (chưa sửa)

Khi kiểm tra để viết quy trình Git, phát hiện 4 vấn đề đang tồn tại:

1. **`mobile/` không nằm trong repo cha** — gitlink mode `160000` nhưng không
   có `.gitmodules`. Ai clone về sẽ nhận thư mục `mobile/` **rỗng**.
2. **2.906 file `data/database/` đang được commit** — toàn bộ thư mục dữ liệu
   Postgres, cộng `backup/*.sql`.
3. **Chưa có `.gitignore`** — gốc rễ của vấn đề 2.
4. Rule nằm sai chỗ (đã nêu ở trên).

Lệnh khắc phục nằm ở cuối
[.claude/rules/git-workflow.md](../../rules/git-workflow.md).

## File liên quan

- [.claude/rules/git-workflow.md](../../rules/git-workflow.md)
- [.claude/settings.json](../../settings.json)
- [.claude/agents/directus-permission-reviewer.md](../../agents/directus-permission-reviewer.md)

## Cách kiểm chứng lại

Mở phiên Claude Code mới, chạy `/context` — phần **Memory files** phải liệt kê
`.claude/rules/git-workflow.md`. Không thấy nghĩa là rule chưa được nạp.
