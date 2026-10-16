import Link from 'next/link';

export const metadata = {
  title: 'プライバシーポリシー | NOU-ATO (のうあと)',
  description: '体験農業経営支援アプリ NOU-ATO のプライバシーポリシーです。',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f7f9f5] text-gray-800 font-sans py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-200/90 p-8 sm:p-12 space-y-8">
        {/* ヘッダー */}
        <div className="border-b border-gray-100 pb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-[#1c4d21] tracking-wider uppercase">
              NOU-ATO Legal
            </span>
            <Link
              href="/login"
              className="text-xs font-bold text-gray-500 hover:text-[#1c4d21] transition flex items-center gap-1"
            >
              <span>←</span> ログイン画面へ戻る
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            プライバシーポリシー
          </h1>
          <p className="mt-2 text-xs text-gray-500 font-medium">最終改定日: 2026年10月16日</p>
        </div>

        {/* 本文 */}
        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">第1条（基本方針）</h2>
            <p>
              体験農業経営支援サービス「NOU-ATO」（以下「本サービス」といいます。）は、ユーザーの個人情報の重要性を認識し、個人情報の保護に関する法律（個人情報保護法）を遵守するとともに、適切な取り扱いと保護に努めます。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">第2条（収集する情報）</h2>
            <p>本サービスでは、円滑な機能提供のため、以下の情報を収集・保持する場合があります：</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>アカウント情報（氏名・表示名、メールアドレス、パスワードハッシュ等）</li>
              <li>農園管理情報（農園名、区画・畝のレイアウト、作付け情報、タスク進行状況）</li>
              <li>栽培日誌・体験記録（投稿内容、受講生と講師のやりとり、添付写真）</li>
              <li>
                利用履歴・ログ情報（アクセス日時、IPアドレス、ブラウザ情報、AI相談機能の利用回数）
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">第3条（利用目的）</h2>
            <p>収集した情報は、以下の目的のためにのみ利用します：</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>本サービスの提供、認証、農園管理機能の円滑な運用</li>
              <li>講師と受講生間の体験指導・コミュニケーション支援</li>
              <li>AI相談機能による栽培アドバイス・ナレッジ提供</li>
              <li>システムの保守、不正アクセスやセキュリティインシデントの防止および調査</li>
              <li>サービスの改善、新機能開発のための統計分析（個人が特定できない形式に限定）</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">
              第4条（AIモデル・外部APIへのデータ送信）
            </h2>
            <p>
              1. 本サービスのAI相談機能（RAG）において、農業ナレッジ検索および回答生成のため外部AI
              API（Google AI Studio / Gemini等）を利用します。
            </p>
            <p>
              2. 外部AI
              APIへの送信にあたっては、ユーザーの個人識別情報（PII）のマスキング処理を行い、プライバシー保護に配慮します。また、送信されたデータがAIモデルの汎用学習データとして利用されない設定・規約を採用しています。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">第5条（個人情報の第三者提供）</h2>
            <p>
              本サービスは、法令に基づく要請がある場合を除き、ユーザーの同意を得ることなく個人情報を第三者に提供・開示することはありません。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">第6条（安全管理措置）</h2>
            <p>
              本サービスでは、Row Level Security (RLS)
              による農園単位の厳格なマルチテナント分離、通信のSSL/TLS暗号化、セキュリティヘッダーの適用など、データの漏洩・滅失・毀損を防止するための技術的・組織的安全管理措置を実施しています。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">
              第7条（開示・訂正・削除およびお問い合わせ）
            </h2>
            <p>
              ユーザーがご自身の個人情報の開示、訂正、利用停止、または削除をご希望される場合は、サービス内の設定画面または運営者窓口までご連絡ください。
              本人確認の上、合理的な期間内に適切に対応いたします。
            </p>
          </section>
        </div>

        {/* フッター */}
        <div className="border-t border-gray-100 pt-6 flex justify-between items-center text-xs text-gray-500">
          <Link href="/terms" className="font-bold text-[#1c4d21] hover:underline">
            ← 利用規約
          </Link>
          <span>&copy; {new Date().getFullYear()} NOU-ATO Project. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}
