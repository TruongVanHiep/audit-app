/**
 * (app)/_layout.tsx — Khung cho phần đã đăng nhập.
 *
 * Đây là một Stack chứa 2 nhánh:
 *   (tabs)      -> thanh tab dưới cùng (Cửa hàng / Lịch sử)
 *   audit/[id]  -> màn làm checklist, mở đè lên trên, có nút quay lại
 *
 * Vì sao màn audit không nằm trong tabs? Vì khi đang chấm điểm, người dùng
 * cần toàn bộ màn hình và một luồng làm việc tuyến tính. Thanh tab lúc đó
 * chỉ tổ khiến họ bấm nhầm và mất dữ liệu đang nhập.
 */

import { Stack } from 'expo-router';

import { useTheme } from '@/ui/theme';

export default function AppLayout() {
  const t = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.surface },
        headerTintColor: t.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: t.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="audit/[id]"
        options={{
          title: 'Phiếu audit',
          headerBackTitle: 'Quay lại',
        }}
      />
    </Stack>
  );
}
