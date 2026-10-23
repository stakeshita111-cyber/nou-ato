'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import Toast from '@/components/ui/Toast';
import Link from 'next/link';
import {
  EMAIL_CONFIRMATION_SENT_MESSAGE,
  buildPendingTeacherSignupMetadata,
  completePendingTeacherSignup,
} from '@/lib/auth/pendingTeacherSignup';
import { EMAIL_RATE_LIMIT_MESSAGE, isEmailRateLimitError } from '@/lib/auth/signUpErrors';

export const teacherSignUpSchema = z.object({
  farmName: z.string().trim().min(1, '農場名を入力してください'),
  teacherName: z.string().trim().min(1, '講師名を入力してください'),
  email: z
    .string()
    .trim()
    .min(1, 'メールアドレスを入力してください')
    .email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
});

export default function TeacherSignUpPage() {
  const router = useRouter();
  // フォームステート
  const [farmName, setFarmName] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // トースト
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [formError, setFormError] = useState('');

  // 講師アカウント登録処理
  const handleTeacherSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const validation = teacherSignUpSchema.safeParse({
      farmName,
      teacherName,
      email,
      password,
    });

    if (!validation.success) {
      const firstError =
        validation.error.issues[0]?.message || 'すべての必須項目を入力してください';
      setFormError(firstError);
      setToastMessage(firstError);
      setShowToast(true);
      return;
    }

    const validData = validation.data;
    // メール確認が必要な環境では signUp 直後にセッションが無いため、農園名・講師名を
    // user_metadata に保存し、確認後の /auth/callback で講師登録を完了させる
    const pendingSignup = buildPendingTeacherSignupMetadata(
      validData.farmName,
      validData.teacherName
    );

    setLoading(true);

    try {
      // 1. Supabase Auth 登録
      let userId: string | null = null;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validData.email,
        password: validData.password,
        options: {
          data: pendingSignup,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/teacher/dashboard`,
        },
      });

      // 既存ユーザーの判定:
      // ① authError に 'already registered' または 'already exists' が含まれる場合
      // ② authData.user が返っているが identities が空配列（[]）の場合（Supabase Auth の既登録シグナル）
      const isAlreadyRegistered = Boolean(
        (authError &&
          (authError.message.includes('already registered') ||
            authError.message.includes('User already registered') ||
            authError.message.includes('already exists'))) ||
        (authData?.user &&
          Array.isArray(authData.user.identities) &&
          authData.user.identities.length === 0)
      );

      if (isAlreadyRegistered) {
        const msg =
          'このメールアドレスは既に登録されています。ログイン画面からログインしてください。';
        setFormError(msg);
        setToastMessage(msg);
        setShowToast(true);
        setLoading(false);
        return;
      }

      if (authError) {
        let userMsg = 'アカウントの作成に失敗しました。';
        if (isEmailRateLimitError(authError)) {
          userMsg = EMAIL_RATE_LIMIT_MESSAGE;
        } else if (authError.message.includes('Password')) {
          userMsg = 'パスワードは6文字以上で入力してください。';
        } else if (authError.message.includes('email')) {
          userMsg = '有効なメールアドレスを入力してください。';
        } else {
          userMsg = `登録エラー: ${authError.message}`;
        }
        setFormError(userMsg);
        setToastMessage(userMsg);
        setShowToast(true);
        setLoading(false);
        return;
      }

      userId = authData?.user?.id || null;
      // セッションが確立していない場合は自動ログインを試行
      if (!authData?.session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: validData.email,
          password: validData.password,
        });
        if (signInError || !signInData?.user) {
          const msg = EMAIL_CONFIRMATION_SENT_MESSAGE;
          setToastMessage(msg);
          setShowToast(true);
          setLoading(false);
          return;
        }
        userId = signInData.user.id;
      }

      if (!userId) {
        const { data: sessionUser } = await supabase.auth.getUser();
        userId = sessionUser?.user?.id || null;
      }

      if (!userId) {
        const msg = 'ユーザーアカウントの認証に失敗しました。再度お試しください。';
        setFormError(msg);
        setToastMessage(msg);
        setShowToast(true);
        setLoading(false);
        return;
      }

      // 2. 表示名の更新と register_teacher (SECURITY DEFINER) による講師昇格 & 農園開設
      //    (メール確認後の /auth/callback と同じ処理を使う)
      const signupResult = await completePendingTeacherSignup(supabase, userId, pendingSignup);

      if (!signupResult.ok) {
        console.error('register_teacher error:', signupResult.message);
        let rpcMsg = '農園の開設処理に失敗しました。';
        if (signupResult.message.includes('Farm name')) {
          rpcMsg = '農園名は2文字以上で入力してください。';
        } else {
          rpcMsg = `講師登録エラー: ${signupResult.message}`;
        }
        setFormError(rpcMsg);
        setToastMessage(rpcMsg);
        setShowToast(true);
        setLoading(false);
        return;
      }

      const createdFarmId = signupResult.farmId;

      if (typeof window !== 'undefined') {
        localStorage.setItem('nouato_owner_name', validData.teacherName);
        localStorage.setItem('nouato_current_farm_name', validData.farmName);
        if (createdFarmId) {
          localStorage.setItem('nouato_active_farm_id', createdFarmId);
        }
      }

      setToastMessage('🎉 講師アカウントおよび農場を開設しました！ダッシュボードへ移動します');
      setShowToast(true);

      setTimeout(() => {
        router.push('/teacher/dashboard');
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(`エラーが発生しました: ${msg}`);
      setToastMessage(`エラーが発生しました: ${msg}`);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const isLineDisabled = process.env.NEXT_PUBLIC_LINE_ENABLED !== 'true';

  // LINE で登録
  const handleLineSignUp = async () => {
    if (isLineDisabled) {
      setToastMessage('💡 LINE連携機能は現在準備中です。フォームからご登録ください。');
      setShowToast(true);
      return;
    }
    setLoading(true);
    try {
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'custom:line',
        options: {
          scopes: 'openid profile email',
          redirectTo: `${origin}/auth/callback?next=/teacher/dashboard`,
        },
      });

      if (error) {
        console.error('LINE signUp error:', error);
        setToastMessage('💡 LINE連携機能は現在準備中です。フォームからご登録ください。');
        setShowToast(true);
      }
    } catch (err: unknown) {
      console.error('LINE signUp exception:', err);
      setToastMessage('💡 LINE連携機能は現在準備中です。フォームからご登録ください。');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9f5] flex items-center justify-center p-4 font-sans text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl border border-gray-200/90 p-8 space-y-6 animate-fade-in">
        {/* ロゴ ＆ タイトル */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-[#1c4d21] tracking-tight">NOU-ATO</h1>
          <p className="text-xs text-gray-500 font-bold">講師アカウント作成</p>
        </div>

        {/* 💬 LINEで登録 ボタン */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleLineSignUp}
            disabled={loading || isLineDisabled}
            className={`w-full py-3.5 font-bold rounded-2xl shadow-sm transition transform active:scale-[0.99] flex items-center justify-center space-x-2 text-sm ${
              isLineDisabled
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed opacity-80'
                : 'bg-[#06C755] hover:bg-[#05b34c] text-white'
            }`}
          >
            <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 5.82 2 10.53c0 4.23 3.6 7.78 8.47 8.41.33.07.78.22.89.5.1.26.07.67.03.94-.06.4-.28 1.57-.31 1.91-.05.57.26.56.55.37.29-.19 4.67-2.75 6.37-4.71C20.61 15.65 22 13.27 22 10.53 22 5.82 17.52 2 12 2z" />
            </svg>
            <span>
              {isLineDisabled ? 'LINEで登録 (準備中)' : loading ? 'LINEへ接続中...' : 'LINEで登録'}
            </span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-3 text-[10px] text-gray-400 font-bold">または</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
        </div>

        {/* 登録フォーム */}
        <form onSubmit={handleTeacherSignUp} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold animate-fade-in flex items-center gap-2">
              <span>⚠️</span>
              <span>{formError}</span>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">農場名</label>
            <input
              type="text"
              required
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              placeholder="例: 佐藤農園"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">講師名</label>
            <input
              type="text"
              required
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="例: 佐藤 太郎"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">メールアドレス</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@nou-ato.jp"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">パスワード</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#16471a] hover:bg-[#123915] text-white font-bold rounded-2xl shadow-md transition flex items-center justify-center space-x-2 text-sm mt-2"
          >
            <span>{loading ? '登録中...' : '登録する'}</span>
          </button>

          {/* 法務・コンプライアンス同意文 */}
          <p className="text-[11px] text-center text-gray-500 leading-relaxed pt-1">
            登録することで、
            <Link href="/terms" className="text-[#1c4d21] font-bold underline hover:text-[#123915]">
              利用規約
            </Link>
            および
            <Link
              href="/privacy"
              className="text-[#1c4d21] font-bold underline hover:text-[#123915]"
            >
              プライバシーポリシー
            </Link>
            に同意したものとみなされます。
          </p>
        </form>

        {/* フッターリンク */}
        <div className="pt-2 text-center text-xs font-medium text-gray-500">
          すでにアカウントをお持ちですか？{' '}
          <Link href="/login" className="text-[#1c4d21] font-bold hover:underline">
            ログイン
          </Link>
        </div>
      </div>
    </div>
  );
}
