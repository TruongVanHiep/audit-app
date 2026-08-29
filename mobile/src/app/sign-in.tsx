/**
 * sign-in.tsx — Màn hình đăng nhập.
 *
 * Điểm cần chú ý: KHÔNG tự lưu email/mật khẩu ở đâu cả. Ta gửi lên Directus,
 * nhận token, và SDK cất token vào SecureStore. Mật khẩu không bao giờ được
 * ghi xuống đĩa của điện thoại.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { useAuth } from '@/contexts/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { Button, ErrorBox, Field, Screen, Txt } from '@/ui/components';
import { space, useTheme } from '@/ui/theme';

export default function SignInScreen() {
  const t = useTheme();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('auditor@example.com');
  const [password, setPassword] = useState('Auditor123!');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError('Vui lòng nhập đủ email và mật khẩu.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // Không cần điều hướng thủ công — Stack.Protected ở _layout tự chuyển
      // sang nhánh (app) ngay khi `user` khác null.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đăng nhập thất bại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        // iOS đẩy nội dung lên khi bàn phím hiện; Android tự xử lý sẵn
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', padding: space.xl, gap: space.xl }}>
        <View style={{ gap: space.sm }}>
          <Txt style={{ fontSize: 52 }}>🏪</Txt>
          <Txt variant="title">Audit Cửa hàng</Txt>
          <Txt variant="secondary">
            Đăng nhập để bắt đầu ca kiểm tra của bạn.
          </Txt>
        </View>

        <View style={{ gap: space.md }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="ten@congty.com"
            keyboardType="email-address"
          />
          <Field
            label="Mật khẩu"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
        </View>

        {error ? <ErrorBox message={error} /> : null}

        <Button title="Đăng nhập" onPress={handleSignIn} loading={busy} />

        {/* Hiện địa chỉ server để lúc cấu hình sai còn biết đường mà sửa.
            App thật KHÔNG nên hiện dòng này cho người dùng cuối. */}
        <Txt variant="caption" style={{ textAlign: 'center', color: t.textMuted }}>
          Máy chủ: {DIRECTUS_URL}
        </Txt>
      </KeyboardAvoidingView>
    </Screen>
  );
}
