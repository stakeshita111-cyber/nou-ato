"use client";

import { useEffect, useState } from "react";
import Toast from "@/components/ui/Toast";
import { useThemeStore, ThemeSettings } from "@/store/useThemeStore";
import { formatDate, formatNumber } from "@/lib/utils/formatHelper";

export default function TeacherSettingsView() {
  const { settings, updateSettings, resetSettings } = useThemeStore();

  const [outdoorHighContrast, setOutdoorHighContrast] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const savedContrast = localStorage.getItem("nouato_outdoor_contrast") === "true";
    setOutdoorHighContrast(savedContrast);
  }, []);

  const handleToggleContrast = (enabled: boolean) => {
    setOutdoorHighContrast(enabled);
    localStorage.setItem("nouato_outdoor_contrast", String(enabled));
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-contrast", enabled ? "high" : "normal");
    }
    setToastMessage(`✨ 高コントラスト表示を ${enabled ? "ON" : "OFF"} に切り替えました！`);
    setShowToast(true);
  };

  const sampleDate = new Date();
  const sampleHarvest = 1500;

  // フォントファミリーのインラインCSSマッピング
  const getFontFamilyCss = (family: ThemeSettings['fontFamily']) => {
    if (family === 'serif') return 'Georgia, Cambria, "Times New Roman", Times, serif';
    if (family === 'rounded') return '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", sans-serif';
    return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  };

  // ボタンの角丸形状マッピング
  const getBorderRadiusClass = (radius: ThemeSettings['borderRadius']) => {
    if (radius === 'none') return 'rounded-none';
    if (radius === 'full') return 'rounded-full';
    return 'rounded-xl';
  };

  // 手袋パディングサイズマッピング
  const getButtonPaddingClass = (padding: ThemeSettings['buttonPadding']) => {
    if (padding === 'large') return 'px-8 py-3.5 text-base font-black shadow-md';
    return 'px-4 py-2 text-xs font-bold shadow-xs';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in text-gray-800 pb-16 font-sans relative">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 画面ヘッダー */}
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <span>⚙️</span>
            <span>画面・表示カスタマイズ設定一覧</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1 font-bold">
            下記の選択肢ボタンを1タップするだけで全画面に即時反映・保存されます。
          </p>
        </div>
      </div>

      {/* 🌟 画面追従スライド・フローティング固定 (Sticky Top-4) ＆ リアルタイム統合プレビュー 🌟 */}
      <div className="sticky top-4 z-40 transition-all duration-300 drop-shadow-xl">
        <div className={`p-4 sm:p-5 rounded-3xl border shadow-xl backdrop-blur-md transition-all ${
          outdoorHighContrast ? "bg-amber-50/95 border-amber-400 ring-2 ring-amber-300" : "bg-white/95 border-emerald-400/90 ring-1 ring-emerald-200"
        }`}>
          {/* プレビューカード・ヘッダー */}
          <div className="flex items-center justify-between border-b border-gray-200/80 pb-2.5 mb-2.5">
            <span className="font-black text-xs text-gray-900 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full animate-ping shrink-0" style={{ backgroundColor: settings.primaryColor }} />
              <span>📍 リアルタイムプレビュー (スクロール時も画面固定)</span>
            </span>
            <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full border border-emerald-300 shrink-0">
              ✨ リアルタイム連動中
            </span>
          </div>

          {/* 1つの統合プレビュー受講生・実践カード */}
          <div 
            className="p-3.5 sm:p-4 rounded-2xl border border-gray-200/90 space-y-2.5 transition-all"
            style={{ 
              backgroundColor: '#fafafa',
              fontFamily: getFontFamilyCss(settings.fontFamily)
            }}
          >
            {/* 上部: 受講生アバター & 割当区画 & 日付 */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-9 h-9 rounded-xl font-black text-white flex items-center justify-center text-xs shadow-xs shrink-0"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  竹下
                </div>
                <div>
                  <span className="font-black text-xs sm:text-sm text-gray-900 block">竹下 翔 様</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                    区画 2 - トマト・キュウリ
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 font-bold block">最終更新日</span>
                <span className="text-xs font-black text-emerald-900">
                  {formatDate(sampleDate, settings.dateFormat)}
                </span>
              </div>
            </div>

            {/* 中部: 収穫量数値 & 実践ステータス表示 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
              <div className="bg-white p-2.5 rounded-xl border border-gray-200/80 shadow-2xs">
                <span className="text-[10px] text-gray-400 font-bold block">📊 本日の収穫量記録</span>
                <span className="text-xs sm:text-sm font-black text-amber-700">
                  ミニトマト: {formatNumber(sampleHarvest, settings.numberFormat, 'g')}
                </span>
              </div>
              <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/80 shadow-2xs">
                <span className="text-[10px] text-emerald-900 font-black flex items-center gap-1 block">
                  <span>🌱</span>
                  <span>本日作業進捗</span>
                </span>
                <p className="text-xs font-black text-emerald-950 leading-snug">
                  芽かき・水やり作業 完了 (順調)
                </p>
              </div>
            </div>

            {/* 下部: インタラクティブ・サンプルボタン ＆ フォント試聴テキスト */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1.5 border-t border-gray-200/60">
              <p className={`text-gray-900 transition-all ${
                settings.fontSize === 'small' ? 'text-xs' : settings.fontSize === 'large' ? 'text-base' : settings.fontSize === 'xlarge' ? 'text-lg font-black' : 'text-sm'
              } ${
                settings.fontWeight === 'bold' ? 'font-black' : settings.fontWeight === 'medium' ? 'font-medium' : 'font-normal'
              } ${
                settings.lineHeight === 'loose' ? 'leading-loose' : settings.lineHeight === 'relaxed' ? 'leading-relaxed' : 'leading-normal'
              }`}>
                屋外作業テキスト視認性サンプル
              </p>

              <button
                type="button"
                className={`text-white transition-all ${getBorderRadiusClass(settings.borderRadius)} ${getButtonPaddingClass(settings.buttonPadding)}`}
                style={{ backgroundColor: settings.primaryColor }}
              >
                ＋ 日誌・記録を追加
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* 📋 設定項目一覧テーブル 📋 */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center font-bold text-xs text-gray-700">
          <span>設定項目 ＆ 説明</span>
          <span>選択肢（クリック/タップで一発変更）</span>
        </div>

        <div className="divide-y divide-gray-100 text-xs font-bold">
          
          {/* 1. 農園メインカラー */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">🎨 農園メインカラー</span>
              <span className="text-[11px] text-gray-500 font-medium">基調テーマカラーを選択します</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "キャベツグリーン", color: "#10b981", sec: "#f59e0b" },
                { label: "シトラスオレンジ", color: "#e06d2d", sec: "#f59e0b" },
                { label: "ストロベリーピンク", color: "#d8527c", sec: "#f59e0b" },
                { label: "サファイアブルー", color: "#3182ce", sec: "#f59e0b" },
              ].map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    updateSettings({ primaryColor: c.color, secondaryColor: c.sec });
                    setToastMessage(`🎨 カラーを「${c.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border flex items-center space-x-2 transition ${
                    settings.primaryColor === c.color
                      ? "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full border border-white shrink-0 shadow-2xs" style={{ backgroundColor: c.color }} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. 文字の大きさ */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">🔤 文字の大きさ (屋外ズーム)</span>
              <span className="text-[11px] text-gray-500 font-medium">画面全体のフォントサイズを一括調整します</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "小 (14px)", value: "small" },
                { label: "標準 (16px)", value: "medium" },
                { label: "大 (20px)", value: "large" },
                { label: "極大 (24px) ⚠️推奨", value: "xlarge" },
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ fontSize: s.value as ThemeSettings['fontSize'] });
                    setToastMessage(`🔤 文字サイズを「${s.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition ${
                    settings.fontSize === s.value
                      ? "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. フォント種類 */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">🔤 フォント種類</span>
              <span className="text-[11px] text-gray-500 font-medium">文字の書体を変更します</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "ゴシック (標準)", value: "sans" },
                { label: "明朝体 (上品)", value: "serif" },
                { label: "丸ゴシック (読みやすい)", value: "rounded" },
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ fontFamily: f.value as ThemeSettings['fontFamily'] });
                    setToastMessage(`🔤 フォント書体を「${f.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition ${
                    settings.fontFamily === f.value
                      ? "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. 文字の太さ (日差し対策) */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">✒️ 文字の太さ (日差し反射対策)</span>
              <span className="text-[11px] text-gray-500 font-medium">直射日光下で文字の輪郭を浮き立たせます</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "標準 (細め)", value: "normal" },
                { label: "中 (読みやすい)", value: "medium" },
                { label: "極太 (クッキリ)", value: "bold" },
              ].map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ fontWeight: w.value as ThemeSettings['fontWeight'] });
                    setToastMessage(`✒️ 文字の太さを「${w.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition ${
                    settings.fontWeight === w.value
                      ? "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. 文章の行間 */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">↕️ 文章の行間 (誤読予防)</span>
              <span className="text-[11px] text-gray-500 font-medium">行間の隙間を広げて視認性を高めます</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "標準", value: "normal" },
                { label: "ゆったり", value: "relaxed" },
                { label: "広い (誤読防止)", value: "loose" },
              ].map((lh) => (
                <button
                  key={lh.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ lineHeight: lh.value as ThemeSettings['lineHeight'] });
                    setToastMessage(`↕️ 行間を「${lh.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition ${
                    settings.lineHeight === lh.value
                      ? "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {lh.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. ボタンの形 (明確変化) */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">🔘 ボタンの形状</span>
              <span className="text-[11px] text-gray-500 font-medium">ボタンの角の丸みを変更します</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "四角形 (角なし)", value: "none" },
                { label: "角丸 (標準)", value: "md" },
                { label: "楕円丸 (完全丸形)", value: "full" },
              ].map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ borderRadius: r.value as ThemeSettings['borderRadius'] });
                    setToastMessage(`🔘 ボタン形状を「${r.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 border transition ${
                    r.value === 'none' ? 'rounded-none' : r.value === 'full' ? 'rounded-full' : 'rounded-xl'
                  } ${
                    settings.borderRadius === r.value
                      ? "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* 7. 手袋対応ボタンサイズ (物理サイズ巨大化) */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">🖐️ 手袋対応ボタンサイズ</span>
              <span className="text-[11px] text-gray-500 font-medium">泥の手袋での誤タップを防止します</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "通常 (スマート)", value: "normal" },
                { label: "極大 (手袋対応・デカボタン)", value: "large" },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ buttonPadding: p.value as ThemeSettings['buttonPadding'] });
                    setToastMessage(`🖐️ ボタンサイズを「${p.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`border transition ${
                    p.value === 'large' ? 'px-6 py-3.5 text-sm font-black' : 'px-3.5 py-2 text-xs font-bold'
                  } rounded-xl ${
                    settings.buttonPadding === p.value
                      ? "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 8. 高コントラストモード */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">☀️ 高コントラスト表示モード</span>
              <span className="text-[11px] text-gray-500 font-medium">直射日光下の白飛び防止用高輝度モード</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleToggleContrast(false)}
                className={`px-3.5 py-2 rounded-xl border transition ${
                  !outdoorHighContrast
                    ? "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                標準表示 (OFF)
              </button>
              <button
                type="button"
                onClick={() => handleToggleContrast(true)}
                className={`px-3.5 py-2 rounded-xl border transition ${
                  outdoorHighContrast
                    ? "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                高コントラスト (ON)
              </button>
            </div>
          </div>

          {/* 9. 日付の書き方 */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">📅 日付の表記スタイル</span>
              <span className="text-[11px] text-gray-500 font-medium">日付の表示フォーマットを選択します</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "8月14日(金)", value: "japanese" },
                { label: "2026/08/14", value: "slash" },
              ].map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ dateFormat: d.value as ThemeSettings['dateFormat'] });
                    setToastMessage(`📅 日付表記を「${d.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition ${
                    settings.dateFormat === d.value
                      ? "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* 10. 収穫量・数値表記 */}
          <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition">
            <div>
              <span className="text-sm font-black text-gray-900 block">📊 収穫量・数値表記</span>
              <span className="text-[11px] text-gray-500 font-medium">数値と単位の表示フォーマットを選択します</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "単位あり (1,500g)", value: "unit" },
                { label: "カンマあり (1,500)", value: "comma" },
                { label: "そのまま (1500)", value: "raw" },
              ].map((num) => (
                <button
                  key={num.value}
                  type="button"
                  onClick={() => {
                    updateSettings({ numberFormat: num.value as ThemeSettings['numberFormat'] });
                    setToastMessage(`📊 数値表記を「${num.label}」に変更しました`);
                    setShowToast(true);
                  }}
                  className={`px-3.5 py-2 rounded-xl border transition ${
                    settings.numberFormat === num.value
                      ? "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-300"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {num.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* 下部初期化ボタン */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center flex-wrap gap-2">
          <span className="text-xs text-gray-500 font-bold">
            💡 選択した設定は端末のローカルストレージに自動保存されます
          </span>
          <button
            type="button"
            onClick={() => {
              resetSettings();
              setToastMessage("🔄 すべてのカスタマイズ設定を標準初期状態に戻しました");
              setShowToast(true);
            }}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition shadow-2xs"
          >
            🔄 初期設定に戻す
          </button>
        </div>
      </div>
    </div>
  );
}
