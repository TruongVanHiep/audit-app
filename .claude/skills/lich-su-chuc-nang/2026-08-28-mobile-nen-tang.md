# Nền tảng app Expo

**Ngày:** 2026-08-28 · **Trạng thái:** ⚠️ Dở dang — code đã viết, **chưa chạy thử lần nào**

## Làm được gì

- Khởi tạo dự án Expo SDK 57 / React Native 0.86 / React 19 / expo-router 57,
  cài `@directus/sdk` 25, `expo-secure-store`, `expo-image-picker`,
  `expo-location`.
- Viết tầng nền: kiểu dữ liệu, Directus client, tầng gọi API, logic tính điểm,
  context xác thực, bộ component giao diện.
- Viết 5 màn hình: đăng nhập, danh sách cửa hàng, lịch sử, khung tab, và
  component chấm điểm từng tiêu chí.

**Chưa chạy `npm start`, chưa chạy `npx tsc --noEmit` lần nào.** Gần như chắc
chắn còn lỗi TypeScript chưa lộ ra.

## Quyết định kỹ thuật

**Tách 3 tầng rõ ràng.** Màn hình (`src/app/`) chỉ hiển thị; mọi lời gọi
Directus nằm trong `src/lib/api.ts`; logic nghiệp vụ là hàm thuần trong
`src/lib/scoring.ts`. Khi sếp đổi cách tính điểm, chỉ sửa một file thay vì lục
tung các màn hình.

**Token lưu bằng `expo-secure-store`, không dùng `AsyncStorage`.** SecureStore
lưu vào Keychain (iOS) / Keystore (Android) — vùng được hệ điều hành mã hoá.
AsyncStorage lưu plaintext, máy đã root là đọc được.

**Bảo vệ route bằng `<Stack.Protected guard={...}>`.** Đây là API mới của
expo-router, thay cho kiểu tự viết `useEffect` + `router.replace` ở các bản
trước (gây nháy màn hình).

**Giữ splash screen tới khi biết chắc trạng thái đăng nhập.** Nếu không, app
nháy qua màn đăng nhập rồi mới nhảy vào màn chính.

**Thiết kế cho người dùng hiện trường:** vùng chạm tối thiểu 48px, nén ảnh
`quality: 0.6` trước khi gửi, xin ảnh đã resize từ Directus (`?width=`), và
**không** chặn người dùng làm việc khi không lấy được GPS.

## Cạm bẫy đã gặp

**Template Expo SDK 57 dùng `src/app/` chứ không phải `app/`,** và path alias
`@/*` trỏ vào `./src/*`. Khác với các bản trước.

**`expo-image-picker` SDK 57 dùng `mediaTypes: ['images']` dạng mảng,**
`MediaTypeOptions` đã deprecated. Đã đọc docs đúng phiên bản trước khi viết,
theo yêu cầu trong `mobile/AGENTS.md`.

**`EXPO_PUBLIC_DIRECTUS_URL` phải là IP LAN, không được là `localhost`.** Với
điện thoại, `localhost` là chính cái điện thoại đó. IP hiện tại
`172.19.200.63` — đổi Wi-Fi là phải sửa lại.

Biến `EXPO_PUBLIC_*` được nhúng thẳng vào bundle nên **ai cũng đọc được** —
không bao giờ để secret vào đó.

## Còn thiếu

1. **`src/app/(app)/audit/[id].tsx` chưa viết** — màn hình làm checklist, phần
   quan trọng nhất. Layout đã khai báo route này nhưng file chưa tồn tại.
2. **Xung đột route**: `src/app/index.tsx` và `src/app/explore.tsx` (file demo
   của template) vẫn còn, cùng chiếm đường dẫn `/` với
   `(app)/(tabs)/index.tsx`. Phải xoá.
3. **Chưa typecheck, chưa chạy.**
4. Component demo thừa trong `src/components/` (`app-tabs`, `animated-icon`,
   `hint-row`, `web-badge`, `collapsible`, `external-link`) — không còn được
   import, nên dọn.

## File liên quan

- `mobile/src/lib/` — types.ts, directus.ts, api.ts, scoring.ts
- `mobile/src/contexts/auth.tsx`
- `mobile/src/ui/` — theme.ts, components.tsx
- `mobile/src/app/` — _layout.tsx, sign-in.tsx, (app)/
- [mobile/src/components/answer-card.tsx](../../../mobile/src/components/answer-card.tsx)

## Cách kiểm chứng (khi làm tiếp)

```bash
cd mobile && npx tsc --noEmit
```

Sạch lỗi rồi mới `npm start` và quét mã QR bằng app Expo Go.
