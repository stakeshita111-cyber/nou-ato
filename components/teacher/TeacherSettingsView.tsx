"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Toast from "@/components/ui/Toast";
import { useThemeStore, ThemeSettings } from "@/store/useThemeStore";
import { formatDate, formatNumber, formatShirubeSpeech } from "@/lib/utils/formatHelper";
import { Button } from "@/components/ui/Button";

export default function TeacherSettingsView() {
  const { settings, updateSettings, resetSettings } = useThemeStore();

  const [outdoorHighContrast, setOutdoorHighContrast] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState("auto");

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const savedContrast = localStorage.getItem("nouato_outdoor_contrast") === "true";
    setOutdoorHighContrast(savedContrast);

    const savedRefresh = localStorage.getItem("nouato_refresh_interval") || "auto";
    setRefreshInterval(savedRefresh);
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();

    localStorage.setItem("nouato_outdoor_contrast", String(outdoorHighContrast));
    localStorage.setItem("nouato_refresh_interval", refreshInterval);

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-contrast", outdoorHighContrast ? "high" : "normal");
    }

    setToastMessage("✨ 画面表示・カラーテーマ・文字サイズ・アクセシビリティ・運用設定を全画面へ確定適用しました！");
    setShowToast(true);
  };

  const sampleDate = new Date();
  const sampleHarvest = 1500;
  const sampleSpeech = "トマトの苗にはたっぷり水を与えるべぇ！";

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in text-gray-800 pb-12">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* ヘッダータイトル */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">画面・表示・運用カスタマイズ設定</h2>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            アプリ全体の配色カラー、文字サイズ、現場屋外モード、フォーマット、口調設定を変更・保存できます。
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline" size="sm" className="font-bold">
            ⚙️ 詳細設定画面 (/settings) へ
          </Button>
        </Link>
      </div>

      {/* プレビュー表示カード */}
      <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <span className="font-bold text-sm text-emerald-400">リアルタイム適用プレビュー</span>
          <span className="text-xs text-slate-400">現在設定がすぐ反映されます</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
            <span className="text-slate-400 block mb-1">日付表記</span>
            <span className="font-bold text-sm text-amber-300">{formatDate(sampleDate, settings.dateFormat)}</span>
          </div>
          <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
            <span className="text-slate-400 block mb-1">収穫量表記</span>
            <span className="font-bold text-sm text-amber-300">{formatNumber(sampleHarvest, settings.numberFormat, 'g')}</span>
          </div>
          <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
            <span className="text-slate-400 block mb-1">しるべぇ口調</span>
            <span className="font-bold text-xs text-emerald-300">{formatShirubeSpeech(sampleSpeech, settings.politeStyle)}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* 1. アプリ全体のカラー・テーマ設定 */}
        <div className="bg-white p-7 rounded-3xl border border-gray-200 shadow-sm space-y-5">
          <div className="flex items-center space-x-3 border-b border-gray-100 pb-4">
            <span className="text-2xl">🎨</span>
            <div>
              <h3 className="font-extrabold text-gray-900 text-base">カラーテーマ & メインカラー</h3>
              <p className="text-xs text-gray-500 font-medium">
                ご自身の好みや農園のイメージに合わせてアプリ全体の基調カラーを切り替えできます。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* テーマ1: キャベツグリーン */}
            <button
              type="button"
              onClick={() => updateSettings({ primaryColor: "#10b981", secondaryColor: "#f59e0b" })}
              className={`p-4 rounded-2xl border-2 text-left space-y-2 transition relative overflow-hidden ${
                settings.primaryColor === "#10b981"
                  ? "border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-300"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100/80"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="w-5 h-5 rounded-full bg-[#10b981] border border-white shadow-xs"></span>
                {settings.primaryColor === "#10b981" && <span className="text-xs font-black text-emerald-800">✓ 選択中</span>}
              </div>
              <h4 className="font-extrabold text-emerald-950 text-sm">キャベツグリーン</h4>
              <p className="text-[11px] text-emerald-800 font-medium leading-tight">標準・自然なオーガニックグリーン</p>
            </button>

            {/* テーマ2: シトラスオレンジ */}
            <button
              type="button"
              onClick={() => updateSettings({ primaryColor: "#e06d2d", secondaryColor: "#f59e0b" })}
              className={`p-4 rounded-2xl border-2 text-left space-y-2 transition relative overflow-hidden ${
                settings.primaryColor === "#e06d2d"
                  ? "border-amber-600 bg-amber-50/70 shadow-md ring-2 ring-amber-300"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100/80"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="w-5 h-5 rounded-full bg-[#e06d2d] border border-white shadow-xs"></span>
                {settings.primaryColor === "#e06d2d" && <span className="text-xs font-black text-amber-800">✓ 選択中</span>}
              </div>
              <h4 className="font-extrabold text-amber-950 text-sm">ウォームシトラス</h4>
              <p className="text-[11px] text-amber-800 font-medium leading-tight">温かみのあるオレンジ＆イエロー</p>
            </button>

            {/* テーマ3: トマトレッド / ストロベリー */}
            <button
              type="button"
              onClick={() => updateSettings({ primaryColor: "#d8527c", secondaryColor: "#f59e0b" })}
              className={`p-4 rounded-2xl border-2 text-left space-y-2 transition relative overflow-hidden ${
                settings.primaryColor === "#d8527c"
                  ? "border-pink-600 bg-pink-50/70 shadow-md ring-2 ring-pink-300"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100/80"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="w-5 h-5 rounded-full bg-[#d8527c] border border-white shadow-xs"></span>
                {settings.primaryColor === "#d8527c" && <span className="text-xs font-black text-pink-800">✓ 選択中</span>}
              </div>
              <h4 className="font-extrabold text-pink-950 text-sm">ストロベリーピンク</h4>
              <p className="text-[11px] text-pink-800 font-medium leading-tight">華やかで親しみやすいパステル</p>
            </button>

            {/* テーマ4: サファイアブルー */}
            <button
              type="button"
              onClick={() => updateSettings({ primaryColor: "#3182ce", secondaryColor: "#f59e0b" })}
              className={`p-4 rounded-2xl border-2 text-left space-y-2 transition relative overflow-hidden ${
                settings.primaryColor === "#3182ce"
                  ? "border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-300"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100/80"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="w-5 h-5 rounded-full bg-[#3182ce] border border-white shadow-xs"></span>
                {settings.primaryColor === "#3182ce" && <span className="text-xs font-black text-blue-800">✓ 選択中</span>}
              </div>
              <h4 className="font-extrabold text-blue-950 text-sm">サファイアブルー</h4>
              <p className="text-[11px] text-blue-800 font-medium leading-tight">知覚的でクリーンなオーシャンブルー</p>
            </button>
          </div>

          <div className="pt-2 flex items-center space-x-4">
            <span className="text-xs font-bold text-gray-700">カスタム色指定:</span>
            <input
              type="color"
              value={settings.primaryColor}
              onChange={(e) => updateSettings({ primaryColor: e.target.value })}
              className="w-10 h-8 rounded border cursor-pointer"
            />
            <span className="text-xs font-mono">{settings.primaryColor}</span>
          </div>
        </div>

        {/* 2. 文字サイズ ＆ 現場屋外アクセシビリティ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 文字サイズ設定 */}
          <div className="bg-white p-7 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 border-b border-gray-100 pb-3">
              <span className="text-xl">🔤</span>
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm">文字・フォントサイズ設定</h3>
                <p className="text-[11px] text-gray-500 font-medium">画面上の文字の大きさを一括調整します。</p>
              </div>
            </div>

            <div className="space-y-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => updateSettings({ fontSize: "small" })}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition ${
                  settings.fontSize === "small" ? "bg-emerald-50 border-emerald-600 text-emerald-950 font-black" : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
              >
                <span>小サイズ (14px)</span>
                {settings.fontSize === "small" && <span>✓</span>}
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ fontSize: "medium" })}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition text-sm ${
                  settings.fontSize === "medium" ? "bg-emerald-50 border-emerald-600 text-emerald-950 font-black" : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
              >
                <span>標準サイズ (16px)</span>
                {settings.fontSize === "medium" && <span>✓</span>}
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ fontSize: "large" })}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition text-base ${
                  settings.fontSize === "large" ? "bg-emerald-50 border-emerald-600 text-emerald-950 font-black" : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
              >
                <span>大サイズ (20px) - タブレット閲覧推奨</span>
                {settings.fontSize === "large" && <span>✓</span>}
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ fontSize: "xlarge" })}
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition text-lg ${
                  settings.fontSize === "xlarge" ? "bg-emerald-50 border-emerald-600 text-emerald-950 font-black" : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
              >
                <span>極大サイズ (24px) - 屋外シニア農家推奨 ⚠️</span>
                {settings.fontSize === "xlarge" && <span>✓</span>}
              </button>
            </div>
          </div>

          {/* ☀️ 屋外・畑現場モード ＆ 手袋パディング */}
          <div className="bg-white p-7 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 border-b border-gray-100 pb-3">
              <span className="text-xl">☀️</span>
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm">屋外・手袋操作モード</h3>
                <p className="text-[11px] text-gray-500 font-medium">畑の日差し下や泥手袋での視認性・押しやすさを視覚拡張します。</p>
              </div>
            </div>

            <div className="space-y-4 text-xs font-bold pt-1">
              {/* 太字（日差し対策） */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200">
                <div>
                  <span className="text-gray-900 font-black block">文字の太さ (輪郭クッキリ)</span>
                  <span className="text-[10px] text-gray-500 block">日差し反射に負けない文字に調整します</span>
                </div>
                <select
                  value={settings.fontWeight}
                  onChange={(e) => updateSettings({ fontWeight: e.target.value as ThemeSettings['fontWeight'] })}
                  className="p-2 border rounded-lg bg-white text-xs"
                >
                  <option value="normal">標準</option>
                  <option value="medium">中</option>
                  <option value="bold">極太</option>
                </select>
              </div>

              {/* 手袋サイズ */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200">
                <div>
                  <span className="text-gray-900 font-black block">手袋用ボタン拡大</span>
                  <span className="text-[10px] text-gray-500 block">作業用手袋での誤タップを防止</span>
                </div>
                <select
                  value={settings.buttonPadding}
                  onChange={(e) => updateSettings({ buttonPadding: e.target.value as ThemeSettings['buttonPadding'] })}
                  className="p-2 border rounded-lg bg-white text-xs"
                >
                  <option value="normal">通常</option>
                  <option value="large">極大（手袋対応）</option>
                </select>
              </div>

              {/* 高コントラスト */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200">
                <div>
                  <span className="text-gray-900 font-black block">高コントラスト表示モード</span>
                  <span className="text-[10px] text-gray-500 block">白飛び対策の視認性モード</span>
                </div>
                <input
                  type="checkbox"
                  checked={outdoorHighContrast}
                  onChange={(e) => setOutdoorHighContrast(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. 表示フォーマット & 口調切替 */}
        <div className="bg-white p-7 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-3 border-b border-gray-100 pb-3">
            <span className="text-xl">🌾</span>
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm">表記フォーマット & しるべぇ口調設定</h3>
              <p className="text-[11px] text-gray-500 font-medium">日付・収穫量の表記スタイルやAIナビの口調を設定します。</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
              <span className="text-gray-900 font-black block">日付表記スタイル</span>
              <select
                value={settings.dateFormat}
                onChange={(e) => updateSettings({ dateFormat: e.target.value as ThemeSettings['dateFormat'] })}
                className="w-full p-2 border rounded-lg bg-white text-xs font-medium"
              >
                <option value="japanese">8月11日(火)</option>
                <option value="slash">2026/08/11</option>
              </select>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
              <span className="text-gray-900 font-black block">収穫量・数値表記</span>
              <select
                value={settings.numberFormat}
                onChange={(e) => updateSettings({ numberFormat: e.target.value as ThemeSettings['numberFormat'] })}
                className="w-full p-2 border rounded-lg bg-white text-xs font-medium"
              >
                <option value="unit">単位あり (1,500g)</option>
                <option value="comma">カンマあり (1,500)</option>
                <option value="raw">そのまま (1500)</option>
              </select>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2">
              <span className="text-gray-900 font-black block">しるべぇの言葉遣い</span>
              <select
                value={settings.politeStyle}
                onChange={(e) => updateSettings({ politeStyle: e.target.value as ThemeSettings['politeStyle'] })}
                className="w-full p-2 border rounded-lg bg-white text-xs font-medium"
              >
                <option value="shirube">ネイティブ常体 (〜だべぇ！)</option>
                <option value="polite">標準敬体 (〜ですよ！)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 確定保存 ＆ 初期化ボタン */}
        <div className="flex justify-between items-center pt-2">
          <button
            type="button"
            onClick={resetSettings}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
          >
            🔄 初期設定に戻す
          </button>

          <button
            type="submit"
            className="px-8 py-4 app-accent-btn font-black text-sm rounded-2xl shadow-lg transition transform active:scale-95 flex items-center space-x-2"
          >
            <span>✨ 設定を確定保存 (全画面一括適用)</span>
          </button>
        </div>
      </form>
    </div>
  );
}
