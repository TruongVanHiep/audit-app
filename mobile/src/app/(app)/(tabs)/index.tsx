/**
 * index.tsx — Tab "Cửa hàng": chọn cửa hàng để bắt đầu audit.
 *
 * Luồng khi bấm vào một cửa hàng:
 *   1. Kiểm tra xem có phiếu nháp nào đang dở của cửa hàng này không
 *      -> có thì mở lại, tránh tạo trùng khi người dùng lỡ thoát app
 *   2. Không có thì xin vị trí GPS rồi tạo phiếu mới
 *   3. Điều hướng sang màn làm checklist
 */

import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';

import { displayName, useAuth } from '@/contexts/auth';
import { createAudit, findDraftAudit, getActiveTemplate, listStores } from '@/lib/api';
import { errorMessage } from '@/lib/directus';
import { REGION_LABEL, type Store } from '@/lib/types';
import {
  Badge, Button, Card, EmptyState, ErrorBox, Field, Loading, Screen, Txt,
} from '@/ui/components';
import { radius, space, useTheme } from '@/ui/theme';

export default function StoresScreen() {
  const t = useTheme();
  const { user, signOut } = useAuth();

  const [stores, setStores] = useState<Store[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    try {
      setError(null);
      setStores(await listStores(q));
    } catch (e) {
      setError(errorMessage(e));
      setStores([]);
    }
  }, []);

  // useFocusEffect chạy lại mỗi lần màn hình được hiện ra — khác useEffect
  // (chỉ chạy 1 lần). Nhờ vậy quay lại từ màn audit là danh sách tự làm mới.
  useFocusEffect(
    useCallback(() => {
      load(search || undefined);
    }, [load, search]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load(search || undefined);
    setRefreshing(false);
  }

  /**
   * Xin quyền vị trí và lấy toạ độ.
   * Không lấy được cũng KHÔNG chặn người dùng làm việc — GPS chỉ là thông tin
   * bổ trợ. Chặn họ audit chỉ vì máy không bắt được GPS là thiết kế tồi.
   */
  async function tryGetLocation(): Promise<{ lat: number | null; lng: number | null }> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return { lat: null, lng: null };
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return { lat: null, lng: null };
    }
  }

  async function handleStartAudit(store: Store) {
    setStartingId(store.id);
    try {
      // 1. Có phiếu dở dang thì mở lại
      const draft = await findDraftAudit(store.id);
      if (draft) {
        router.push(`/audit/${draft.id}`);
        return;
      }

      // 2. Phải có bộ tiêu chí đang dùng mới audit được
      const template = await getActiveTemplate();
      if (!template) {
        Alert.alert(
          'Chưa có bộ tiêu chí',
          'Quản trị viên cần tạo và xuất bản một bộ tiêu chí trước khi bạn có thể audit.',
        );
        return;
      }

      // 3. Tạo phiếu mới kèm vị trí
      const loc = await tryGetLocation();
      const audit = await createAudit({
        storeId: store.id,
        templateId: template.id,
        latitude: loc.lat,
        longitude: loc.lng,
        region: store.region,
      });

      router.push(`/audit/${audit.id}`);
    } catch (e) {
      Alert.alert('Không bắt đầu được', errorMessage(e));
    } finally {
      setStartingId(null);
    }
  }

  function confirmSignOut() {
    Alert.alert('Đăng xuất', 'Bạn chắc chắn muốn đăng xuất?', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen edges={['bottom']}>
      {/* --- Đầu trang: chào người dùng + nút đăng xuất --- */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          gap: space.md,
        }}>
        <View style={{ flex: 1 }}>
          <Txt variant="caption">Xin chào</Txt>
          <Txt variant="heading" numberOfLines={1}>
            {displayName(user)}
          </Txt>
        </View>
        <Button title="Đăng xuất" variant="ghost" onPress={confirmSignOut} />
      </View>

      {/* --- Ô tìm kiếm --- */}
      <View style={{ padding: space.lg, paddingBottom: space.sm }}>
        <Field
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo tên, mã hoặc địa chỉ..."
        />
      </View>

      {/* --- Danh sách --- */}
      {stores === null ? (
        <Loading text="Đang tải danh sách cửa hàng..." />
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingBottom: space.xxl,
            gap: space.md,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={t.primary} />
          }
          ListHeaderComponent={error ? <ErrorBox message={error} onRetry={() => load()} /> : null}
          ListEmptyComponent={
            error ? null : (
              <EmptyState
                icon="🔍"
                title="Không tìm thấy cửa hàng"
                subtitle={
                  search
                    ? 'Thử từ khoá khác xem sao.'
                    : 'Chưa có cửa hàng nào được tạo trong hệ thống.'
                }
              />
            )
          }
          renderItem={({ item }) => (
            <Card>
              <View style={{ gap: space.sm }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: space.sm,
                  }}>
                  <View
                    style={{
                      backgroundColor: t.brandBg,
                      paddingHorizontal: space.sm,
                      paddingVertical: 2,
                      borderRadius: radius.sm,
                    }}>
                    <Txt variant="caption" style={{ color: t.primary, fontWeight: '700' }}>
                      {item.code}
                    </Txt>
                  </View>
                  {item.region ? <Badge text={REGION_LABEL[item.region]} /> : null}
                </View>

                <Txt variant="heading">{item.name}</Txt>

                {item.address ? (
                  <Txt variant="secondary" numberOfLines={2}>
                    📍 {item.address}
                  </Txt>
                ) : null}

                {item.manager_name ? (
                  <Txt variant="caption">Quản lý: {item.manager_name}</Txt>
                ) : null}

                <Button
                  title="Bắt đầu audit"
                  onPress={() => handleStartAudit(item)}
                  loading={startingId === item.id}
                  disabled={startingId !== null && startingId !== item.id}
                  style={{ marginTop: space.xs }}
                />
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
