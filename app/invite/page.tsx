'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import Toast from '@/components/ui/Toast';
import Link from 'next/link';

export const inviteCodeSchema = z.string().trim().min(1, '招待コードを入力してください');

export const inviteSignUpSchema = z.object({
  name: z.string().trim().min(1, 'ユーザー名（お名前）を入力してください'),
  email: z
    .string()
    .trim()
    .min(1, 'メールアドレスを入力してください')
    .email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
});

type JoinFarmResult = { success?: boolean; error?: string } | null;

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCodeParam = searchParams.get('code');
  const errorParam = searchParams.get('error');

  // 農園選択・情報
  const [inviteCodeInput, setInviteCodeInput] = useState<string>(inviteCodeParam || '');
  const [inviteCode, setInviteCode] = useState<string>(inviteCodeParam || '');
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [farmName, setFarmName] = useState('農園を確認中...');
  const [teacherName, setTeacherName] = useState('');

  // 入力フォームステート
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [loading, setLoading] = useState(false);

  const verifyInviteCode = async (codeToVerify: string, isManual = false) => {
    const trimmedCode = codeToVerify.trim();
    if (!trimmedCode) {
      setSelectedFarmId('');
      setFarmName('農園情報が見つかりません');
      setTeacherName('');
      if (isManual) {
        setToastMessage(
          '❌ 有効な招待コードが見つかりませんでした。講師に招待コードをご確認ください'
        );
        setShowToast(true);
      }
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_farm_by_invite_code', {
        target_invite_code: trimmedCode,
      });

      if (!error && data && data.length > 0) {
        const farmInfo = data[0];
        setFarmName(farmInfo.farm_name || '自然農園');
        setTeacherName(farmInfo.teacher_name || '講師');
        setSelectedFarmId(farmInfo.farm_id);
        setInviteCode(trimmedCode);
        if (isManual) {
          setToastMessage(`🎉 「${farmInfo.farm_name || '自然農園'}」が確認できました`);
          setShowToast(true);
        }
      } else {
        setSelectedFarmId('');
        setFarmName('農園情報が見つかりません');
        setTeacherName('');
        if (isManual) {
          setToastMessage(
            '❌ 有効な招待コードが見つかりませんでした。講師に招待コードをご確認ください'
          );
          setShowToast(true);
        }
      }
    } catch (err: unknown) {
      console.error('verifyInviteCode exception:', err);
      setSelectedFarmId('');
      setFarmName('農園情報が見つかりません');
      setTeacherName('');
      if (isManual) {
        setToastMessage(
          '❌ 有効な招待コードが見つかりませんでした。講師に招待コードをご確認ください'
        );
        setShowToast(true);
      }
    }
  };

  // 招待コードから農園情報を安全に取得 (RLS anonバイパス不要のSECURITY DEFINER RPCを使用)
  useEffect(() => {
    let active = true;
    const init = async () => {
      if (errorParam === 'invalid_invite') {
        setToastMessage(
          '⚠️ 農園への参加処理に失敗しました。招待コードを再確認してもう一度お試しください'
        );
        setShowToast(true);
      }
      if (inviteCodeParam) {
        await verifyInviteCode(inviteCodeParam, false);
      } else if (active) {
        setFarmName('農園情報が見つかりません');
        setTeacherName('');
        setSelectedFarmId('');
      }
    };

    init().catch((err: unknown) => {
      console.error('Unhandled error in init in useEffect:', err);
    });

    return () => {
      active = false;
    };
  }, [inviteCodeParam, errorParam]);

  const isLineDisabled = process.env.NEXT_PUBLIC_LINE_ENABLED !== 'true';

  // 1. LINEで登録して参加
  const handleLineSignUp = async () => {
    if (!inviteCode.trim() || !selectedFarmId) {
      setToastMessage('⚠️ 有効な招待コードを入力し、参加する農園を確認してください');
      setShowToast(true);
      return;
    }
    if (isLineDisabled) {
      setToastMessage('💡 LINE連携機能は現在準備中です。メールアドレスでご登録ください。');
      setShowToast(true);
      return;
    }
    setLoading(true);
    try {
      const origin = window.location.origin;
      if (selectedFarmId) {
        localStorage.setItem('nouato_invite_farm_id', selectedFarmId);
        document.cookie = `nouato_invite_farm_id=${selectedFarmId}; path=/; max-age=3600`;
      }
      if (inviteCode) {
        localStorage.setItem('nouato_invite_code', inviteCode);
        document.cookie = `nouato_invite_code=${inviteCode}; path=/; max-age=3600`;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'custom:line',
        options: {
          scopes: 'openid profile email',
          redirectTo: `${origin}/auth/callback?next=/student&invite=${encodeURIComponent(inviteCode)}`,
        },
      });

      if (error) {
        console.error('LINE signUp error:', error);
        setToastMessage('💡 LINE連携機能は現在準備中です。メールアドレスでご登録ください。');
        setShowToast(true);
      }
    } catch (err: unknown) {
      console.error('LINE signUp exception:', err);
      setToastMessage('💡 LINE連携機能は現在準備中です。メールアドレスでご登録ください。');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // 2. メールアドレスで登録
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteCode.trim() || !selectedFarmId) {
      setToastMessage('⚠️ 有効な招待コードを入力し、参加する農園を確認してください');
      setShowToast(true);
      return;
    }

    const validation = inviteSignUpSchema.safeParse({ name, email, password });
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || '入力内容をご確認ください';
      setToastMessage(firstError);
      setShowToast(true);
      return;
    }

    const validData = validation.data;

    setLoading(true);

    try {
      // 1. まずログインを試行
      const { data: signInData, error: loginError } = await supabase.auth.signInWithPassword({
        email: validData.email,
        password: validData.password,
      });

      let userId = signInData?.user?.id;

      if (loginError || !userId) {
        // 未登録（または初回）の場合は新規アカウント登録
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: validData.email,
          password: validData.password,
        });

        const isAlreadyRegistered = Boolean(
          (signUpError &&
            (signUpError.message.includes('already registered') ||
              signUpError.message.includes('already exists'))) ||
          (authData?.user &&
            Array.isArray(authData.user.identities) &&
            authData.user.identities.length === 0)
        );

        if (isAlreadyRegistered) {
          setToastMessage(
            '💡 このメールアドレスは既に登録されています。パスワードが正しいかご確認のうえログインいただくか、別のメールアドレスをご入力ください。'
          );
          setShowToast(true);
          setLoading(false);
          return;
        }

        if (signUpError) {
          setToastMessage(`登録エラー: ${signUpError.message}`);
          setShowToast(true);
          setLoading(false);
          return;
        }

        userId = authData?.user?.id;
      }

      if (userId) {
        // 安全な農園紐づけ (SECURITY DEFINER 関数 join_farm を先に呼び出し、講師アカウントの誤上書きを防止)
        if (inviteCode) {
          const { data: joinResRaw, error: joinErr } = await supabase.rpc('join_farm', {
            invite_code: inviteCode,
          });
          if (joinErr) {
            console.error('join_farm error:', joinErr);
            setToastMessage(`農園への参加に失敗しました: ${joinErr.message}`);
            setShowToast(true);
            setLoading(false);
            return;
          }
          const joinResult = joinResRaw as JoinFarmResult;
          if (joinResult && joinResult.success === false) {
            console.error('join_farm returned failure:', joinResult.error);
            setToastMessage(
              `農園への参加に失敗しました: ${joinResult.error || '招待コードが無効です'}`
            );
            setShowToast(true);
            setLoading(false);
            return;
          }
        }

        // 表示名の更新 (join_farm が成功した受講生のみ更新)
        if (validData.name) {
          await supabase.from('users').update({ display_name: validData.name }).eq('id', userId);
        }
      }

      if (selectedFarmId) {
        localStorage.setItem('nouato_invite_farm_id', selectedFarmId);
      }

      setToastMessage(`🎉 「${farmName}」への参加登録が完了しました！`);
      setShowToast(true);

      setTimeout(() => {
        router.push('/student');
      }, 900);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setToastMessage('登録中にエラーが発生しました: ' + message);
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9f5] flex flex-col items-center py-6 px-4 font-sans text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="w-full max-w-[390px] bg-white rounded-3xl shadow-xl border border-gray-200/90 overflow-hidden animate-fade-in">
        {/* 動的農園招待バナー */}
        <div
          className="relative h-48 w-full bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80')`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex flex-col justify-end p-5 text-white">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="bg-emerald-700/90 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                {selectedFarmId ? '招待された農園' : '農園招待'}
              </span>
            </div>
            <h2 className="text-xl font-black leading-snug drop-shadow-md">
              {farmName}へようこそ！
            </h2>
            {teacherName && teacherName !== '講師' && teacherName !== '農園主' ? (
              <p className="text-[11px] text-gray-200 opacity-90 font-medium mt-0.5">
                👨‍🌾 担当講師: {teacherName} 先生
              </p>
            ) : (
              <p className="text-[11px] text-gray-200 opacity-90 font-medium mt-0.5">
                農跡(のうあと) - 体験農業支援ポータル
              </p>
            )}
          </div>
        </div>

        {/* コンテンツ本文 */}
        <div className="p-6 space-y-5">
          {/* キャッチコピー */}
          <div className="text-center space-y-0.5">
            <h3 className="font-black text-gray-900 text-sm">農園に参加する</h3>
            <p className="text-[11px] text-gray-500 font-medium">
              アカウントを作成して、学習を始めましょう。
            </p>
          </div>

          {/* 招待コード手入力UI */}
          <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100 space-y-2">
            <label className="block text-[11px] font-bold text-emerald-900">招待コード</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                placeholder="招待コードを入力（例: A1B2C3D4）"
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-[#1c4d21]"
              />
              <button
                type="button"
                onClick={() => {
                  verifyInviteCode(inviteCodeInput, true).catch((err: unknown) => {
                    console.error('Unhandled error in verifyInviteCode:', err);
                  });
                }}
                className="px-3 py-2 bg-[#1c4d21] hover:bg-[#123915] text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0"
              >
                確認
              </button>
            </div>
          </div>

          {/* 💬 LINEで登録して参加 ボタン */}
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
                {isLineDisabled
                  ? 'LINEで登録して参加 (準備中)'
                  : loading
                    ? 'LINEへ接続中...'
                    : 'LINEで登録して参加'}
              </span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-3 text-[10px] text-gray-400 font-bold">
                またはメールで登録
              </span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>
          </div>

          {/* メールアドレスで登録フォーム */}
          <form onSubmit={handleEmailSignUp} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">ユーザー名</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="お名前を入力"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@nou-ato.com"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition placeholder-gray-400"
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
                  placeholder="8文字以上の半角英数字"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] focus:bg-white transition pr-11 placeholder-gray-400"
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

            {/* メールで登録 → ボタン */}
            <button
              type="submit"
              disabled={loading || !selectedFarmId || !inviteCode.trim()}
              className={`w-full py-3 bg-white border border-gray-300 font-bold rounded-full shadow-xs transition flex items-center justify-center space-x-1.5 text-xs mt-2 ${
                loading || !selectedFarmId || !inviteCode.trim()
                  ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400'
                  : 'hover:bg-gray-50 text-gray-800'
              }`}
            >
              <span>{loading ? '登録中...' : 'メールで登録 →'}</span>
            </button>
          </form>

          {/* フッター注意書き */}
          <p className="text-[10px] text-center text-gray-500 leading-relaxed">
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
            に同意したことになります。
          </p>

          <div className="pt-1 text-center">
            <Link href="/login" className="text-xs text-[#1c4d21] font-bold hover:underline">
              すでにアカウントをお持ちの方はこちら (ログイン)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">読み込み中...</div>}>
      <InviteContent />
    </Suspense>
  );
}
