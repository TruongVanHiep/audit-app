/**
 * auth.tsx — Quản lý trạng thái đăng nhập cho toàn app.
 *
 * Bọc cả app trong <AuthProvider>, rồi mọi màn hình gọi useAuth() để biết
 * ai đang đăng nhập và đăng xuất khi cần.
 *
 * Điểm hay gặp lỗi ở app thật: lúc app vừa mở, ta chưa biết người dùng đã
 * đăng nhập hay chưa (còn đang đọc token từ SecureStore). Nếu vội điều hướng
 * ngay, app sẽ nháy qua màn đăng nhập rồi mới nhảy vào màn chính — trải nghiệm
 * rất xấu. Vì vậy có cờ `isLoading`: trong lúc đó giữ nguyên splash screen.
 */

import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import { readMe } from '@directus/sdk';

import { directus, errorMessage } from '@/lib/directus';
import type { DirectusUser } from '@/lib/types';

interface AuthState {
  /** null = chưa đăng nhập */
  user: DirectusUser | null;
  /** true khi đang khôi phục phiên lúc mở app */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Lấy access token hiện tại — cần để dựng URL ảnh */
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return value;
}

/** Các field của user mà app cần — xin đúng thứ cần, không xin '*'. */
const USER_FIELDS = ['id', 'email', 'first_name', 'last_name', 'avatar'] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DirectusUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* --- Khôi phục phiên khi mở app --- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // SDK tự đọc token đã lưu trong SecureStore. Nếu token còn hạn (hoặc
        // refresh được), lời gọi này thành công và ta biết là đã đăng nhập.
        const me = (await directus.request(
          readMe({ fields: [...USER_FIELDS] }),
        )) as DirectusUser;
        if (!cancelled) setUser(me);
      } catch {
        // Không có token, token hỏng, hoặc server không với tới được.
        // Coi như chưa đăng nhập — người dùng sẽ thấy màn đăng nhập.
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await directus.login({ email, password });
      const me = (await directus.request(
        readMe({ fields: [...USER_FIELDS] }),
      )) as DirectusUser;
      setUser(me);
    } catch (err) {
      // Ném lại dưới dạng Error có thông điệp tiếng Việt để màn hình hiển thị
      throw new Error(errorMessage(err));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await directus.logout();
    } catch {
      // Server không với tới được thì vẫn phải cho người dùng thoát cục bộ,
      // nếu không họ bị kẹt trong app khi mất mạng.
    } finally {
      setUser(null);
    }
  }, []);

  const getToken = useCallback(async () => {
    try {
      return await directus.getToken();
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, signIn, signOut, getToken }),
    [user, isLoading, signIn, signOut, getToken],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

/** Tên hiển thị gọn của người dùng. */
export function displayName(user: DirectusUser | null): string {
  if (!user) return '';
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return full || user.email;
}
