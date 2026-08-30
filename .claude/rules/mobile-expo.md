---
paths:
  - "mobile/src/**/*.{ts,tsx}"
  - "mobile/app.json"
  - "mobile/.env"
---

# Quy tắc cho mobile app (Expo SDK 57)

## Đọc docs trước khi viết

Expo SDK 57 / React Native 0.86 / React 19 là bản rất mới, API đã đổi so với
kiến thức cũ. Trước khi dùng một API Expo nào, đọc docs đúng phiên bản tại
`https://docs.expo.dev/versions/v57.0.0/` — đây cũng là yêu cầu trong
`mobile/AGENTS.md`.

Vài điểm đã xác nhận cho SDK 57:
- `expo-image-picker`: `mediaTypes` nhận mảng `['images']`, không dùng
  `MediaTypeOptions` (đã deprecated).
- Bảo vệ route dùng `<Stack.Protected guard={...}>`, không tự viết
  `useEffect` + `router.replace` như các bản trước.

## Địa chỉ server

`EXPO_PUBLIC_DIRECTUS_URL` phải là **IP LAN** của máy tính, không bao giờ là
`localhost`. Với điện thoại, `localhost` là chính cái điện thoại đó.

Biến `EXPO_PUBLIC_*` được nhúng thẳng vào bundle nên **ai cũng đọc được** —
không bao giờ để mật khẩu, API key hay secret vào đó.

**Đổi `.env` thôi là CHƯA ĐỦ.** `EXPO_PUBLIC_*` được nhúng vào bundle lúc
biên dịch, nên Metro đang chạy vẫn phát ra giá trị cũ. Phải tắt hẳn rồi chạy
lại `npx expo start --clear`.

Đã dính lỗi này ngày 2026-08-29: IP Wi-Fi đổi từ `172.19.200.63` sang
`192.168.1.87`, app báo không đăng nhập được. Cách kiểm chứng nhanh xem bundle
đang mang IP nào:

```bash
curl -s "http://localhost:8081/.expo/.virtual-metro-entry.bundle?platform=web&dev=true" | grep -c "<IP muốn tìm>"
```

## Kiến trúc

- Màn hình (`src/app/`) chỉ lo hiển thị. Mọi lời gọi Directus nằm trong
  `src/lib/api.ts`.
- Logic nghiệp vụ (tính điểm) là **hàm thuần** trong `src/lib/scoring.ts` —
  không đụng mạng, không đụng state, để test được bằng Node thuần.
- Không tự lọc dữ liệu theo người dùng ở phía app. Quyền trong Directus đã lo
  việc đó; lọc ở app chỉ là trang trí và sẽ quên.

## Giao diện cho người dùng hiện trường

- Vùng chạm tối thiểu **48px**. Auditor đứng giữa cửa hàng, một tay cầm máy.
- Nén ảnh trước khi gửi (`quality: 0.6`) — họ thường dùng 4G.
- Xin ảnh đã resize từ Directus (`?width=`), đừng tải ảnh gốc về làm thumbnail.
- Mất GPS hay từ chối quyền vị trí **không được** chặn họ làm việc.

## Token

Lưu token bằng `expo-secure-store` (Keychain/Keystore), **không** dùng
`AsyncStorage` — AsyncStorage lưu plaintext.
