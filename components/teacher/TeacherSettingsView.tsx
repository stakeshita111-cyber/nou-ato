"use client";

import { useEffect, useState } from "react";
import Toast from "@/components/ui/Toast";
import { useTheme, ThemeColor, FontSize } from "@/context/ThemeContext";

export default function TeacherSettingsView() {
  const { themeColor, fontSize, applyTheme } = useTheme();

  // 設定プレビュー＆下書き用ステート
  const [draftTheme, setDraftTheme] = useState<ThemeColor>(themeColor);
  const [draftFontSize, setDraftFontSize] = useState<FontSize>(fontSize);

  // 運用・表示オプションステート
  const [outdoorHighContrast, setOutdoorHighContrast] = useState(false);
  const [enableEmailNotice, setEnableEmailNotice] = useState(true);
  const [enableWeatherAlert, setEnableWeatherAlert] = useState(true);
  const [enableUnassignedAlert, setEnableUnassignedAlert] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState("auto"); // auto, 1min, 5min, manual

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 初期化・ローカルストレージ設定の復元
  useEffect(() => {
    setDraftTheme(themeColor);
    setDraftFontSize(fontSize);

    const savedContrast = localStorage.getItem("nouato_outdoor_contrast") === "true";
    setOutdoorHighContrast(savedContrast);

    const savedRefresh = localStorage.getItem("nouato_refresh_interval") || "auto";
    setRefreshInterval(savedRefresh);
  }, [themeColor, fontSize]);

  // 設定確定適用・保存
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. テーマカラー ＆ 文字サイズ一括適用
    applyTheme(draftTheme, draftFontSize);

    // 2. 運用表示設定のローカル保存 & リアルタイムHTML属性セット
    localStorage.setItem("nouato_outdoor_contrast", String(outdoorHighContrast));
    localStorage.setItem("nouato_refresh_interval", refreshInterval);

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-contrast", outdoorHighContrast ? "high" : "normal");
    }

    setToastMessage("✨ 画面表示・カラーテーマ・文字サイズ・高コントラスト・運用通知設定を全画面へ確定適用しました！");
    setShowToast(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in text-gray-800 pb-12">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* ヘッダータイトル */}
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">画面・表示・運用カスタマイズ設定</h2>
        <p className="text-xs text-gray-500 mt-1 font-medium">
          アプリ全体の配色カラー、文字サイズ、現場屋外モード、通知アラートの設定を変更・保存できます。
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* 1. アプリ全体のカラー・テーマ設定 */}
        <div className="bg-white p-7 rounded-3xl border border-gray-200 shadow-sm space-y-5">
          <div className="flex items-center space-x-3 border-b border-gray-100 pb-4">
            <span className="text-2xl">🎨</span>
            <div>
              <h3 className="font-extrabold text-gray-900 text-base">カラーテーマカスタマイズ</h3>
              <p className="text-xs text-gray-500 font-medium">
                ご自身の好みや農園のイメージに合わせてアプリ全体の基調カラーを切り替えできます。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* テーマ1: ピスタチオグリーン */}
            <button
              type="button"
              onClick={() => setDraftTheme("pistachio")}
              className={`p-4 rounded-2xl border-2 text-left space-y-2 transition relative overflow-hidden ${
                draftTheme === "pistachio"
                  ? "border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-300"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100/80"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="w-5 h-5 rounded-full bg-[#2e7d32] border border-white shadow-xs"></span>
                {draftTheme === "pistachio" && <span className="text-xs font-black text-emerald-800">✓ 選択中</span>}
              </div>
              <h4 className="font-extrabold text-emerald-950 text-sm">ピスタチオグリーン</h4>
              <p className="text-[11px] text-emerald-800 font-medium leading-tight">標準・自然なオーガニックグリーン</p>
            </button>

            {/* テーマ2: シトラスイエロー/オレンジ */}
            <button
              type="button"
              onClick={() => setDraftTheme("citrus")}
              className={`p-4 rounded-2xl border-2 text-left space-y-2 transition relative overflow-hidden ${
                draftTheme === "citrus"
                  ? "border-amber-600 bg-amber-50/70 shadow-md ring-2 ring-amber-300"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100/80"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="w-5 h-5 rounded-full bg-[#f59e0b] border border-white shadow-xs"></span>
                {draftTheme === "citrus" && <span className="text-xs font-black text-amber-800">✓ 選択中</span>}
              </div>
              <h4 className="font-extrabold text-amber-950 text-sm">ウォームシトラス</h4>
              <p className="text-[11px] text-amber-800 font-medium leading-tight">温かみのあるオレンジ＆イエロー</p>
            </button>

            {/* テーマ3: ストロベリーピンク */}
            <button
              type="button"
              onClick={() => setDraftTheme("strawberry")}
              className={`p-4 rounded-2xl border-2 text-left space-y-2 transition relative overflow-hidden ${
                draftTheme === "strawberry"
                  ? "border-pink-600 bg-pink-50/70 shadow-md ring-2 ring-pink-300"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100/80"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="w-5 h-5 rounded-full bg-[#e89980] border border-white shadow-xs"></span>
                {draftTheme === "strawberry" && <span className="text-xs font-black text-pink-800">✓ 選択中</span>}
              </div>
              <h4 className="font-extrabold text-pink-950 text-sm">ストロベリーピンク</h4>
              <p className="text-[11px] text-pink-800 font-medium leading-tight">華やかで親しみやすいパステル</p>
            </button>

            {/* テーマ4: サファイアブルー */}
            <button
              type="button"
              onClick={() => setDraftTheme("sapphire")}
              className={`p-4 rounded-2xl border-2 text-left space-y-2 transition relative overflow-hidden ${
                draftTheme === "sapphire"
                  ? "border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-300"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100/80"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="w-5 h-5 rounded-full bg-[#0b548b] border border-white shadow-xs"></span>
                {draftTheme === "sapphire" && <span className="text-xs font-black text-blue-800">✓ 選択中</span>}
              </div>
              <h4 className="font-extrabold text-blue-950 text-sm">サファイアブルー</h4>
              <p className="text-[11px] text-blue-800 font-medium leading-tight">知覚的でクリーンなオーシャンブルー</p>
            </button>
          </div>
        </div>

        {/* 2. 文字サイズ ＆ 現場屋外モード */}
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
                onClick={() => setDraftFontSize("normal")}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition ${
                  draftFontSize === "normal" ? "bg-emerald-50 border-emerald-600 text-emerald-950 font-black" : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
              >
                <span>標準サイズ (14px)</span>
                {draftFontSize === "normal" && <span>✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setDraftFontSize("large")}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition text-sm ${
                  draftFontSize === "large" ? "bg-emerald-50 border-emerald-600 text-emerald-950 font-black" : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
              >
                <span>大サイズ (15px) - タブレット閲覧推奨</span>
                {draftFontSize === "large" && <span>✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setDraftFontSize("xlarge")}
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition text-base ${
                  draftFontSize === "xlarge" ? "bg-emerald-50 border-emerald-600 text-emerald-950 font-black" : "bg-gray-50 border-gray-200 text-gray-700"
                }`}
              >
                <span>特大サイズ (17px) - 屋外スマホ操作推奨</span>
                {draftFontSize === "xlarge" && <span>✓</span>}
              </button>
            </div>
          </div>

          {/* ☀️ 屋外・畑現場モード */}
          <div className="bg-white p-7 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 border-b border-gray-100 pb-3">
              <span className="text-xl">☀️</span>
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm">屋外・現場表示モード</h3>
                <p className="text-[11px] text-gray-500 font-medium">畑の日差し下での視認性をサポートします。</p>
              </div>
            </div>

            <div className="space-y-4 text-xs font-bold pt-1">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
                <div>
                  <span className="text-gray-900 font-black block">高コントラスト表示モード</span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">直射日光下でも文字・区画枠線が見やすくなります</span>
                </div>
                <input
                  type="checkbox"
                  checked={outdoorHighContrast}
                  onChange={(e) => setOutdoorHighContrast(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">データ自動更新インターバル</label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-gray-300 bg-gray-50 text-xs font-bold"
                >
                  <option value="auto">リアルタイム（自動ブロードキャスト連動）</option>
                  <option value="1min">1分ごとに自動更新</option>
                  <option value="5min">5分ごとに自動更新</option>
                  <option value="manual">手動更新のみ</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 通知 ＆ アラート表示カスタマイズ */}
        <div className="bg-white p-7 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-3 border-b border-gray-100 pb-3">
            <span className="text-xl">🔔</span>
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm">通知・アラート表示設定</h3>
              <p className="text-[11px] text-gray-500 font-medium">ダッシュボードや通知バッジの表示ルールを設定します。</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold">
            <label className="flex items-start space-x-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={enableEmailNotice}
                onChange={(e) => setEnableEmailNotice(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-emerald-600"
              />
              <div>
                <span className="text-gray-900 font-black block">生徒からの新着日誌通知</span>
                <span className="text-[10px] text-gray-500 block font-normal mt-0.5">交換日記投稿時に通知を受け取ります</span>
              </div>
            </label>

            <label className="flex items-start space-x-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={enableWeatherAlert}
                onChange={(e) => setEnableWeatherAlert(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-emerald-600"
              />
              <div>
                <span className="text-gray-900 font-black block">悪天候・降水警告アラート</span>
                <span className="text-[10px] text-gray-500 block font-normal mt-0.5">気象データ連動アドバイスを表示します</span>
              </div>
            </label>

            <label className="flex items-start space-x-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={enableUnassignedAlert}
                onChange={(e) => setEnableUnassignedAlert(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-emerald-600"
              />
              <div>
                <span className="text-gray-900 font-black block">未割当生徒・区画アラート</span>
                <span className="text-[10px] text-gray-500 block font-normal mt-0.5">担当者未設定区画の警告を表示します</span>
              </div>
            </label>
          </div>
        </div>

        {/* 確定保存ボタン */}
        <div className="flex justify-end pt-2">
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
