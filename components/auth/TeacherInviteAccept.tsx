'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useFarmStore } from '@/store/useFarmStore';
import { acceptFarmInvitation } from '@/lib/farm/farmMembersApi';
import { EMAIL_RATE_LIMIT_MESSAGE, isEmailRateLimitError } from '@/lib/auth/signUpErrors';

// 講師の招待リンク (/invite/teacher?token=...) を受けて、農園に講師として参加する
// - ログイン済み: 「講師として参加する」で accept_farm_invitation を呼ぶ
// - 未ログイン: この画面でログイン、またはアカウントを作成してから参加する

const loginSchema = z.object({
  email: z.string().trim().email('有効なメールアドレスを入力してください'),
  password: z.string().min(1, 'パスワードを入力してください'),
});

const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'お名前を入力してください')
    .max(100, 'お名前は100文字以内で入力してください'),
  email: z.string().trim().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
});

const TOKEN_PATTERN = /^[0-9a-f]{48}$/;

type AuthMode = 'login' | 'signup';

export default function TeacherInviteAccept({ token }: { token: string | null }) {
  const router = useRouter();
  const { fetchTeacherFarms, setActiveFarmId } = useFarmStore();

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isTokenValid = token !== null && TOKEN_PATTERN.test(token);

  const refreshSession = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      setSessionEmail(data.user ? (data.user.email ?? 'ログイン中のアカウント') : null);
    } catch (err) {
      console.error('TeacherInviteAccept session check error:', err);
      setSessionEmail(null);
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await refreshSession();
    };
    load().catch((err: unknown) => {
      console.error('TeacherInviteAccept load error:', err);
    });
  }, [refreshSession]);

  const handleAccept = async () => {
    if (!token || !isTokenValid) return;
    setIsBusy(true);
    setError(null);
    try {
      const result = await acceptFarmInvitation(token);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await fetchTeacherFarms();
      setActiveFarmId(result.data.farmId);
      router.push('/teacher/dashboard');
    } catch (err) {
      console.error('acceptFarmInvitation error:', err);
      setError('招待を受けられませんでした。時間をおいて再度お試しください');
    } finally {
      setIsBusy(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '入力内容を確認してください');
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
      if (authError) {
        setError('メールアドレスまたはパスワードが正しくありません');
        return;
      }
      await refreshSession();
    } catch (err) {
      console.error('TeacherInviteAccept login error:', err);
      setError('ログインに失敗しました');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const parsed = signUpSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '入力内容を確認してください');
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const invitePath = `/invite/teacher?token=${token}`;
      const { data, error: authError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { display_name: parsed.data.name },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(invitePath)}`,
        },
      });
      if (authError) {
        setError(
          isEmailRateLimitError(authError)
            ? EMAIL_RATE_LIMIT_MESSAGE
            : /already registered|already exists/i.test(authError.message)
              ? 'このメールアドレスは登録済みです。「ログイン」から参加してください'
              : 'アカウントの作成に失敗しました'
        );
        return;
      }
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError('このメールアドレスは登録済みです。「ログイン」から参加してください');
        return;
      }
      if (!data.session) {
        // メール確認が有効な環境: 確認後にこの招待リンクへ戻ってくる
        setNotice('確認メールを送信しました。メールのリンクを開いた後、講師として参加できます。');
        return;
      }
      await refreshSession();
    } catch (err) {
      console.error('TeacherInviteAccept signUp error:', err);
      setError('アカウントの作成に失敗しました');
    } finally {
      setIsBusy(false);
    }
  };

  if (!isTokenValid) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-lg font-black text-gray-900">招待リンクが正しくありません</h1>
        <p className="text-xs text-gray-600">
          招待した講師に、新しい招待リンクを発行してもらってください。
        </p>
        <Link href="/login" className="inline-block text-xs font-bold text-emerald-700 underline">
          ログイン画面へ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <h1 className="text-lg font-black text-gray-900">🧑‍🌾 講師として農園に参加</h1>
        <p className="text-xs text-gray-600">
          招待を受けると、この農園の講師として、ほかの講師と同じ操作ができるようになります。
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          ⚠️ {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"
        >
          ✉️ {notice}
        </p>
      )}

      {isCheckingSession ? (
        <p className="text-center text-xs text-gray-500">読み込み中...</p>
      ) : sessionEmail ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-700">
            <span className="font-bold">{sessionEmail}</span> で参加します。
          </p>
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={isBusy}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isBusy ? '参加しています…' : '講師として参加する'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2" role="tablist">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-xl py-2 text-xs font-black ${
                  mode === m ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {m === 'login' ? 'ログイン' : 'アカウントを作成'}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => void (mode === 'login' ? handleLogin(e) : handleSignUp(e))}
            className="space-y-3"
          >
            {mode === 'signup' && (
              <label className="block text-xs font-bold text-gray-700">
                お名前
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            )}
            <label className="block text-xs font-bold text-gray-700">
              メールアドレス
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-bold text-gray-700">
              パスワード
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={isBusy}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {mode === 'login' ? 'ログインして続ける' : 'アカウントを作成して続ける'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
