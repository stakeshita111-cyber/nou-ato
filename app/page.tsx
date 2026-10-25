'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

const userRoleSchema = z.object({
  role: z.enum(['teacher', 'student']),
});

export default function RootPage() {
  const router = useRouter();
  const [statusText, setStatusText] = useState('ログイン状態を確認しています...');

  useEffect(() => {
    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;

    const checkAuthAndRedirect = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (session?.user) {
          setStatusText('ダッシュボードへ移動中...');
          // ログイン済みの場合はロール（講師/生徒）に応じて自動振り分け
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!isMounted) return;

          const parsedUser = userRoleSchema.safeParse(userData);

          if (timer) clearTimeout(timer);

          if (parsedUser.success && parsedUser.data.role === 'teacher') {
            router.replace('/teacher/dashboard');
          } else {
            router.replace('/student');
          }
        } else {
          if (timer) clearTimeout(timer);
          setStatusText('ログイン画面へ移動中...');
          router.replace('/login');
        }
      } catch (err) {
        console.error('RootPage auth check error:', err);
        if (timer) clearTimeout(timer);
        if (isMounted) {
          router.replace('/login');
        }
      }
    };

    // 8秒経過しても自動遷移しない場合の安全タイマー (低速ネットワーク向けフォールバック)
    timer = setTimeout(() => {
      if (isMounted) {
        router.replace('/login');
      }
    }, 8000);

    checkAuthAndRedirect().catch((err: unknown) => {
      console.error('RootPage unhandled error:', err);
      if (timer) clearTimeout(timer);
      if (isMounted) {
        router.replace('/login');
      }
    });

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f7f9f5] flex flex-col items-center justify-center p-6 font-sans text-gray-800">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-gray-200/80 p-8 text-center space-y-6 animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#1c4d21] text-white font-black text-2xl shadow-md animate-pulse">
          🌱
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-[#1c4d21] tracking-tight">NOU-ATO</h1>
          <p className="text-xs text-gray-500 font-bold">{statusText}</p>
        </div>

        {/* 手動遷移用フォールバックボタン (万が一自動リダイレクトが止まっても絶対に操作可能) */}
        <div className="space-y-2 pt-2">
          <Link
            href="/login"
            className="block w-full py-3 bg-[#1c4d21] text-white font-bold rounded-2xl text-xs hover:bg-[#153b19] transition shadow-md cursor-pointer"
          >
            ログイン画面へ進む
          </Link>
          <div className="flex justify-center space-x-4 text-[11px] text-gray-400 font-medium">
            <Link href="/terms" className="hover:underline">
              利用規約
            </Link>
            <span>•</span>
            <Link href="/privacy" className="hover:underline">
              プライバシーポリシー
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
