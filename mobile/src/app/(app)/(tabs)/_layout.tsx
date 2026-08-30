/**
 * (tabs)/_layout.tsx — Thanh tab dưới màn hình.
 *
 * Dùng emoji làm icon để không phải kéo thêm thư viện icon nào. Với app thật
 * bạn nên dùng bộ icon vector (@expo/vector-icons) cho sắc nét và đồng bộ;
 * emoji hiển thị khác nhau giữa iOS và Android.
 */

import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { useTheme } from '@/ui/theme';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const t = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.surface },
        headerTintColor: t.text,
        headerTitleStyle: { fontWeight: '600' },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Cửa hàng',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏪" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Lịch sử',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
