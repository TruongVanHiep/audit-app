# workflows/

Nơi chứa **dynamic workflow** — script JavaScript điều phối hàng chục subagent
chạy song song, dùng cho việc quá lớn cho một cuộc hội thoại: rà soát toàn bộ
codebase, migrate hàng trăm file, nghiên cứu cần đối chiếu chéo nhiều nguồn.

## Không viết tay file ở đây

Workflow được **Claude sinh ra**, không phải bạn gõ. Cách làm:

1. Mô tả việc cần làm kèm từ khoá `ultracode`, ví dụ:
   `ultracode: rà soát mọi màn hình trong mobile/src/app/ xem có chỗ nào gọi API mà không bắt lỗi`
2. Claude viết script và chạy nền, phiên làm việc của bạn vẫn dùng được.
3. Chạy `/workflows`, chọn lần chạy vừa rồi, bấm `s` để lưu script vào đây.
4. Từ đó nó thành lệnh `/<tên>` chạy lại được bất cứ lúc nào.

## Định dạng file đã lưu

JavaScript, khối `meta` rồi tới thân script dùng các primitive
`agent()`, `pipeline()`, `parallel()`, `phase()`:

```javascript
export const meta = {
  name: 'ra-soat-man-hinh',
  description: 'Rà soát mọi màn hình xem có gọi API mà không bắt lỗi',
}

const found = await agent('Liệt kê mọi file .tsx trong mobile/src/app/.', {
  schema: { type: 'object', required: ['files'],
            properties: { files: { type: 'array', items: { type: 'string' } } } },
})

const reviews = await pipeline(found.files, file =>
  agent(`Rà soát ${file}: mọi lời gọi API có được bọc try/catch không?`, { label: file }),
)

return reviews.filter(Boolean)
```

Lưu ý: script không truy cập được filesystem hay shell trực tiếp — chỉ các
`agent()` mới làm được việc đó. Script chỉ điều phối.

## Chi phí

Một lần chạy sinh nhiều agent nên tốn token hơn hẳn làm tay. Thử trên phạm vi
nhỏ trước (một thư mục thay vì cả repo). `.claude/settings.json` của dự án này
đặt `workflowSizeGuideline: "small"` (dưới 5 agent) cho hợp với quy mô hiện tại.
