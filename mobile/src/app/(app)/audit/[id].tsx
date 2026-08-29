/**
 * audit/[id].tsx — Màn hình làm phiếu audit.
 *
 * Đây là màn hình auditor dùng lâu nhất, giữa cửa hàng, có khi mất sóng.
 * Ba quyết định thiết kế xuất phát từ đó:
 *
 * 1. **Lưu từng câu trả lời ngay khi trả lời**, không đợi bấm "Lưu". Auditor
 *    thoát app giữa chừng hay hết pin thì phần đã làm vẫn còn.
 * 2. **Lưu lạc quan**: cập nhật giao diện trước, gọi API sau. Người dùng không
 *    phải chờ vòng quay mỗi lần chạm.
 * 3. **Lỗi lưu không chặn thao tác tiếp theo**, chỉ hiện dấu hiệu trên đúng
 *    tiêu chí đó. Mất mạng vẫn làm tiếp được, nộp bài mới cần mạng.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import type { ImagePickerAsset } from 'expo-image-picker';

import { AnswerCard, type AnswerState } from '@/components/answer-card';
import { useAuth } from '@/contexts/auth';
import {
  getAudit, listAnswers, listTemplateItems,
  saveAnswer, submitAudit, updateAuditNote, uploadPhoto,
} from '@/lib/api';
import { errorMessage } from '@/lib/directus';
import {
  computeAuditScore, scoreColor, validateForSubmit, weightedScore,
} from '@/lib/scoring';
import type { Audit, Store, Template, TemplateItem } from '@/lib/types';
import {
  Button, Card, ErrorBox, Field, Loading, ProgressBar, Screen, Txt,
} from '@/ui/components';
import { fontSize, radius, space, useTheme } from '@/ui/theme';

type AnswerMap = Record<string, AnswerState>;

export default function AuditScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();

  const [audit, setAudit] = useState<Audit | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [token, setToken] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Giữ bản mới nhất của answers cho các hàm bất đồng bộ đọc, tránh bắt phải
  // giá trị cũ trong closure khi người dùng chạm nhanh liên tiếp.
  const answersRef = useRef<AnswerMap>({});
  answersRef.current = answers;

  const readOnly = audit !== null && audit.status !== 'draft';

  /* ---------------- Nạp dữ liệu ---------------- */

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoadError(null);

      const a = await getAudit(id);
      const templateId = typeof a.template === 'string' ? a.template : a.template.id;

      // Gọi song song, không có lý do chờ tuần tự
      const [its, existing, tk] = await Promise.all([
        listTemplateItems(templateId),
        listAnswers(id),
        getToken(),
      ]);

      const map: AnswerMap = {};
      for (const ans of existing) {
        const itemId = typeof ans.item === 'string' ? ans.item : ans.item.id;
        map[itemId] = {
          answerId: ans.id,
          value: ans.value,
          note: ans.note,
          photoIds: (ans.photos ?? []).map((p) => p.directus_files_id),
        };
      }

      setAudit(a);
      setItems(its);
      setAnswers(map);
      setNote(a.note ?? '');
      setToken(tk);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [id, getToken]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------- Lưu một câu trả lời ---------------- */

  /**
   * Cập nhật state ngay rồi mới gọi API (lưu lạc quan).
   * `patch` là phần thay đổi; phần còn lại giữ nguyên.
   */
  const persist = useCallback(
    async (item: TemplateItem, patch: Partial<AnswerState>) => {
      const prev = answersRef.current[item.id] ?? {
        value: null, note: null, photoIds: [],
      };
      const next: AnswerState = { ...prev, ...patch, saving: true, error: null };

      setAnswers((s) => ({ ...s, [item.id]: next }));

      try {
        const saved = await saveAnswer({
          answerId: next.answerId ?? null,
          auditId: id!,
          itemId: item.id,
          value: next.value,
          score: weightedScore(item, next.value),
          note: next.note,
          photoIds: next.photoIds,
        });

        setAnswers((s) => ({
          ...s,
          [item.id]: { ...s[item.id], answerId: saved.id, saving: false, error: null },
        }));
      } catch (e) {
        setAnswers((s) => ({
          ...s,
          [item.id]: { ...s[item.id], saving: false, error: errorMessage(e) },
        }));
      }
    },
    [id],
  );

  /* ---------------- Ảnh ---------------- */

  const addPhoto = useCallback(
    async (item: TemplateItem, asset: ImagePickerAsset) => {
      setAnswers((s) => ({
        ...s,
        [item.id]: { ...(s[item.id] ?? { value: null, note: null, photoIds: [] }), saving: true },
      }));
      try {
        const fileId = await uploadPhoto({
          uri: asset.uri,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
        });
        const cur = answersRef.current[item.id] ?? { value: null, note: null, photoIds: [] };
        await persist(item, { photoIds: [...cur.photoIds, fileId] });
      } catch (e) {
        setAnswers((s) => ({
          ...s,
          [item.id]: { ...s[item.id], saving: false, error: errorMessage(e) },
        }));
      }
    },
    [persist],
  );

  const removePhoto = useCallback(
    (item: TemplateItem, fileId: string) => {
      const cur = answersRef.current[item.id];
      if (!cur) return;
      void persist(item, { photoIds: cur.photoIds.filter((f) => f !== fileId) });
    },
    [persist],
  );

  /* ---------------- Tính điểm ---------------- */

  const valueMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(answers)) m[k] = v.value;
    return m;
  }, [answers]);

  const photoCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [k, v] of Object.entries(answers)) m[k] = v.photoIds.length;
    return m;
  }, [answers]);

  const score = useMemo(
    () => computeAuditScore(items, valueMap),
    [items, valueMap],
  );

  /* ---------------- Nộp bài ---------------- */

  async function handleSubmit() {
    const problems = validateForSubmit(items, valueMap, photoCounts);

    if (problems.length > 0) {
      Alert.alert('Chưa nộp được', problems.map((p) => `• ${p}`).join('\n'));
      return;
    }

    const canhBao = score.hasCriticalFailure
      ? `\n\n⚠️ Có ${score.criticalFailures.length} tiêu chí TRỌNG YẾU bị trượt — phiếu này sẽ bị đánh trượt bất kể tổng điểm.`
      : '';

    Alert.alert(
      'Nộp phiếu audit',
      `Điểm: ${score.score}/${score.totalMaxScore} (${score.percent}%)` +
        `\nKết luận: ${score.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}` +
        canhBao +
        '\n\nNộp rồi sẽ KHÔNG sửa được nữa. Tiếp tục?',
      [
        { text: 'Xem lại', style: 'cancel' },
        { text: 'Nộp', style: 'destructive', onPress: () => void doSubmit() },
      ],
    );
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      // Lưu ghi chú chung trước, vì sau khi chuyển sang submitted là khoá
      if (note !== (audit?.note ?? '')) {
        await updateAuditNote(id!, note);
      }
      await submitAudit(id!, {
        score: score.score,
        maxScore: score.totalMaxScore,
        percent: score.percent,
      });
      Alert.alert('Đã nộp', 'Phiếu audit đã được gửi lên hệ thống.', [
        { text: 'Xong', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Nộp thất bại', errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- Render ---------------- */

  if (loadError) {
    return (
      <Screen scroll>
        <ErrorBox message={loadError} onRetry={load} />
      </Screen>
    );
  }

  if (!audit) return <Screen><Loading text="Đang tải phiếu audit..." /></Screen>;

  const store = audit.store as Store;
  const template = audit.template as Template;

  // Gom tiêu chí theo nhóm, giữ nguyên thứ tự `sort` từ server
  const sections: { name: string; items: TemplateItem[] }[] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last && last.name === item.section) last.items.push(item);
    else sections.push({ name: item.section, items: [item] });
  }

  const progress = items.length === 0 ? 0 : (score.answered / items.length) * 100;

  return (
    <>
      <Stack.Screen options={{ title: store?.code ?? 'Phiếu audit' }} />

      <Screen edges={['bottom']}>
        <ScrollView
          contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.md }}
          keyboardShouldPersistTaps="handled">

          {/* --- Đầu phiếu: cửa hàng + tiến độ + điểm --- */}
          <Card>
            <View style={{ gap: space.md }}>
              <View>
                <Txt variant="heading">{store?.name}</Txt>
                <Txt variant="caption">
                  {store?.code} · {template?.name} v{template?.version}
                </Txt>
              </View>

              <View style={{ gap: space.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt variant="label">Tiến độ</Txt>
                  <Txt variant="label">
                    {score.answered}/{items.length} tiêu chí
                  </Txt>
                </View>
                <ProgressBar percent={progress} />
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: t.surfaceAlt,
                  padding: space.md,
                  borderRadius: radius.md,
                }}>
                <View>
                  <Txt variant="caption">Điểm hiện tại</Txt>
                  <Txt
                    style={{
                      fontSize: fontSize.xxl,
                      fontWeight: '700',
                      color: scoreColor(score.percent),
                    }}>
                    {score.percent}%
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt variant="caption">
                    {score.score}/{score.totalMaxScore} điểm
                  </Txt>
                  {score.hasCriticalFailure ? (
                    <Txt variant="caption" style={{ color: t.critical, fontWeight: '700' }}>
                      ⚠️ Trượt {score.criticalFailures.length} tiêu chí trọng yếu
                    </Txt>
                  ) : null}
                </View>
              </View>

              {readOnly ? (
                <View
                  style={{
                    backgroundColor: t.brandBg,
                    padding: space.sm,
                    borderRadius: radius.sm,
                  }}>
                  <Txt variant="caption" style={{ color: t.primary }}>
                    Phiếu đã nộp — chỉ xem, không sửa được.
                  </Txt>
                </View>
              ) : null}
            </View>
          </Card>

          {/* --- Từng nhóm tiêu chí --- */}
          {sections.map((sec) => (
            <View key={sec.name} style={{ gap: space.md, marginTop: space.sm }}>
              <Txt variant="heading" style={{ color: t.textSecondary }}>
                {sec.name}
              </Txt>

              {sec.items.map((item) => (
                <AnswerCard
                  key={item.id}
                  item={item}
                  state={answers[item.id] ?? { value: null, note: null, photoIds: [] }}
                  token={token}
                  readOnly={readOnly}
                  onChangeValue={(v) => void persist(item, { value: v })}
                  onChangeNote={(n) =>
                    setAnswers((s) => ({
                      ...s,
                      [item.id]: {
                        ...(s[item.id] ?? { value: null, photoIds: [] }),
                        note: n,
                      } as AnswerState,
                    }))
                  }
                  onCommitNote={() => void persist(item, {})}
                  onAddPhoto={(asset) => void addPhoto(item, asset)}
                  onRemovePhoto={(fileId) => removePhoto(item, fileId)}
                />
              ))}
            </View>
          ))}

          {/* --- Nhận xét chung --- */}
          <Card style={{ marginTop: space.sm }}>
            <Field
              label="Nhận xét chung"
              value={note}
              onChangeText={setNote}
              onBlur={() => {
                if (!readOnly && note !== (audit.note ?? '')) {
                  void updateAuditNote(id!, note).catch(() => {});
                }
              }}
              placeholder="Ghi chú tổng thể về ca kiểm tra này..."
              multiline
              editable={!readOnly}
              autoCapitalize="sentences"
            />
          </Card>

          {/* --- Nộp --- */}
          {!readOnly ? (
            <Button
              title={`Nộp phiếu (${score.answered}/${items.length})`}
              onPress={handleSubmit}
              loading={submitting}
              disabled={items.length === 0}
              style={{ marginTop: space.md }}
            />
          ) : null}
        </ScrollView>
      </Screen>
    </>
  );
}
