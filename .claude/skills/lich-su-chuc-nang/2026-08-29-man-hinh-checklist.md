# Màn hình làm phiếu audit + chạy được lần đầu

**Ngày:** 2026-08-29 · **Trạng thái:** ✅ Xong, đã chạy thật và kiểm chứng end-to-end

## Làm được gì

- Viết `src/app/(app)/audit/[id].tsx` — màn hình chấm điểm, phần chính của app.
- Xoá 17 file demo của template Expo (1.045 dòng), sửa 8 lỗi kiểu.
- 23 test cho `scoring.ts`, chạy bằng `node --test` trực tiếp trên file `.ts`.
- Chạy thật trong trình duyệt: đăng nhập → chọn cửa hàng → chấm điểm → dữ liệu
  về đúng Directus.

## Kiểm chứng end-to-end

| Bước | Kết quả |
|---|---|
| Đăng nhập `auditor@example.com` | ✅ vào được, hiện "Nguyễn Kiểm Toán" |
| Tải danh sách cửa hàng | ✅ 6 cửa hàng từ Directus |
| Tìm kiếm "HN-001" | ✅ lọc còn 1 |
| Bắt đầu audit | ✅ tạo phiếu, chuyển sang `/audit/<uuid>` |
| Tải bộ tiêu chí | ✅ 18 tiêu chí, 5 nhóm, điểm tối đa 165 |
| Chấm "Đạt" (hệ số 2) | ✅ 10/165 điểm, 6.1%, tiến độ 1/18 |
| Dữ liệu trong DB | ✅ `value="pass" score=10`, auditor gán đúng người |

## Quyết định kỹ thuật

**Lưu từng câu trả lời ngay khi trả lời**, không đợi bấm "Lưu". Auditor thoát
app giữa chừng hay hết pin thì phần đã làm vẫn còn.

**Lưu lạc quan** — cập nhật giao diện trước, gọi API sau. Không bắt người dùng
chờ vòng quay mỗi lần chạm.

**Lỗi lưu không chặn thao tác tiếp theo**, chỉ hiện dấu hiệu trên đúng tiêu chí
đó. Mất mạng vẫn làm tiếp được, nộp bài mới cần mạng.

**Dùng `answersRef` song song với state.** Hàm bất đồng bộ đọc `answersRef.current`
thay vì biến trong closure, tránh bắt phải giá trị cũ khi người dùng chạm nhanh
liên tiếp.

## Cạm bẫy đã gặp

### 1. `expo-secure-store` không chạy trên web

Lỗi: `ExpoSecureStore.default.setValueWithKeyAsync is not a function`.

Bản web của module đúng nghĩa là `export default {}` — một object rỗng
(`node_modules/expo-secure-store/build/ExpoSecureStore.web.js`). Đây là module
native, không có bản web.

Sửa: `Platform.OS === 'web'` thì lùi về `localStorage`.

⚠️ `localStorage` **không an toàn** — mọi JavaScript trên trang đều đọc được,
XSS là lộ token. Chỉ chấp nhận cho môi trường phát triển. Bản web phát hành
thật phải dùng cookie `httpOnly` do server đặt.

### 2. Viết test xong quên chạy `tsc`

`node --test` pass 23/23 nhưng `tsc` vẫn 3 lỗi (thiếu `@types/node`, và import
kèm đuôi `.ts`). Đã commit rồi mới phát hiện — vi phạm chính quy tắc của dự án
là phải chạy `tsc` trước khi commit.

Bài học: `node --test` chỉ **bóc bỏ** kiểu chứ không **kiểm tra** kiểu. Hai
lệnh khác nhau, phải chạy cả hai.

### 3. Không nhét `types: ["node"]` vào tsconfig chính

Cách nhanh để hết lỗi trên là thêm `types: ["node"]` vào `tsconfig.json`. Nhưng
làm vậy thì code app cũng nhìn thấy global của Node — TypeScript sẽ không còn
báo lỗi khi ai đó lỡ dùng `fs`, `Buffer` hay `process.exit()` trong màn hình
React Native, những thứ không tồn tại trên điện thoại.

Đã tách `tsconfig.test.json` riêng. Test được kiểm kiểu đầy đủ, app vẫn giữ
được hàng rào.

### 4. URL bundle của expo-router không phải `/index.bundle`

Muốn ép Metro bundle để lộ lỗi mà không cần điện thoại, phải gọi
`/.expo/.virtual-metro-entry.bundle?platform=android`. Gọi `/index.bundle`
trả 404 vì entry là `expo-router/entry`.

## File liên quan

- [mobile/src/app/(app)/audit/[id].tsx](../../../mobile/src/app/(app)/audit/[id].tsx)
- [mobile/src/lib/scoring.test.ts](../../../mobile/src/lib/scoring.test.ts)
- [mobile/tsconfig.test.json](../../../mobile/tsconfig.test.json)

## Cách kiểm chứng lại

```bash
cd mobile && npm run typecheck && npm run test
```

Phải ra 0 lỗi và 23/23 pass. Muốn chắc test còn tác dụng thì sửa
`scoring.ts` bỏ điều kiện `criticalFailures.length === 0` — đúng 1 test phải
fail, rồi khôi phục.
