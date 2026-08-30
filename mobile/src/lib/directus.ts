/**
 * directus.ts — Khởi tạo Directus client cho app mobile.
 *
 * Ba thứ được ghép vào client:
 *   rest()            -> gọi API qua REST
 *   authentication()  -> tự quản lý access token / refresh token
 *   storage tuỳ biến  -> nơi CẤT token, ở đây là SecureStore của điện thoại
 *
 * Vì sao phải viết storage riêng?
 * Mặc định SDK cất token trong bộ nhớ RAM -> tắt app là mất, lần sau mở lại
 * phải đăng nhập từ đầu. SecureStore lưu vào Keychain (iOS) / Keystore (Android),
 * là vùng được hệ điều hành mã hoá. KHÔNG dùng AsyncStorage cho token —
 * AsyncStorage lưu plaintext, máy đã root/jailbreak là đọc được.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  createDirectus,
  rest,
  authentication,
  type AuthenticationData,
  type AuthenticationStorage,
} from '@directus/sdk';

import type { Schema } from './types';

/* ------------------------------------------------------------------ */

export const DIRECTUS_URL =
  process.env.EXPO_PUBLIC_DIRECTUS_URL ?? 'http://localhost:8055';

const TOKEN_KEY = 'directus_auth';

/**
 * ─── VÌ SAO PHẢI TÁCH THEO NỀN TẢNG ─────────────────────────────────
 *
 * `expo-secure-store` là module NATIVE, không chạy được trên web. Bản web của
 * nó đúng nghĩa là `export default {}` — một object rỗng. Gọi vào sẽ nhận
 * `ExpoSecureStore.default.setValueWithKeyAsync is not a function`.
 *
 * Trên điện thoại (mục tiêu thật của app): dùng SecureStore, tức Keychain của
 * iOS / Keystore của Android — vùng được hệ điều hành mã hoá.
 *
 * Trên web (chỉ để lập trình viên chạy thử nhanh trong trình duyệt):
 * lùi về `localStorage`.
 *
 * ⚠️ `localStorage` KHÔNG an toàn — mọi đoạn JavaScript chạy trên trang đều
 * đọc được, nên một lỗ hổng XSS là lộ token. Chấp nhận được cho môi trường
 * phát triển, KHÔNG được dùng cho bản web phát hành thật. Muốn có bản web
 * dùng thật thì phải chuyển sang cookie `httpOnly` do server đặt.
 */
const isWeb = Platform.OS === 'web';

/** Đọc localStorage an toàn — có thể không tồn tại lúc render phía server. */
function webGet(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function webSet(value: string | null): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (value === null) window.localStorage.removeItem(TOKEN_KEY);
    else window.localStorage.setItem(TOKEN_KEY, value);
  } catch {
    // Trình duyệt chặn lưu trữ (chế độ ẩn danh, chặn cookie...) thì bỏ qua.
    // Người dùng sẽ phải đăng nhập lại mỗi lần tải trang, còn hơn là crash.
  }
}

/**
 * Nơi cất token. Cả hai cơ chế chỉ nhận chuỗi nên phải tự JSON hoá.
 *
 * Lưu ý giới hạn: SecureStore trên Android chỉ chứa được ~2KB mỗi khoá.
 * Token của Directus khoảng vài trăm byte nên thoải mái, nhưng đừng nhét
 * thêm dữ liệu người dùng vào đây.
 */
const secureStorage: AuthenticationStorage = {
  async get() {
    try {
      const raw = isWeb ? webGet() : await SecureStore.getItemAsync(TOKEN_KEY);
      return raw ? (JSON.parse(raw) as AuthenticationData) : null;
    } catch {
      // Đọc hỏng (dữ liệu cũ sai định dạng, đổi khoá mã hoá...) thì coi như
      // chưa đăng nhập, còn hơn để app crash lúc khởi động.
      return null;
    }
  },
  async set(value) {
    const raw = value === null ? null : JSON.stringify(value);

    if (isWeb) {
      webSet(raw);
      return;
    }
    if (raw === null) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, raw);
  },
};

/**
 * Client dùng chung toàn app.
 *
 * `authentication('json', ...)` = token nằm trong body JSON, hợp với mobile.
 * Chế độ 'cookie' chỉ dành cho web cùng domain — trên React Native không có
 * cookie jar của trình duyệt nên sẽ không hoạt động.
 */
export const directus = createDirectus<Schema>(DIRECTUS_URL)
  .with(
    authentication('json', {
      storage: secureStorage,
      // Tự động lấy token mới trước khi hết hạn, người dùng không bị văng ra
      autoRefresh: true,
    }),
  )
  .with(rest());

/* ------------------------------------------------------------------ */
/* Tiện ích                                                            */
/* ------------------------------------------------------------------ */

/**
 * Dựng URL ảnh từ id file của Directus.
 *
 * Directus có sẵn bộ biến đổi ảnh: thêm ?width=&height=&fit= là server tự
 * resize rồi cache lại. Trên mobile nên LUÔN xin ảnh nhỏ — tải ảnh gốc 5MB
 * về để hiển thị cái thumbnail 80px là phí băng thông của người dùng.
 *
 * @param fileId   id file trong directus_files
 * @param token    access token (ảnh cần xác thực mới xem được)
 */
export function fileUrl(
  fileId: string,
  token: string | null,
  opts: { width?: number; height?: number; quality?: number } = {},
): string {
  const params = new URLSearchParams();
  if (opts.width) params.set('width', String(opts.width));
  if (opts.height) params.set('height', String(opts.height));
  params.set('quality', String(opts.quality ?? 75));
  params.set('fit', 'cover');
  if (token) params.set('access_token', token);
  return `${DIRECTUS_URL}/assets/${fileId}?${params.toString()}`;
}

/**
 * Bóc thông điệp lỗi cho người dùng đọc được.
 *
 * Lỗi từ Directus SDK có cấu trúc lồng nhau; ném thẳng ra UI thì người dùng
 * chỉ thấy "[object Object]". Hàm này gom về một câu tiếng Việt tử tế.
 */
export function errorMessage(err: unknown): string {
  if (typeof err === 'string') return err;

  const anyErr = err as {
    errors?: { message?: string; extensions?: { code?: string } }[];
    message?: string;
  };

  const first = anyErr?.errors?.[0];
  if (first?.message) {
    // Vài mã lỗi hay gặp, dịch sang câu người dùng hiểu được
    switch (first.extensions?.code) {
      case 'INVALID_CREDENTIALS':
        return 'Email hoặc mật khẩu không đúng.';
      case 'FORBIDDEN':
        return 'Bạn không có quyền thực hiện việc này.';
      case 'RECORD_NOT_UNIQUE':
        return 'Dữ liệu đã tồn tại.';
      default:
        return first.message;
    }
  }

  if (anyErr?.message) {
    // Lỗi mạng thường là "Network request failed" — nói rõ nguyên nhân hay gặp
    if (/network|fetch/i.test(anyErr.message)) {
      return (
        `Không kết nối được tới máy chủ (${DIRECTUS_URL}).\n\n` +
        `Kiểm tra: điện thoại và máy tính có cùng Wi-Fi không, ` +
        `Directus có đang chạy không, và IP trong file .env có đúng không.`
      );
    }
    return anyErr.message;
  }

  return 'Đã có lỗi xảy ra.';
}
