# Quy trình Git cho dự án audit-app

Áp dụng cho cả người và Claude. Mục tiêu: repo sạch, lịch sử đọc được, và
**đồng đội clone về là chạy được ngay**.

## ⚠️ Cảnh báo: ĐỪNG `git switch main`

Nhánh `main` vẫn đang ở commit `8882b80`, nơi 2.906 file `data/database` còn
được theo dõi. Chuyển sang `main` sẽ khiến git **ghi đè thư mục dữ liệu
Postgres đang chạy** bằng bản chụp cũ — database hỏng ngay lập tức.

Đây không phải giả thuyết. Ngày 2026-08-28, khi merge nhánh dọn dẹp vào
`develop`, git đã xoá sạch `data/database`, `data/database_v12_old` và
`backup/*.sql` khỏi ổ đĩa (vì cả ba đều đang được track và bị đánh dấu xoá
trong commit). Postgres crash-loop với lỗi
`initdb: directory exists but is not empty`.

Dựng lại được trong 2 phút nhờ script schema — nhưng chỉ vì backend là code.

**Trước khi làm bất cứ thao tác nào đụng tới `main`:**

```bash
docker compose down          # tắt Postgres, tránh ghi đè file đang mở
```

Cách xoá hẳn cái bẫy này: phát hành `release/0.1.0` để `main` bắt kịp
`develop`, hoặc viết lại lịch sử bằng `git filter-repo`. Xem mục *Việc cần sửa*.

## Không bao giờ commit

Đây là phần quan trọng nhất. Repo này đang vi phạm cả bốn — xem mục *Việc cần
sửa* ở cuối.

| Không commit | Vì sao |
|---|---|
| `data/database/` | Thư mục dữ liệu Postgres. Hàng nghìn file nhị phân, đổi liên tục khi container chạy, diff vô nghĩa, phình repo, và chứa cả hash mật khẩu người dùng. Dữ liệu tái tạo được bằng script. |
| `backup/*.sql` | Dump database. Là dữ liệu, không phải mã nguồn. Chứa dữ liệu thật khi lên production. |
| `.claude/settings.local.json` | Theo thiết kế đây là file cấu hình **cá nhân**, không dùng chung. |
| `uploads/` | File người dùng tải lên. Là dữ liệu. |
| `mobile/node_modules/`, `.env` | Tái tạo bằng `npm install`; `.env` chứa cấu hình theo máy. |

Nguyên tắc chung: **commit thứ tạo ra dữ liệu, không commit dữ liệu.**
Schema và seed nằm trong `directus/schema/*.mjs` — đó mới là nguồn sự thật.

## Mô hình nhánh: Gitflow

Dự án dùng **Gitflow** (Vincent Driessen) — chia quá trình phát triển thành các
giai đoạn rõ ràng, hợp với dự án phát hành theo version như app audit này.

### Hai nhánh sống mãi

| Nhánh | Vai trò |
|---|---|
| `main` | Mã nguồn **ổn định**, đúng bằng thứ đang chạy trên production. Mỗi commit trên `main` đều được gắn tag version. Không bao giờ commit thẳng vào. |
| `develop` | Chứa **toàn bộ history** phát triển. Là nơi tích hợp mọi tính năng mới và sửa đổi. Đây là nhánh mặc định để rẽ nhánh ra làm việc. |

### Bốn nhánh tạm thời

| Nhánh | Tách ra từ | Merge trở lại vào | Dùng khi |
|---|---|---|---|
| `feature/<việc>` | `develop` | `develop` | Làm tính năng mới hoặc sửa đổi tính năng |
| `release/<version>` | `develop` | `main` **và** `develop` | Develop đã đủ tính năng, cần QA trước khi lên prod |
| `hotfix/<việc>` | `main` | `main` **và** `develop` | Lỗi phát sinh trên production, phải sửa gấp |
| `bugfix/<việc>` | `develop` | `develop` | Lỗi phát hiện lúc đang phát triển (chưa lên prod) |

```
main        ●────────────────●──────────────●──────  (tag: v1.0.0, v1.0.1, v1.1.0)
             \              /  \           /
release       \        ●───●    \         /          (QA / staging)
               \      /          \       /
develop     ●───●────●────────────●─────●───────
             \     /                \   
feature       ●───●                  \                (nhiều nhánh song song)
                                      \
hotfix                                 ●              (tách từ main, sửa lỗi prod)
```

Quy ước đặt tên — dùng tiếng Việt không dấu, nối bằng gạch ngang:

```
feature/man-hinh-checklist
feature/upload-anh-bang-chung
bugfix/diem-tinh-sai-khi-bo-trong
release/1.2.0
hotfix/loi-403-khi-upload
```

Mỗi nhánh làm **một việc**. Nhánh sống càng ngắn càng tốt — nhánh để một tuần
là lúc merge sẽ đau.

### Khởi tạo `develop` (repo này chưa có)

```bash
git switch main
git switch -c develop
git push -u origin develop
```

Sau đó đặt `develop` làm nhánh mặc định trên GitHub, để pull request mới tự
nhắm vào `develop` chứ không phải `main`.

## Commit

Dùng [Conventional Commits](https://www.conventionalcommits.org/):

```
<loại>(<phạm vi>): <mô tả ngắn, tiếng Việt, không viết hoa đầu, không chấm cuối>

<thân bài: giải thích VÌ SAO, không phải LÀM GÌ — cái làm gì đã nằm trong diff>
```

Loại: `feat` `fix` `chore` `docs` `refactor` `test` `perf`
Phạm vi: `directus` `mobile` `docker` `schema` `quyen`

Ví dụ tốt:

```
fix(quyen): them validation chan auditor mao danh nguoi khac

Preset `auditor: $CURRENT_USER` chi la gia tri mac dinh — client gui
`auditor: <id nguoi khac>` len thi gia tri cua client thang. Da kiem chung
bang thuc nghiem: auditor A tao duoc phieu gan cho auditor B.

Them validation `{ auditor: { _eq: $CURRENT_USER } }` va test trong verify.mjs.
```

Một commit = một thay đổi logic hoàn chỉnh. Đừng gộp "sửa lỗi + đổi tên biến +
thêm tính năng" vào một commit.

## Trước khi commit

Bắt buộc, theo thứ tự:

```bash
git status              # xem CHÍNH XÁC những gì sắp vào commit
git diff --staged       # đọc lại diff, không commit mù
```

Đụng vào `directus/schema/` thì phải chạy:

```bash
node directus/schema/setup-roles.mjs && node directus/schema/verify.mjs
```

Đụng vào `mobile/` thì phải chạy:

```bash
cd mobile && npx tsc --noEmit
```

Test đỏ thì **không commit**. Commit code hỏng lên `main` là cách nhanh nhất
làm cả nhóm mất buổi sáng.

## Vòng đời từng loại nhánh

Luôn merge bằng `--no-ff`. Fast-forward làm mất dấu vết ranh giới của tính năng,
lịch sử phẳng lì và sau này không lần lại được một tính năng gồm những commit nào.

### 1. Feature — làm tính năng mới

```bash
git switch develop && git pull
git switch -c feature/man-hinh-checklist

# ...làm việc, commit nhiều lần...

git switch develop && git pull
git switch feature/man-hinh-checklist
git rebase develop          # gỡ xung đột trên nhánh của MÌNH, không làm bẩn develop
# chạy lại test sau rebase
```

Xong thì mở **pull request** vào `develop`, không tự merge. PR là nơi đồng đội
đọc code trước khi nó vào nhánh chung.

```bash
git switch develop
git merge --no-ff feature/man-hinh-checklist
git branch -d feature/man-hinh-checklist
```

### 2. Release — chuẩn bị phát hành

Khi `develop` đã đủ tính năng cho một version:

```bash
git switch develop && git pull
git switch -c release/1.2.0
```

Nhánh này là môi trường **staging/QA**. Trên đây chỉ được:
- sửa lỗi QA tìm ra
- cập nhật số version, changelog

**Không** thêm tính năng mới. Muốn thêm thì để dành cho version sau — đó là toàn
bộ lý do release tồn tại.

Test xong thì merge vào `main`, gắn tag, rồi merge ngược về `develop`:

```bash
git switch main
git merge --no-ff release/1.2.0
git tag -a v1.2.0 -m "Release 1.2.0: man hinh checklist + upload anh"

git switch develop
git merge --no-ff release/1.2.0     # để develop có các fix của QA
git branch -d release/1.2.0
git push origin main develop --tags
```

**Bước merge ngược về `develop` rất hay bị quên.** Quên là các fix lúc QA biến
mất ở version sau, và lỗi cũ quay lại.

### 3. Hotfix — chữa cháy production

Lỗi trên production thì tách thẳng từ `main`, không đi qua `develop` (vì
`develop` đang có code chưa test xong):

```bash
git switch main && git pull
git switch -c hotfix/loi-403-khi-upload

# ...sửa, test...

git switch main
git merge --no-ff hotfix/loi-403-khi-upload
git tag -a v1.2.1 -m "Hotfix: loi 403 khi upload anh bang chung"

git switch develop
git merge --no-ff hotfix/loi-403-khi-upload    # bắt buộc, nếu không lỗi sẽ quay lại
git branch -d hotfix/loi-403-khi-upload
git push origin main develop --tags
```

Hotfix chỉ tăng số cuối (patch): `1.2.0` → `1.2.1`.

## Đánh version

Dùng [Semantic Versioning](https://semver.org/lang/vi/): `MAJOR.MINOR.PATCH`

| Tăng số | Khi nào | Ví dụ ở dự án này |
|---|---|---|
| `PATCH` | Sửa lỗi, không đổi cách dùng | Sửa lỗi 403 khi upload ảnh |
| `MINOR` | Thêm tính năng, cũ vẫn chạy | Thêm màn hình xem lại phiếu đã nộp |
| `MAJOR` | Thay đổi phá vỡ tương thích | Đổi schema khiến app bản cũ không gọi được API |

Tag chỉ gắn trên `main`, và chỉ gắn khi merge từ `release/` hoặc `hotfix/`.

## Quy tắc cho Claude

- **Chỉ commit khi được yêu cầu rõ ràng.** Không tự động commit sau khi sửa code.
- **Không bao giờ commit thẳng vào `main` hoặc `develop`.** Đang đứng ở một
  trong hai nhánh đó thì tạo nhánh `feature/` (tách từ `develop`) hoặc
  `hotfix/` (tách từ `main`) trước đã.
- Rẽ nhánh làm tính năng thì tách từ `develop`, không tách từ `main`.
- Merge luôn dùng `--no-ff`. Không bao giờ `git merge --squash` vào `develop`.
- Không tự gắn tag version — đó là quyết định phát hành, phải hỏi trước.
- Merge `release/` hoặc `hotfix/` thì phải merge vào **cả hai** nhánh `main` và
  `develop`. Nhắc lại nếu người dùng chỉ yêu cầu merge một bên.
- Sau `git add`, luôn chạy `git status` đọc lại danh sách file. Thấy file lạ —
  nhất là file có vẻ chứa dữ liệu hoặc secret — thì mở ra xem trước khi commit.
- Không `git push` khi chưa được yêu cầu.
- Không dùng `git reset --hard`, `git checkout .`, `git clean -fd` khi chưa
  chạy `git status` và chưa `git stash -u` những thay đổi đang có.

---

## Việc cần sửa trong repo này

Bốn vấn đề đang tồn tại, xếp theo mức nghiêm trọng.

### 1. `mobile/` không nằm trong repo — nghiêm trọng nhất

`create-expo-app` đã tạo một git repo riêng bên trong `mobile/`. Repo cha đang
ghi nhận `mobile` ở chế độ `160000` (gitlink) nhưng **không có `.gitmodules`**.

Hậu quả: ai clone repo này về sẽ nhận được thư mục `mobile/` **rỗng**. Toàn bộ
mã nguồn app điện thoại không hề được repo cha lưu.

Cách sửa (gộp mobile vào repo cha — hợp lý vì backend và app đi cùng nhau):

```bash
git rm --cached mobile
rm -rf mobile/.git
git add mobile
```

### 2. Thư mục dữ liệu Postgres đang được commit

2.906 file trong `data/database/` đang nằm trong repo.

```bash
git rm -r --cached data/database backup
```

### 3. Chưa có `.gitignore`

Tạo `.gitignore` ở thư mục gốc:

```gitignore
# Dữ liệu runtime — tái tạo bằng directus/schema/*.mjs
data/
uploads/
backup/

# Cấu hình cá nhân
.claude/settings.local.json
.env
.env.local

# Node
node_modules/
npm-debug.log*

# Expo
mobile/.expo/
mobile/dist/
mobile/web-build/

# Hệ điều hành
.DS_Store
Thumbs.db
```

### 4. Rules đang nằm sai chỗ nên không có tác dụng

Ba file rule hiện ở `.claude/skills/rules/`. Claude Code chỉ đọc rules từ
`.claude/rules/`, và `skills/` thì cần cấu trúc `<tên>/SKILL.md`. Ở vị trí hiện
tại chúng **không được nạp vào đâu cả**.

```bash
git mv .claude/skills/rules .claude/rules
```
