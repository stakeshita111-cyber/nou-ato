'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function RootPage() {
  const [statusText, setStatusText] = useState('ログイン状態を確認しています...');

  useEffect(() => {
    let isMounted = true;

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

          if (userData?.role === 'teacher') {
            window.location.replace('/teacher/dashboard');
          } else {
            window.location.replace('/student');
          }
        } else {
          setStatusText('ログイン画面へ移動中...');
          window.location.replace('/login');
        }
      } catch (err) {
        console.error('RootPage auth check error:', err);
        if (isMounted) {
          window.location.replace('/login');
        }
      }
    };

    checkAuthAndRedirect();

    // 1.5秒経過しても自動遷移しない場合の安全タイマー (フォールバック)
    const timer = setTimeout(() => {
      if (isMounted) {
        window.location.replace('/login');
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

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
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 bg-[#1c4d21] text-white font-bold text-sm rounded-2xl hover:bg-[#163e1a] shadow-sm transition active:scale-[0.98]"
          >
            <span>🔑</span>
            <span>ログイン画面へ進む</span>
          </Link>
          <div className="flex gap-2 justify-center pt-2">
            <Link
              href="/teacher/dashboard"
              className="text-xs text-gray-500 hover:text-emerald-700 underline font-medium px-2 py-1"
            >
              講師ダッシュボード
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              href="/student"
              className="text-xs text-gray-500 hover:text-emerald-700 underline font-medium px-2 py-1"
            >
              受講生ポータル
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
