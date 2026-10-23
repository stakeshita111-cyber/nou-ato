'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  completePendingTeacherSignup,
  readPendingTeacherSignup,
  type PendingTeacherSignup,
} from '@/lib/auth/pendingTeacherSignup';

interface PendingTeacherSetupCardProps {
  onMessage: (message: string) => void;
}

/**
 * 講師登録フォームから登録したが、農園の開設が完了していないアカウント向けの救済カード。
 * 確認メールを別の端末で開いた場合など、/auth/callback で講師登録を完了できなかったときに
 * 農園未所属画面から農園を開設できるようにする。講師登録の意思が無いアカウントには何も表示しない。
 */
export default function PendingTeacherSetupCard({ onMessage }: PendingTeacherSetupCardProps) {
  const router = useRouter();
  const [pending, setPending] = useState<{ userId: string; signup: PendingTeacherSignup } | null>(
    null
  );
  const [farmName, setFarmName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPendingSignup = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      const signup = user ? readPendingTeacherSignup(user.user_metadata) : null;
      if (!cancelled && user && signup) {
        setPending({ userId: user.id, signup });
        setFarmName(signup.pending_farm_name);
      }
    };

    loadPendingSignup().catch((err) => {
      console.error('PendingTeacherSetupCard load error:', err);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!pending) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedFarmName = farmName.trim();
    if (!trimmedFarmName) {
      onMessage('農園名を入力してください');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await completePendingTeacherSignup(supabase, pending.userId, {
        ...pending.signup,
        pending_farm_name: trimmedFarmName,
      });
      if (!result.ok) {
        onMessage(`農園の開設に失敗しました: ${result.message}`);
        return;
      }
      onMessage('🎉 農園を開設しました！講師ダッシュボードへ移動します');
      router.push('/teacher/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '予期せぬエラーが発生しました';
      onMessage(`農園の開設に失敗しました: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        handleSubmit(e).catch((err) => {
          console.error('PendingTeacherSetupCard submit error:', err);
        });
      }}
      className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-left space-y-2"
    >
      <p className="text-[11px] font-bold text-emerald-900">👨‍🌾 講師として登録中です</p>
      <p className="text-[11px] text-emerald-800 font-semibold leading-relaxed">
        農園の開設がまだ完了していません。農園名を確認して開設してください。
      </p>
      <label className="block text-[11px] font-bold text-gray-700" htmlFor="pending-farm-name">
        農園名
      </label>
      <input
        id="pending-farm-name"
        type="text"
        value={farmName}
        onChange={(e) => setFarmName(e.target.value)}
        className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1c4d21] transition"
        disabled={isSubmitting}
      />
      <button
        type="submit"
        disabled={isSubmitting || !farmName.trim()}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer"
      >
        {isSubmitting ? '開設中...' : '農園を開設して講師として始める'}
      </button>
    </form>
  );
}
