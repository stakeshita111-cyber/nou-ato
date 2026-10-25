'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import Toast from '@/components/ui/Toast';

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
    confirmPassword: z.string().min(1, '確認用パスワードを入力してください'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    let active = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const checkRecoverySession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session && active) {
          setHasValidSession(true);
          setCheckingSession(false);
          return;
        }

        // リカバリーURLからの遷移直後でハッシュ解析中の場合、onAuthStateChange で確立を待機
        const { data: authListener } = supabase.auth.onAuthStateChange((event, s) => {
          if (!active) return;
          if (event === 'PASSWORD_RECOVERY' || (s && event === 'SIGNED_IN')) {
            if (timeoutId) clearTimeout(timeoutId);
            setHasValidSession(true);
            setCheckingSession(false);
          }
        });

        // 5秒経過してもセッションが確立されない場合は期限切れとして扱う
        timeoutId = setTimeout(() => {
          if (active) {
            setCheckingSession(false);
          }
        }, 5000);

        return () => {
          if (timeoutId) clearTimeout(timeoutId);
          authListener.subscription.unsubscribe();
        };
      } catch (e) {
        console.warn('Recovery session check warn:', e);
        if (active) {
          setCheckingSession(false);
        }
      }
    };

    const cleanupPromise = checkRecoverySession();
    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
      cleanupPromise
        .then((cleanup) => {
          if (cleanup) cleanup();
        })
        .catch((e: unknown) => {
          console.warn('Cleanup error in checkRecoverySession:', e);
        });
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || '入力内容をご確認ください';
      setToastMessage(firstError);
      setShowToast(true);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: validation.data.password,
      });

      if (error) {
        setToastMessage(`更新エラー: ${error.message}`);
        setShowToast(true);
      } else {
        setToastMessage('🎉 パスワードを更新しました！ログイン画面へ移動します');
        setShowToast(true);
        setTimeout(() => {
          router.push('/login');
        }, 1200);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setToastMessage(`エラーが発生しました: ${message}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl border border-gray-200/90 p-8 text-center space-y-4 animate-fade-in">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1c4d21] text-white font-black text-xl shadow-md animate-pulse">
          🌱
        </div>
        <p className="text-xs text-gray-500 font-bold">認証セッションを確認しています...</p>
      </div>
    );
  }

  if (!hasValidSession) {
    return (
      <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl border border-gray-200/90 p-8 text-center space-y-5 animate-fade-in">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 font-black text-xl shadow-xs">
          ⚠️
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-black text-gray-900">リンクが無効または期限切れです</h2>
          <p className="text-xs text-gray-500 font-medium leading-relaxed">
            パスワード再設定用のURLが無効になっているか、有効期限が切れています。お手数ですが、再度リセットリンクをリクエストしてください。
          </p>
        </div>
        <div className="pt-2 space-y-2">
          <Link
            href="/forgot-password"
            className="block w-full py-3 bg-[#1c4d21] hover:bg-[#153b19] text-white font-bold rounded-2xl text-xs shadow-md transition cursor-pointer"
          >
            パスワード再設定をやり直す
          </Link>
          <Link
            href="/login"
            className="block text-xs text-gray-500 hover:text-gray-700 font-bold hover:underline py-1"
          >
            ← ログイン画面に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl border border-gray-200/90 p-8 space-y-6 animate-fade-in">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-black text-[#1c4d21] tracking-tight">NOU-ATO</h1>
        <p className="text-xs text-gray-500 font-bold">新しいパスワードの設定</p>
      </div>

      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-gray-600 mb-1">新しいパスワード</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上の半角英数字"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition pr-11 placeholder-gray-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 text-sm font-bold"
              title={showPassword ? 'パスワードを非表示' : 'パスワードを表示'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-600 mb-1">
            新しいパスワード（確認用）
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="もう一度入力してください"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition placeholder-gray-400"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-[#16471a] hover:bg-[#123915] text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 text-sm cursor-pointer disabled:opacity-50 mt-2"
        >
          <span>{loading ? '更新中...' : 'パスワードを更新する'}</span>
        </button>
      </form>

      <div className="pt-2 text-center text-xs text-gray-500">
        <Link href="/login" className="text-[#1c4d21] font-bold hover:underline">
          ← ログイン画面に戻る
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 font-sans text-gray-800">
      <Suspense fallback={<div className="text-sm text-gray-500 font-bold">読み込み中...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
