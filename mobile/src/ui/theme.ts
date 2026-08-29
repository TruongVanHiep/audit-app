/**
 * theme.ts — Bảng màu, khoảng cách, bo góc dùng chung.
 *
 * Vì sao gom hết vào một file thay vì viết màu thẳng trong component?
 * Vì khi cần đổi màu thương hiệu, hoặc thêm chế độ tối, bạn sửa đúng một chỗ.
 * App thật luôn phải hỗ trợ chế độ tối — người dùng đi audit ngoài hiện trường
 * cả ngày, màn hình sáng chói rất mỏi mắt.
 */

import { useColorScheme } from 'react-native';

const palette = {
  /* Màu thương hiệu — xanh dương trầm, đủ tương phản trên cả nền sáng lẫn tối */
  brand: '#2563EB',
  brandDark: '#3B82F6',

  /* Màu ngữ nghĩa */
  success: '#16A34A',
  warning: '#EA580C',
  danger: '#DC2626',
  critical: '#9333EA',
} as const;

export const lightTheme = {
  ...palette,
  primary: palette.brand,
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  /* Nền nhạt cho badge */
  successBg: '#DCFCE7',
  warningBg: '#FFEDD5',
  dangerBg: '#FEE2E2',
  brandBg: '#DBEAFE',
} as const;

export const darkTheme = {
  ...palette,
  primary: palette.brandDark,
  background: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#334155',
  border: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  successBg: '#14532D',
  warningBg: '#7C2D12',
  dangerBg: '#7F1D1D',
  brandBg: '#1E3A8A',
} as const;

/**
 * Kiểu của bảng màu.
 *
 * Phải ánh xạ mọi khoá về `string`, KHÔNG dùng thẳng `typeof lightTheme`.
 * Vì `as const` biến mỗi màu thành kiểu literal (`'#2563EB'` chứ không phải
 * `string`), nên `darkTheme` với màu khác sẽ không gán được vào `Theme`.
 * Cách này giữ nguyên danh sách khoá (thiếu khoá vẫn báo lỗi) nhưng cho phép
 * giá trị khác nhau giữa hai bảng.
 */
export type Theme = { readonly [K in keyof typeof lightTheme]: string };

/** Lấy bảng màu theo chế độ sáng/tối của hệ điều hành. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

/** Khoảng cách theo bậc 4px — dùng số cố định để giao diện đều nhau. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  huge: 34,
} as const;
