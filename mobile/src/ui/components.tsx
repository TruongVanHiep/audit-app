/**
 * components.tsx — Bộ component dùng lại khắp app.
 *
 * Mỗi component ở đây tự lấy màu từ useTheme(), nên màn hình chỉ việc lắp ráp
 * mà không phải bận tâm chuyện sáng/tối.
 */

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { fontSize, radius, space, useTheme, type Theme } from './theme';

/* ------------------------------------------------------------------ */
/* Khung màn hình                                                      */
/* ------------------------------------------------------------------ */

export function Screen({
  children,
  scroll = false,
  edges = ['top', 'bottom'],
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const Inner = scroll ? ScrollView : View;

  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: t.background }]}>
      <Inner
        style={scroll ? undefined : [{ flex: 1 }, style]}
        contentContainerStyle={scroll ? [{ padding: space.lg }, style] : undefined}
        keyboardShouldPersistTaps={scroll ? 'handled' : undefined}>
        {children}
      </Inner>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Chữ                                                                 */
/* ------------------------------------------------------------------ */

type TextVariant = 'title' | 'heading' | 'body' | 'secondary' | 'caption' | 'label';

const textVariantStyle = (t: Theme): Record<TextVariant, TextStyle> => ({
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: t.text },
  heading: { fontSize: fontSize.lg, fontWeight: '600', color: t.text },
  body: { fontSize: fontSize.base, color: t.text, lineHeight: 22 },
  secondary: { fontSize: fontSize.base, color: t.textSecondary, lineHeight: 21 },
  caption: { fontSize: fontSize.xs, color: t.textMuted },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: t.textSecondary },
});

export function Txt({
  variant = 'body',
  style,
  children,
  numberOfLines,
}: {
  variant?: TextVariant;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text style={[textVariantStyle(t)[variant], style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* Thẻ                                                                 */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    padding: space.lg,
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      // opacity giảm khi bấm — phản hồi tức thì cho người dùng biết đã chạm trúng
      style={({ pressed }) => [base, pressed && { opacity: 0.65 }, style]}>
      {children}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Nút                                                                 */
/* ------------------------------------------------------------------ */

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const isDisabled = disabled || loading;

  const bg = {
    primary: t.primary,
    secondary: t.surfaceAlt,
    danger: t.danger,
    ghost: 'transparent',
  }[variant];

  const fg = {
    primary: '#FFFFFF',
    secondary: t.text,
    danger: '#FFFFFF',
    ghost: t.primary,
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: 14,
          paddingHorizontal: space.lg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space.sm,
          // Chiều cao tối thiểu 48px — ngón tay cần vùng chạm đủ lớn,
          // nhất là khi người dùng đang đứng giữa cửa hàng đông người.
          minHeight: 48,
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}>
      {loading && <ActivityIndicator size="small" color={fg} />}
      <Text style={{ color: fg, fontSize: fontSize.base, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Ô nhập                                                              */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  multiline = false,
  editable = true,
  onBlur,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
  editable?: boolean;
  /** Gọi khi người dùng rời ô — dùng để lưu, tránh lưu theo từng ký tự. */
  onBlur?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Txt variant="label">{label}</Txt> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        editable={editable}
        onBlur={onBlur}
        style={{
          backgroundColor: t.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
          borderRadius: radius.md,
          paddingHorizontal: space.md,
          paddingVertical: multiline ? space.md : 13,
          fontSize: fontSize.base,
          color: t.text,
          minHeight: multiline ? 88 : 48,
          textAlignVertical: multiline ? 'top' : 'center',
          opacity: editable ? 1 : 0.6,
        }}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Nhãn trạng thái                                                     */
/* ------------------------------------------------------------------ */

export function Badge({
  text,
  tone = 'neutral',
}: {
  text: string;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
}) {
  const t = useTheme();
  const map = {
    neutral: { bg: t.surfaceAlt, fg: t.textSecondary },
    brand: { bg: t.brandBg, fg: t.primary },
    success: { bg: t.successBg, fg: t.success },
    warning: { bg: t.warningBg, fg: t.warning },
    danger: { bg: t.dangerBg, fg: t.danger },
  }[tone];

  return (
    <View
      style={{
        backgroundColor: map.bg,
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        borderRadius: radius.full,
        alignSelf: 'flex-start',
      }}>
      <Text style={{ color: map.fg, fontSize: fontSize.xs, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Trạng thái rỗng / đang tải / lỗi                                    */
/* ------------------------------------------------------------------ */

export function Loading({ text = 'Đang tải...' }: { text?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <ActivityIndicator size="large" color={t.primary} />
      <Txt variant="secondary">{text}</Txt>
    </View>
  );
}

export function EmptyState({
  icon = '📋',
  title,
  subtitle,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.xxl,
        gap: space.sm,
      }}>
      <Text style={{ fontSize: 44 }}>{icon}</Text>
      <Txt variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {subtitle ? (
        <Txt variant="secondary" style={{ textAlign: 'center' }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.dangerBg,
        borderRadius: radius.md,
        padding: space.md,
        gap: space.sm,
      }}>
      <Text style={{ color: t.danger, fontSize: fontSize.sm, lineHeight: 20 }}>{message}</Text>
      {onRetry ? <Button title="Thử lại" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

/** Đường kẻ ngang mảnh. */
export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border }} />;
}

/** Thanh tiến độ. */
export function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  const t = useTheme();
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View
      style={{
        height: 8,
        backgroundColor: t.surfaceAlt,
        borderRadius: radius.full,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${clamped}%`,
          height: '100%',
          backgroundColor: color ?? t.primary,
          borderRadius: radius.full,
        }}
      />
    </View>
  );
}
