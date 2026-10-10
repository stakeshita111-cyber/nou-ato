'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Provider } from '@supabase/supabase-js';
import Toast from '@/components/ui/Toast';
import Link from 'next/link';

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCodeParam = searchParams.get('code') || searchParams.get('farm_id');

  // 農園選択・情報
  const [inviteCode, setInviteCode] = useState<string>(inviteCodeParam || '');
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [farmName, setFarmName] = useState('たなか自然農園 (体験デモ)');
  const [teacherName, setTeacherName] = useState('田中 太郎');
  const [isDemo, setIsDemo] = useState(!inviteCodeParam);

  // 入力フォームステート
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [loading, setLoading] = useState(false);

  // 招待コードから農園情報を安全に取得 (RLS anonバイパス不要のSECURITY DEFINER RPCを使用)
  useEffect(() => {
    const fetchCurrentFarm = async () => {
      try {
        if (inviteCodeParam) {
          const { data, error } = await supabase.rpc('get_farm_by_invite_code', {
            target_invite_code: inviteCodeParam,
          });

          if (!error && data && data.length > 0) {
            const farmInfo = data[0];
            setFarmName(farmInfo.farm_name || '自然農園');
            setTeacherName(farmInfo.teacher_name || '講師');
            setSelectedFarmId(farmInfo.farm_id);
            setInviteCode(inviteCodeParam);
            setIsDemo(false);
            return;
          }
        }

        // URLに招待コード指定がない、または該当なしの場合はデモ設定
        setFarmName('たなか自然農園 (体験デモ)');
        setTeacherName('田中 太郎');
        setIsDemo(true);
      } catch (err) {
        console.error('fetchCurrentFarm error:', err);
      }
    };

    fetchCurrentFarm();
  }, [inviteCodeParam]);

  const isLineDisabled = process.env.NEXT_PUBLIC_LINE_ENABLED === 'false';

  // 1. LINEで登録して参加
  const handleLineSignUp = async () => {
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
        provider: 'custom:line' as unknown as Provider,
        options: {
          scopes: 'openid profile email',
          redirectTo: `${origin}/auth/callback?next=/student&code=${encodeURIComponent(inviteCode)}`,
          queryParams: {
            code: inviteCode,
          },
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

    if (!name.trim()) {
      setToastMessage('ユーザー名（お名前）を入力してください');
      setShowToast(true);
      return;
    }
    if (!email.trim() || !password) {
      setToastMessage('メールアドレスとパスワードを入力してください');
      setShowToast(true);
      return;
    }
    if (password.length < 6) {
      setToastMessage('パスワードは6文字以上で入力してください');
      setShowToast(true);
      return;
    }

    setLoading(true);

    try {
      // 1. まずログインを試行
      const { data: signInData, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      let userId = signInData?.user?.id;

      if (loginError || !userId) {
        // 未登録（または初回）の場合は新規アカウント登録
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpError) {
          if (
            signUpError.message.includes('already registered') ||
            signUpError.message.includes('already exists')
          ) {
            setToastMessage(
              '💡 このメールアドレスは既に登録されています。パスワードが正しいかご確認のうえログインいただくか、別のメールアドレスをご入力ください。'
            );
          } else {
            setToastMessage(`登録エラー: ${signUpError.message}`);
          }
          setShowToast(true);
          setLoading(false);
          return;
        }

        userId = authData?.user?.id;
      }

      if (userId) {
        // 表示名の更新
        if (name.trim()) {
          await supabase.from('users').update({ display_name: name.trim() }).eq('id', userId);
        }

        // 安全な農園紐づけ (SECURITY DEFINER 関数 join_farm を呼び出し)
        if (inviteCode) {
          const { data: joinRes, error: joinErr } = await supabase.rpc('join_farm', {
            invite_code: inviteCode,
          });
          if (joinErr) {
            console.error('join_farm error:', joinErr);
            setToastMessage(`農園への参加に失敗しました: ${joinErr.message}`);
            setShowToast(true);
            setLoading(false);
            return;
          }
          const joinResult = joinRes as { success?: boolean; error?: string } | null;
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
                {isDemo ? '体験デモ農園' : '招待された農園'}
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
              disabled={loading}
              className="w-full py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold rounded-full shadow-xs transition flex items-center justify-center space-x-1.5 text-xs mt-2"
            >
              <span>{loading ? '登録中...' : 'メールで登録 →'}</span>
            </button>
          </form>

          {/* フッター注意書き */}
          <p className="text-[10px] text-center text-gray-400 leading-relaxed">
            登録することで、利用規約およびプライバシーポリシーに同意したことになります。
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
