/**
 * _layout.tsx — Khung ngoài cùng của toàn app.
 *
 * Expo Router lấy CẤU TRÚC THƯ MỤC làm bản đồ điều hướng:
 *
 *   src/app/_layout.tsx        <- file này, bọc mọi thứ
 *   src/app/sign-in.tsx        -> /sign-in
 *   src/app/(app)/(tabs)/index.tsx    -> /  (tab Cửa hàng)
 *   src/app/(app)/(tabs)/history.tsx  -> /history
 *   src/app/(app)/audit/[id].tsx      -> /audit/<id đơn audit>
 *
 * Thư mục đặt trong ngoặc đơn như (app) và (tabs) là "group": chỉ để nhóm
 * file và gắn layout, KHÔNG xuất hiện trong đường dẫn URL.
 *
 * <Stack.Protected guard={...}> là cách bảo vệ route của Expo Router đời mới.
 * Khi guard sai, người dùng bị đưa về nhánh còn lại một cách tự động — không
 * cần tự viết useEffect + router.replace như các bản trước.
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/contexts/auth';

// Giữ splash screen cho tới khi biết chắc người dùng đã đăng nhập hay chưa.
// Nếu bỏ dòng này, app sẽ nháy qua màn đăng nhập rồi mới nhảy vào màn chính.
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  // Chưa biết trạng thái đăng nhập -> chưa vẽ gì, splash vẫn đang che
  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
