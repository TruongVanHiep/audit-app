/**
 * answer-card.tsx — Một tiêu chí trong phiếu audit.
 *
 * Component này lo phần khó nhất của app: cho người dùng trả lời NHANH và
 * KHÔNG BẤM NHẦM, trong lúc họ đang đứng giữa cửa hàng, một tay cầm điện thoại.
 *
 * Nguyên tắc thiết kế áp dụng ở đây:
 *  - Vùng chạm to (tối thiểu 48px). Nút nhỏ là kẻ thù của người dùng hiện trường.
 *  - Trạng thái đã chọn phải nhìn phát biết ngay, không cần đọc.
 *  - Tiêu chí trọng yếu và tiêu chí bắt buộc ảnh phải nổi bật.
 *  - Đang lưu thì báo cho người dùng biết, đừng để họ đoán.
 */

import { memo } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { fileUrl } from '@/lib/directus';
import { rawPoints } from '@/lib/scoring';
import type { TemplateItem } from '@/lib/types';
import { Badge, Card, Field, Txt } from '@/ui/components';
import { fontSize, radius, space, useTheme } from '@/ui/theme';

export interface AnswerState {
  answerId?: string;
  value: string | null;
  note: string | null;
  photoIds: string[];
  saving?: boolean;
  error?: string | null;
}

interface Props {
  item: TemplateItem;
  state: AnswerState;
  token: string | null;
  readOnly: boolean;
  onChangeValue: (value: string | null) => void;
  onChangeNote: (note: string) => void;
  onCommitNote: () => void;
  onAddPhoto: (asset: ImagePicker.ImagePickerAsset) => void;
  onRemovePhoto: (fileId: string) => void;
}

function AnswerCardInner({
  item, state, token, readOnly,
  onChangeValue, onChangeNote, onCommitNote, onAddPhoto, onRemovePhoto,
}: Props) {
  const t = useTheme();

  const answered = state.value !== null && state.value !== '';
  const points = rawPoints(item.answer_type, state.value);
  const failedCritical = item.is_critical && points !== null && points <= 2;
  const needsPhoto = item.requires_photo && state.photoIds.length === 0;

  /* ---------------- chọn ảnh ---------------- */

  async function pickPhoto() {
    Alert.alert('Thêm ảnh', 'Chọn nguồn ảnh', [
      { text: 'Huỷ', style: 'cancel' },
      { text: '📷 Chụp ảnh', onPress: () => void launch('camera') },
      { text: '🖼️ Chọn từ thư viện', onPress: () => void launch('library') },
    ]);
  }

  async function launch(source: 'camera' | 'library') {
    try {
      // Xin quyền đúng loại. Hỏi quyền camera khi người dùng chỉ muốn mở thư
      // viện là cách nhanh nhất để họ bấm "Từ chối" và không quay lại nữa.
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm.granted) {
        Alert.alert(
          'Chưa được cấp quyền',
          source === 'camera'
            ? 'Hãy bật quyền Camera cho ứng dụng trong phần Cài đặt của điện thoại.'
            : 'Hãy bật quyền Thư viện ảnh cho ứng dụng trong phần Cài đặt.',
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        // Nén xuống 0.6: ảnh bằng chứng audit không cần chất lượng in ấn,
        // mà người dùng thường đang xài 4G. Ảnh 5MB gửi 20 tấm là hết data.
        quality: 0.6,
        exif: false,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets?.length) return;
      onAddPhoto(result.assets[0]);
    } catch (e) {
      Alert.alert('Không mở được', e instanceof Error ? e.message : 'Lỗi không rõ');
    }
  }

  function confirmRemove(fileId: string) {
    Alert.alert('Xoá ảnh', 'Gỡ ảnh này khỏi tiêu chí?', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => onRemovePhoto(fileId) },
    ]);
  }

  /* ---------------- render ---------------- */

  return (
    <Card
      style={{
        // Viền trái đổi màu theo trạng thái — quét mắt là biết còn thiếu gì
        borderLeftWidth: 4,
        borderLeftColor: failedCritical
          ? t.critical
          : answered
            ? t.success
            : item.is_critical
              ? t.warning
              : t.border,
      }}>
      <View style={{ gap: space.md }}>
        {/* --- nhãn --- */}
        {(item.is_critical || item.requires_photo || item.weight > 1) && (
          <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
            {item.is_critical && <Badge text="⚠️ Trọng yếu" tone="danger" />}
            {item.requires_photo && (
              <Badge text="📷 Bắt buộc ảnh" tone={needsPhoto ? 'warning' : 'success'} />
            )}
            {item.weight > 1 && <Badge text={`Hệ số ${item.weight}`} />}
          </View>
        )}

        {/* --- câu hỏi --- */}
        <Txt variant="body" style={{ fontWeight: '600' }}>
          {item.question}
        </Txt>

        {item.guidance ? (
          <View
            style={{
              backgroundColor: t.surfaceAlt,
              padding: space.sm,
              borderRadius: radius.sm,
            }}>
            <Txt variant="caption" style={{ lineHeight: 18 }}>
              💡 {item.guidance}
            </Txt>
          </View>
        ) : null}

        {/* --- ô trả lời --- */}
        <AnswerControl
          item={item}
          value={state.value}
          readOnly={readOnly}
          onChange={onChangeValue}
        />

        {/* --- ảnh --- */}
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt variant="label">
              Ảnh {state.photoIds.length > 0 ? `(${state.photoIds.length})` : ''}
            </Txt>
            {needsPhoto && !readOnly ? (
              <Txt variant="caption" style={{ color: t.warning }}>
                Tiêu chí này bắt buộc có ảnh
              </Txt>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {state.photoIds.map((fileId) => (
                <Pressable
                  key={fileId}
                  onPress={() => (readOnly ? undefined : confirmRemove(fileId))}
                  style={{ position: 'relative' }}>
                  <Image
                    source={{ uri: fileUrl(fileId, token, { width: 160, height: 160 }) }}
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: radius.md,
                      backgroundColor: t.surfaceAlt,
                    }}
                  />
                  {!readOnly && (
                    <View
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        backgroundColor: t.danger,
                        width: 22,
                        height: 22,
                        borderRadius: radius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Txt style={{ color: '#fff', fontSize: 13, lineHeight: 16 }}>×</Txt>
                    </View>
                  )}
                </Pressable>
              ))}

              {!readOnly && (
                <Pressable
                  onPress={pickPhoto}
                  style={({ pressed }) => ({
                    width: 76,
                    height: 76,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: needsPhoto ? t.warning : t.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.6 : 1,
                  })}>
                  <Txt style={{ fontSize: 22 }}>📷</Txt>
                  <Txt variant="caption">Thêm</Txt>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>

        {/* --- ghi chú --- */}
        <Field
          label="Ghi chú"
          value={state.note ?? ''}
          onChangeText={onChangeNote}
          // Lưu khi rời ô, không lưu theo từng ký tự — tránh spam server
          onBlur={onCommitNote}
          placeholder="Mô tả thêm nếu cần..."
          multiline
          editable={!readOnly}
          autoCapitalize="sentences"
        />

        {/* --- trạng thái lưu --- */}
        {state.saving ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <ActivityIndicator size="small" color={t.textMuted} />
            <Txt variant="caption">Đang lưu...</Txt>
          </View>
        ) : state.error ? (
          <Txt variant="caption" style={{ color: t.danger }}>
            ⚠️ {state.error}
          </Txt>
        ) : null}
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Ô trả lời — hình dạng phụ thuộc answer_type                         */
/* ------------------------------------------------------------------ */

function AnswerControl({
  item, value, readOnly, onChange,
}: {
  item: TemplateItem;
  value: string | null;
  readOnly: boolean;
  onChange: (v: string | null) => void;
}) {
  const t = useTheme();

  switch (item.answer_type) {
    /* --- Đạt / Không đạt --- */
    case 'pass_fail':
      return (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {(
            [
              { key: 'pass', label: '✓ Đạt', color: t.success, bg: t.successBg },
              { key: 'fail', label: '✕ Không đạt', color: t.danger, bg: t.dangerBg },
            ] as const
          ).map((opt) => {
            const selected = value === opt.key;
            return (
              <Pressable
                key={opt.key}
                disabled={readOnly}
                // Bấm lại lựa chọn đang chọn = bỏ chọn. Người dùng bấm nhầm
                // cần có đường lùi mà không phải xoá cả phiếu.
                onPress={() => onChange(selected ? null : opt.key)}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.md,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? opt.color : t.border,
                  backgroundColor: selected ? opt.bg : t.surface,
                  opacity: readOnly ? 0.6 : pressed ? 0.7 : 1,
                })}>
                <Txt
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: selected ? '700' : '500',
                    color: selected ? opt.color : t.textSecondary,
                  }}>
                  {opt.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      );

    /* --- Chấm 1..5 --- */
    case 'score_5':
      return (
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const selected = Number(value) === n;
            // Càng cao càng xanh, càng thấp càng đỏ
            const color = n >= 4 ? t.success : n === 3 ? t.warning : t.danger;
            return (
              <Pressable
                key={n}
                disabled={readOnly}
                onPress={() => onChange(selected ? null : String(n))}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.md,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? color : t.border,
                  backgroundColor: selected ? color : t.surface,
                  opacity: readOnly ? 0.6 : pressed ? 0.7 : 1,
                })}>
                <Txt
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: '700',
                    color: selected ? '#FFFFFF' : t.textSecondary,
                  }}>
                  {n}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      );

    /* --- Nhập số --- */
    case 'number':
      return (
        <Field
          value={value ?? ''}
          onChangeText={(v) => onChange(v.replace(/[^0-9.]/g, '') || null)}
          placeholder="Nhập số..."
          keyboardType="decimal-pad"
          editable={!readOnly}
        />
      );

    /* --- Nhập chữ --- */
    case 'text':
      return (
        <Field
          value={value ?? ''}
          onChangeText={(v) => onChange(v || null)}
          placeholder="Nhập nội dung..."
          multiline
          editable={!readOnly}
          autoCapitalize="sentences"
        />
      );
  }
}

// memo: danh sách có 18 thẻ, gõ ghi chú ở thẻ này không nên vẽ lại 17 thẻ kia.
export const AnswerCard = memo(AnswerCardInner);
