import Link from 'next/link';

export const metadata = {
  title: '利用規約 | NOU-ATO (のうあと)',
  description: '体験農業経営支援アプリ NOU-ATO の利用規約です。',
};

export default function TermsPage() {
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
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">利用規約</h1>
          <p className="mt-2 text-xs text-gray-500 font-medium">最終改定日: 2026年10月16日</p>
        </div>

        {/* 本文 */}
        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">第1条（はじめに）</h2>
            <p>
              本利用規約（以下「本規約」といいます。）は、体験農業経営支援サービス「NOU-ATO」（以下「本サービス」といいます。）の利用条件を定めるものです。
              本サービスをご利用になるすべての方（講師、受講生を含み、以下「ユーザー」といいます。）は、本規約に同意した上でご利用ください。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">第2条（アカウントおよび認証）</h2>
            <p>1. ユーザーは、正確かつ最新の情報を登録してアカウントを作成するものとします。</p>
            <p>
              2.
              ユーザーは、自己の認証情報（メールアドレス・パスワード・OAuth連携等）を適切に管理し、第三者への譲渡・貸与・共用を行ってはなりません。
            </p>
            <p>
              3.
              アカウントを用いて行われた一切の操作は、当該アカウントを保有するユーザー自身の行為とみなされます。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">
              第3条（農園およびコミュニティの運営）
            </h2>
            <p>
              1.
              講師ユーザーは、自己の開設した農園に所属する受講生に対し、適切な管理・指導・コミュニケーションを行うものとします。
            </p>
            <p>
              2.
              受講生ユーザーは、招待された農園の規則や講師の指導に従い、健全かつ安全に農業体験活動および記録を行うものとします。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">第4条（AI相談・RAG機能の利用）</h2>
            <p>
              1.
              本サービスが提供するAI相談機能は、農業・栽培に関する情報提供を支援するものであり、収穫や栽培の成功を法的に保証するものではありません。
            </p>
            <p>
              2.
              ユーザーは、AIモデルに対して個人識別情報（実名、電話番号、住所等）や機密情報を入力しないよう努めるものとします。
            </p>
            <p>
              3.
              AI機能にはサーバーリソース保護および悪用防止のための利用上限（チケット制等）が設定されており、上限超過時は回答が制限される場合があります。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">第5条（禁止行為）</h2>
            <p>ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません：</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>法令または公序良俗に違反する行為</li>
              <li>
                本サービスのサーバー、API、データベースへの不正アクセスやリバースエンジニアリング
              </li>
              <li>
                自動化ツール、スクリプト等による過度なAPIリクエスト（Denial of Service / Denial of
                Wallet）
              </li>
              <li>他者のアカウントの不正利用または権限昇格を試みる行為</li>
              <li>他のユーザーまたは第三者の権利・プライバシー・名誉を侵害する行為</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">
              第6条（サービスの停止・変更・免責）
            </h2>
            <p>
              本サービスは、保守点検、天災、システム障害その他のやむを得ない事由がある場合、ユーザーへの事前の通知なくサービスの一部または全部の提供を中断・変更することがあります。
              これにより生じた損害について、故意または重過失がある場合を除き、運営者は責任を負いません。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">第7条（規約の変更および準拠法）</h2>
            <p>
              1.
              本規約は、必要に応じて随時改定されることがあります。改定後の規約は、本サービス上に掲載された時点で効力を生じるものとします。
            </p>
            <p>
              2.
              本規約の解釈および適用に関しては、日本法に準拠するものとし、本サービスに関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </section>
        </div>

        {/* フッター */}
        <div className="border-t border-gray-100 pt-6 flex justify-between items-center text-xs text-gray-500">
          <span>&copy; {new Date().getFullYear()} NOU-ATO Project. All rights reserved.</span>
          <Link href="/privacy" className="font-bold text-[#1c4d21] hover:underline">
            プライバシーポリシー →
          </Link>
        </div>
      </div>
    </div>
  );
}
