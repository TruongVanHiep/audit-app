/**
 * history.tsx — Tab "Lịch sử": các phiếu audit của chính mình.
 *
 * Lưu ý: ta KHÔNG gửi bộ lọc "auditor = tôi" lên server. Không cần — quyền
 * đã cấu hình sẵn trong Directus khiến API chỉ trả về phiếu của người đang
 * đăng nhập. Đó là điểm mạnh của việc lọc ở tầng quyền thay vì tầng app:
 * quên lọc ở app cũng không rò rỉ dữ liệu người khác.
 */

import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { listMyAudits, myAuditStats } from '@/lib/api';
import { errorMessage } from '@/lib/directus';
import { AUDIT_STATUS_LABEL, type Audit, type Store } from '@/lib/types';
import { scoreColor } from '@/lib/scoring';
import {
  Badge, Card, EmptyState, ErrorBox, Loading, ProgressBar, Screen, Txt,
} from '@/ui/components';
import { fontSize, radius, space, useTheme } from '@/ui/theme';

/** Đổi chuỗi ISO thành "28/08/2026 14:30". */
function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_TONE = {
  draft: 'warning',
  submitted: 'brand',
  reviewed: 'success',
  cancelled: 'neutral',
} as const;

export default function HistoryScreen() {
  const t = useTheme();

  const [audits, setAudits] = useState<Audit[] | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof myAuditStats>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      // Gọi song song — không có lý do gì để chờ cái này xong mới gọi cái kia
      const [rows, s] = await Promise.all([listMyAudits(), myAuditStats()]);
      setAudits(rows);
      setStats(s);
    } catch (e) {
      setError(errorMessage(e));
      setAudits([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (audits === null) return <Screen><Loading text="Đang tải lịch sử..." /></Screen>;

  return (
    <Screen edges={['bottom']}>
      <FlatList
        data={audits}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: space.xxl,
          gap: space.md,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={t.primary} />
        }
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            {error ? <ErrorBox message={error} onRetry={load} /> : null}

            {/* --- Ba ô thống kê --- */}
            {stats ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <StatBox label="Tổng phiếu" value={String(stats.total)} />
                <StatBox label="Đang làm" value={String(stats.drafts)} />
                <StatBox
                  label="Điểm TB"
                  value={stats.avgPercent === null ? '—' : `${Math.round(stats.avgPercent)}%`}
                  color={stats.avgPercent === null ? undefined : scoreColor(stats.avgPercent)}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          error ? null : (
            <EmptyState
              icon="📝"
              title="Chưa có phiếu audit nào"
              subtitle="Sang tab Cửa hàng để bắt đầu phiếu đầu tiên."
            />
          )
        }
        renderItem={({ item }) => {
          const store = item.store as Store;
          const percent = item.score_percent;

          return (
            <Card onPress={() => router.push(`/audit/${item.id}`)}>
              <View style={{ gap: space.sm }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: space.sm,
                  }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="heading" numberOfLines={1}>
                      {store?.name ?? 'Cửa hàng'}
                    </Txt>
                    <Txt variant="caption">
                      {store?.code} · {formatDateTime(item.date_started)}
                    </Txt>
                  </View>
                  <Badge
                    text={AUDIT_STATUS_LABEL[item.status]}
                    tone={STATUS_TONE[item.status]}
                  />
                </View>

                {/* Phiếu đã nộp thì khoe điểm; phiếu nháp thì nhắc làm tiếp */}
                {item.status !== 'draft' && percent !== null ? (
                  <View style={{ gap: space.xs }}>
                    <View
                      style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Txt variant="caption">Kết quả</Txt>
                      <Txt
                        style={{
                          fontSize: fontSize.base,
                          fontWeight: '700',
                          color: scoreColor(percent),
                        }}>
                        {percent}%
                      </Txt>
                    </View>
                    <ProgressBar percent={percent} color={scoreColor(percent)} />
                  </View>
                ) : (
                  <Txt variant="secondary">Chạm để tiếp tục làm →</Txt>
                )}
              </View>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.surface,
        borderRadius: radius.md,
        padding: space.md,
        gap: 2,
        alignItems: 'center',
      }}>
      <Txt style={{ fontSize: fontSize.xl, fontWeight: '700', color: color ?? t.text }}>
        {value}
      </Txt>
      <Txt variant="caption">{label}</Txt>
    </View>
  );
}
