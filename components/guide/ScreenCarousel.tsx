'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

export interface ScreenPoint {
  icon: string;
  label: string;
  desc: string;
  x: number; // 0% 〜 100%
  y: number; // 0% 〜 100%
}

export interface ScreenSlide {
  id: string;
  category: 'student' | 'teacher' | 'common';
  categoryLabel: string;
  title: string;
  subtitle: string;
  imageSrc: string;
  deviceType: 'mobile' | 'desktop';
  points: ScreenPoint[];
}

const SLIDES: ScreenSlide[] = [
  // 共通
  {
    id: 'login',
    category: 'common',
    categoryLabel: '認証・開始',
    title: 'ログイン画面',
    subtitle: 'ワンクリック簡単ログインで、パスワード入力不要ですぐに全機能を体験できます',
    imageSrc: '/images/screens/01-login.png',
    deviceType: 'mobile',
    points: [
      {
        icon: '👨‍🎓',
        label: '生徒でログイン',
        desc: '生徒用のスマホ画面へ直通ログイン！野菜タスクやAI相談を体験できます',
        x: 67,
        y: 45,
      },
      {
        icon: '👨‍🌾',
        label: '講師でログイン',
        desc: '先生用PC画面へ直通ログイン！生徒管理や畑レイアウト編集を体験できます',
        x: 32,
        y: 45,
      },
      {
        icon: '🔰',
        label: '利用ガイド・説明書',
        desc: 'アプリの操作方法やチュートリアルをいつでもブラウザで確認できます',
        x: 55,
        y: 37,
      },
    ],
  },
  // 生徒（アプリ下部タブ順: 畑 → 天気 → カレンダー → 相談 → 成長）
  {
    id: 'student-farm',
    category: 'student',
    categoryLabel: '受講生（生徒）',
    title: '🌾 畑（マイファーム）',
    subtitle: '今日の作業タスクと、自分の担当している畝（うね）の一覧画面',
    imageSrc: '/images/screens/02-student-farm.png',
    deviceType: 'mobile',
    points: [
      {
        icon: '📋',
        label: '今日の農作業タスクカード',
        desc: '先生から届いた今日の課題。タップして手順書を確認し、完了報告と写真投稿ができます',
        x: 50,
        y: 19,
      },
      {
        icon: '🟩',
        label: '担当畝ボタン（きゅうり・レタス等）',
        desc: '自分の区画の畝を選んで、日々の水やり・追肥・観察タイムラインを確認＆記録できます',
        x: 28,
        y: 49,
      },
      {
        icon: '🧭',
        label: '下部メニュータブ（5大機能）',
        desc: '畑・天気・カレンダー・相談・成長の各画面へワンタップで切り替えられます',
        x: 50,
        y: 96,
      },
    ],
  },
  {
    id: 'student-weather',
    category: 'student',
    categoryLabel: '受講生（生徒）',
    title: '☀️ 天気（24h気象予報）',
    subtitle: '畑の所在地に合わせたリアルタイムな気象予測と農作業アドバイス',
    imageSrc: '/images/screens/03-student-weather.png',
    deviceType: 'mobile',
    points: [
      {
        icon: '🌦️',
        label: 'ピンポイント農園気象 ＆ 作業指示',
        desc: '農園のピンポイント気象。雨予報の日は「水やり控えめOK」など科学的助言を表示します',
        x: 50,
        y: 17,
      },
      {
        icon: '📈',
        label: '24時間気温・風速推移グラフ',
        desc: '時間ごとの推移グラフ。農薬散布に適した時間帯や強風・熱中症リスクを把握できます',
        x: 50,
        y: 68,
      },
      {
        icon: '🔬',
        label: '農業・生理判定（7大指標）',
        desc: '光合成効率・土壌蒸散量・病害虫リスクなど専門的な判断指標をリアルタイム算出します',
        x: 50,
        y: 89,
      },
    ],
  },
  {
    id: 'student-calendar',
    category: 'student',
    categoryLabel: '受講生（生徒）',
    title: '📅 カレンダー（講習会・予約）',
    subtitle: '先生が開催する対面講習会や収穫体験イベントの確認・予約',
    imageSrc: '/images/screens/04-student-calendar.png',
    deviceType: 'mobile',
    points: [
      {
        icon: '📆',
        label: '月間カレンダー ＆ 表示切替',
        desc: '月表示とリスト表示を切り替えながら、今月開催されるイベント日程を俯瞰できます',
        x: 50,
        y: 28,
      },
      {
        icon: '🎟️',
        label: '直近の予定 ＆ ワンタップ予約',
        desc: '直近の講習会の残席数を確認し、「この予定を表示」から即座に参加予約ができます',
        x: 75,
        y: 41,
      },
      {
        icon: '📌',
        label: '日付マス目（イベント詳細）',
        desc: '日付をタップすると、その日に開催されるイベントの内容や集合場所を確認できます',
        x: 50,
        y: 65,
      },
    ],
  },
  {
    id: 'student-talk',
    category: 'student',
    categoryLabel: '受講生（生徒）',
    title: '💬 相談（AIしるべぇチャット）',
    subtitle: '野菜の悩みをいつでも相談できる、農園ナレッジ連動のAIアシスタント',
    imageSrc: '/images/screens/05-student-talk.png',
    deviceType: 'mobile',
    points: [
      {
        icon: '🤖',
        label: 'AIしるべぇのアドバイス吹き出し',
        desc: 'Gemini AIと農園ナレッジが連動し、肥料不足や病気のサインへの対処法を丁寧に回答します',
        x: 50,
        y: 35,
      },
      {
        icon: '🌱',
        label: 'クイック質問チップ',
        desc: '「追肥のやり方」「葉が黄色い」などをタップするだけで、文字入力不要ですぐに相談できます',
        x: 50,
        y: 77,
      },
      {
        icon: '✍️',
        label: '相談入力欄 ＆ プライバシー保護',
        desc: '自由な質問を入力可能。氏名や電話番号などの個人情報は自動で安全にマスキングされます',
        x: 45,
        y: 86,
      },
    ],
  },
  {
    id: 'student-skills',
    category: 'student',
    categoryLabel: '受講生（生徒）',
    title: '🌱 成長（スキルボード）',
    subtitle: 'クリアした作業実績と、3Dコインバッジのコレクション画面',
    imageSrc: '/images/screens/06-student-skills.png',
    deviceType: 'mobile',
    points: [
      {
        icon: '⭐',
        label: '農業スキル等級 ＆ EXPバー',
        desc: 'タスク完了や日誌提出で経験値が貯まり、Lv.5 見習い農家などどんどんランクアップ！',
        x: 50,
        y: 15,
      },
      {
        icon: '🏆',
        label: '獲得農作業バッジ（3D回転コイン）',
        desc: '課題クリアで手に入る立体バッジ。タップするとスロット内で360度クルクル回転します',
        x: 50,
        y: 44,
      },
      {
        icon: '📈',
        label: '畑の記録データ ＆ 足跡グラフ',
        desc: 'これまでの作業回数や観察履歴を日別・月別グラフで可視化。成長の歩みを実感できます',
        x: 50,
        y: 80,
      },
    ],
  },
  // 講師（サイドバーメニュー順: ダッシュボード → 生徒一覧 → 畑管理 → タスク管理 → テンプレート → 相談・日誌 → カレンダー → 画面設定）
  {
    id: 'teacher-dashboard',
    category: 'teacher',
    categoryLabel: '講師（先生）',
    title: '📊 ダッシュボード',
    subtitle: '農園の現在状況、気象指標、受講生の進捗を一元管理する司令塔画面',
    imageSrc: '/images/screens/07-teacher-dashboard.png',
    deviceType: 'desktop',
    points: [
      {
        icon: '📑',
        label: '講師ナビゲーションサイドバー',
        desc: '生徒一覧、畑レイアウト、タスク配信、相談日誌など講師専用メニューに即座に遷移',
        x: 10,
        y: 35,
      },
      {
        icon: '📢',
        label: '全員へ気象注意報送信（オレンジ）',
        desc: '台風や急な降雨、熱中症警戒時に、受講生全員のスマホへ一斉に注意案内をプッシュ配信',
        x: 85,
        y: 22,
      },
      {
        icon: '🌦️',
        label: '農業・生理判定（7大指標）',
        desc: '光合成効率・防除適性・土壌水分などをリアルタイム解析し、今日の指導判断をサポート',
        x: 58,
        y: 94,
      },
    ],
  },
  {
    id: 'teacher-students',
    category: 'teacher',
    categoryLabel: '講師（先生）',
    title: '👥 生徒一覧',
    subtitle: '全受講生のマスター情報、所属区画、進捗率の管理画面',
    imageSrc: '/images/screens/08-teacher-students.png',
    deviceType: 'desktop',
    points: [
      {
        icon: '🔗',
        label: '受講生招待（LINE / QRコード発行）',
        desc: '新しい生徒を農園へ招待するためのLINE共有URLやQRコードをワンクリック発行',
        x: 72,
        y: 19,
      },
      {
        icon: '📢',
        label: '全員へ一括配信ボタン',
        desc: '次回の持ち物案内や休講連絡など、全受講生のスマホ画面へお知らせを一斉通知',
        x: 67,
        y: 36,
      },
      {
        icon: '📋',
        label: '受講生カード（進捗率・区画割当）',
        desc: '生徒の現在のタスク進捗率（例: 80%完了）を把握し、個別メッセージ送信や区画変更が可能',
        x: 50,
        y: 70,
      },
    ],
  },
  {
    id: 'teacher-farm',
    category: 'teacher',
    categoryLabel: '講師（先生）',
    title: '🌾 畑管理（農地キャンバス）',
    subtitle: 'ドラッグ＆ドロップで畝や作物を直感的に並び替えるレイアウト管理',
    imageSrc: '/images/screens/09-teacher-farm.png',
    deviceType: 'desktop',
    points: [
      {
        icon: '⚡',
        label: '空き区画へ一括割り当て',
        desc: '未割り当ての受講生を、空いている区画（A1, A2...）へ自動でワンクリック配置',
        x: 89,
        y: 40,
      },
      {
        icon: '🚜',
        label: 'D&D 圃場区画キャンバス',
        desc: '区画カードをドラッグ＆ドロップして自由にレイアウト入れ替えや畝数の設定が可能',
        x: 50,
        y: 70,
      },
      {
        icon: '📐',
        label: '畑サイズ（列×行）設定',
        desc: '農園の広さに応じて区画の列数（A〜E列）や行数を柔軟に変更して管理できます',
        x: 60,
        y: 16,
      },
    ],
  },
  {
    id: 'teacher-tasks',
    category: 'teacher',
    categoryLabel: '講師（先生）',
    title: '📋 タスク管理',
    subtitle: '季節や作物に合わせた栽培タスクの新規作成と生徒への配信',
    imageSrc: '/images/screens/10-teacher-tasks.png',
    deviceType: 'desktop',
    points: [
      {
        icon: '➕',
        label: 'タスク追加 ＆ テンプレート作成',
        desc: '新しい栽培課題を作成したり、標準テンプレートから選んで即座に課題を用意',
        x: 82,
        y: 16,
      },
      {
        icon: '📦',
        label: 'カンバンボード（準備 ➔ 公開中）',
        desc: 'カードを右へドラッグ＆ドロップするだけで、生徒のスマホアプリへ課題が即時配信完了',
        x: 50,
        y: 50,
      },
      {
        icon: '🎯',
        label: '生徒に個別割当（ターゲット配信）',
        desc: '全員共通の課題だけでなく、特定の区画・受講生だけに特別課題をピンポイント配布',
        x: 60,
        y: 16,
      },
    ],
  },
  {
    id: 'teacher-templates',
    category: 'teacher',
    categoryLabel: '講師（先生）',
    title: '📝 テンプレート管理',
    subtitle: '毎年繰り返し使う標準的な栽培タスクをパッケージとして保存',
    imageSrc: '/images/screens/11-teacher-templates.png',
    deviceType: 'desktop',
    points: [
      {
        icon: '✨',
        label: '新しいテンプレートを作成',
        desc: '毎年の指導で使う作業手順やコツを農園のオリジナル教材として資産化・保存',
        x: 89,
        y: 15,
      },
      {
        icon: '🔍',
        label: 'シーズン・作物カテゴリ絞り込み',
        desc: '春夏・秋冬の季節や、果菜・根菜・葉菜のカテゴリから目的の課題を素早く検索',
        x: 34,
        y: 50,
      },
      {
        icon: '💡',
        label: '師匠のメモ・EXP設定カード',
        desc: '「定植は1週間遅れると収穫が1ヶ月遅れる」など、プロ農家のコツを添えて配信できます',
        x: 73,
        y: 55,
      },
    ],
  },
  {
    id: 'teacher-journals',
    category: 'teacher',
    categoryLabel: '講師（先生）',
    title: '💬 相談・日誌（レビュー＆RAG化）',
    subtitle: '生徒から届いた日誌への指導返信と、AIへの知識学習（RAG承認）',
    imageSrc: '/images/screens/12-teacher-journals.png',
    deviceType: 'desktop',
    points: [
      {
        icon: '🔴',
        label: '未返信・ステータスフィルター',
        desc: '生徒からの質問のうち未返信のものだけを1秒で抽出。生徒100人でも返信漏れを防止',
        x: 55,
        y: 24,
      },
      {
        icon: '🔍',
        label: '生徒名・キーワード検索バー',
        desc: '特定の生徒や野菜名（トマト、アブラムシ等）で過去の相談日誌を瞬時に検索',
        x: 58,
        y: 34,
      },
      {
        icon: '📸',
        label: '受講生の最新観察記録タイムライン',
        desc: '生徒が投稿した写真や気づきメモを時系列で閲覧。ピンマークから生徒の畑へ直接移動',
        x: 58,
        y: 80,
      },
    ],
  },
  {
    id: 'teacher-events',
    category: 'teacher',
    categoryLabel: '講師（先生）',
    title: '📅 イベント管理',
    subtitle: '講習会や収穫祭の企画・カレンダー登録・予約枠管理',
    imageSrc: '/images/screens/13-teacher-events.png',
    deviceType: 'desktop',
    points: [
      {
        icon: '🎪',
        label: '新しいイベントを登録',
        desc: '開催日時、定員数、参加費を設定して登録。生徒のスマホカレンダーに即時反映',
        x: 88,
        y: 15,
      },
      {
        icon: '🎟️',
        label: '直近イベントの予約枠確認',
        desc: '直近の講習会に誰が申し込んでいるか、残りの予約枠は何人かをリアルタイム確認',
        x: 91,
        y: 36,
      },
      {
        icon: '📆',
        label: '月間イベントカレンダー',
        desc: '農園の年間スケジュールを俯瞰。日付をクリックしてイベントの追加や編集が可能',
        x: 58,
        y: 65,
      },
    ],
  },
  {
    id: 'teacher-settings',
    category: 'teacher',
    categoryLabel: '講師（先生）',
    title: '⚙️ 画面設定',
    subtitle: '農園プロフィール、相談機能の表示切替、テーマ設定',
    imageSrc: '/images/screens/14-teacher-settings.png',
    deviceType: 'desktop',
    points: [
      {
        icon: '👁️',
        label: 'リアルタイム視認性プレビュー',
        desc: '文字サイズやフォントの変更結果が上部のサンプル枠へ即座に反映され確認できます',
        x: 60,
        y: 20,
      },
      {
        icon: '🎨',
        label: '農園メインカラー選択',
        desc: 'キャベツグリーン、シトラスオレンジなど農園のブランドカラーを一発設定',
        x: 60,
        y: 45,
      },
      {
        icon: '☀️',
        label: '文字の太さ・屋外ズーム設定',
        desc: '直射日光下やシニア層向けに、文字を極大・極太に設定して屋外での視認性を大幅向上',
        x: 60,
        y: 65,
      },
    ],
  },
];

export default function ScreenCarousel() {
  const [filter, setFilter] = useState<'all' | 'student' | 'teacher'>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(false); // じっくり見られるよう初期は停止、またはトグル
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  // フィルタリング: 生徒編・先生編を選んだ際は該当ロールの画面のみに絞り、即座に対象画面が表示されるようにする
  const filteredSlides = SLIDES.filter((s) => {
    if (filter === 'all') return true;
    if (filter === 'student') return s.category === 'student';
    if (filter === 'teacher') return s.category === 'teacher';
    return true;
  });

  const total = filteredSlides.length;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
    setSelectedPointIndex(null);
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
    setSelectedPointIndex(null);
  }, [total]);

  // フィルタ切り替え時にインデックスを即座にリセットし、対象の画面（生徒なら畑、先生ならダッシュボード）を表示
  const handleFilterChange = (newFilter: 'all' | 'student' | 'teacher') => {
    setFilter(newFilter);
    setCurrentIndex(0);
    setSelectedPointIndex(null);
  };

  // 全画像をブラウザキャッシュに事前プリロード（0ms切替を実現）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      SLIDES.forEach((slide) => {
        const img = new window.Image();
        img.src = slide.imageSrc;
      });
    }
  }, []);

  // 自動再生タイマー
  useEffect(() => {
    if (!isAutoPlay) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(timer);
  }, [isAutoPlay, nextSlide]);

  const currentSlide = filteredSlides[currentIndex] || filteredSlides[0];

  // タッチスワイプ対応
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 50) {
      nextSlide();
    } else if (diff < -50) {
      prevSlide();
    }
    touchStartX.current = null;
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200/90 shadow-md p-4 sm:p-6 space-y-4">
      {/* カルーセル上部ヘッダー & カテゴリ切替タブ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              全画面スライドツアー（{currentIndex + 1} / {total}）
            </h2>
          </div>
          <p className="text-2xs sm:text-xs text-slate-500 font-medium mt-0.5">
            画像内の{' '}
            <span className="font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              ① ② ③ ピン
            </span>{' '}
            をタップすると、対応するボタンの解説がハイライトされます
          </p>
        </div>

        {/* フィルタボタン */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className={`px-3 py-1.5 rounded-xl transition ${
              filter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            全機能 ({SLIDES.length})
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('student')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
              filter === 'student'
                ? 'bg-emerald-700 text-white shadow-2xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>👨‍🎓</span> 生徒編 (5)
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('teacher')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
              filter === 'teacher'
                ? 'bg-[#1c4d21] text-white shadow-2xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>👨‍🌾</span> 先生編 (8)
          </button>
        </div>
      </div>

      {/* スライド本体表示エリア */}
      <div
        className="relative select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* スライドタイトル情報 */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-2xs font-black px-2 py-0.5 rounded-full ${
                currentSlide.category === 'student'
                  ? 'bg-emerald-100 text-emerald-800'
                  : currentSlide.category === 'teacher'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-slate-200 text-slate-700'
              }`}
            >
              {currentSlide.categoryLabel}
            </span>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              {currentSlide.title}
            </h3>
          </div>

          {/* 自動送りトグルボタン */}
          <button
            type="button"
            onClick={() => setIsAutoPlay(!isAutoPlay)}
            className={`text-2xs px-2.5 py-1 rounded-full border transition flex items-center gap-1 font-bold ${
              isAutoPlay
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
            title={isAutoPlay ? '自動送りを停止' : '自動送りを開始'}
          >
            <span>{isAutoPlay ? '⏸️ 自動再生中' : '▶️ 自動再生'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-600 mb-3 leading-relaxed font-medium">
          {currentSlide.subtitle}
        </p>

        {/* スクリーンショット画像フレーム */}
        <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200/90 shadow-md bg-slate-950 flex items-center justify-center p-2 sm:p-4 min-h-[360px] sm:min-h-[440px]">
          {/* デバイス種別に応じた完全一致アスペクト比コンテナ（ズレゼロ設計） */}
          <div
            className={`relative mx-auto transition-all duration-300 ${
              currentSlide.deviceType === 'mobile'
                ? 'w-full max-w-[320px] aspect-[390/844]'
                : 'w-full max-w-[700px] aspect-[16/10]'
            }`}
          >
            {/* スクリーンショット実画像 */}
            <Image
              key={currentSlide.imageSrc}
              src={currentSlide.imageSrc}
              alt={currentSlide.title}
              fill
              unoptimized
              sizes="(max-width: 640px) 100vw, 700px"
              className="object-contain rounded-xl select-none"
              priority
            />

            {/* 画像内オーバーレイピン（①, ②, ③） */}
            <div className="absolute inset-0 pointer-events-none">
              {currentSlide.points.map((pt, i) => {
                const isSelected = selectedPointIndex === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedPointIndex(selectedPointIndex === i ? null : i)}
                    onMouseEnter={() => setSelectedPointIndex(i)}
                    style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex items-center justify-center rounded-full font-black text-white shadow-2xl transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'w-9 h-9 bg-amber-500 scale-125 ring-4 ring-amber-300 shadow-amber-500/70 z-30'
                        : 'w-7 h-7 bg-emerald-600 hover:bg-amber-500 hover:scale-115 ring-2 ring-white/90 z-20'
                    }`}
                    aria-label={`機能 ${i + 1}: ${pt.label}`}
                  >
                    <span className="text-xs">{i + 1}</span>

                    {/* ホバー/選択時ツールチップ */}
                    {isSelected && (
                      <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/95 text-white text-2xs font-bold px-2.5 py-1 rounded-lg shadow-xl pointer-events-none border border-slate-700 animate-fade-in flex items-center gap-1 z-40">
                        <span>{pt.icon}</span>
                        <span>{pt.label}</span>
                      </span>
                    )}

                    {/* 未選択時の注意を促す控えめなパルス */}
                    {!isSelected && (
                      <span className="absolute inset-0 rounded-full ring-2 ring-emerald-400 animate-ping opacity-30 pointer-events-none" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 左右ナビゲーションボタン（画像の上に浮く） */}
          <button
            type="button"
            onClick={prevSlide}
            aria-label="前のスライドへ"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-lg border border-gray-200 flex items-center justify-center text-base font-black transition active:scale-95 cursor-pointer z-30"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={nextSlide}
            aria-label="次のスライドへ"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-slate-800 shadow-lg border border-gray-200 flex items-center justify-center text-base font-black transition active:scale-95 cursor-pointer z-30"
          >
            ▶
          </button>
        </div>

        {/* スライド下部の機能ポイントカード（番号連動） */}
        <div className="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
          <div className="text-2xs font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>🔍</span> この画面の主要ボタン ＆ 実践活用ガイド
            </span>
            <span className="text-slate-400 text-3xs font-medium">
              カードをタップすると該当ピンが拡大します
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {currentSlide.points.map((pt, i) => {
              const isSelected = selectedPointIndex === i;
              return (
                <div
                  key={i}
                  onClick={() => setSelectedPointIndex(selectedPointIndex === i ? null : i)}
                  onMouseEnter={() => setSelectedPointIndex(i)}
                  className={`p-3 rounded-2xl border transition-all duration-200 cursor-pointer space-y-1 text-left ${
                    isSelected
                      ? 'bg-amber-50/95 border-amber-400 shadow-md ring-2 ring-amber-300/70 scale-[1.02]'
                      : 'bg-white border-slate-200/90 shadow-2xs hover:border-emerald-300 hover:bg-emerald-50/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-black text-white shrink-0 transition ${
                        isSelected ? 'bg-amber-500 ring-2 ring-amber-300' : 'bg-emerald-600'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="font-black text-slate-900 text-xs flex items-center gap-1 truncate">
                      <span>{pt.icon}</span>
                      <span>{pt.label}</span>
                    </span>
                  </div>
                  <p className="text-2xs text-slate-600 leading-normal pl-7">{pt.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 下部のドットインジケーター */}
        <div className="flex items-center justify-center gap-1.5 pt-3 overflow-x-auto py-1">
          {filteredSlides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setCurrentIndex(idx);
                setSelectedPointIndex(null);
              }}
              aria-label={`スライド ${idx + 1}: ${s.title}`}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === currentIndex ? 'w-6 bg-emerald-700' : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
