'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TeacherInviteAccept from '@/components/auth/TeacherInviteAccept';

// 講師の招待リンク。/teacher 配下にすると、講師でないアカウント (新規登録直後など) が
// proxy.ts で生徒画面へ転送されるため、/invite 配下に置く
function TeacherInviteContent() {
  const searchParams = useSearchParams();
  return <TeacherInviteAccept token={searchParams.get('token')} />;
}

export default function TeacherInvitePage() {
  return (
    <main className="min-h-screen bg-emerald-50/60 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm border border-emerald-100">
        <Suspense fallback={<p className="text-center text-xs text-gray-500">読み込み中...</p>}>
          <TeacherInviteContent />
        </Suspense>
      </div>
    </main>
  );
}
