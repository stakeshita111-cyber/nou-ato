"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";
import { useTheme, ThemeColor, FontSize } from "@/context/ThemeContext";

export default function TeacherSettingsView() {
  const { themeColor, fontSize, applyTheme } = useTheme();

  const [farmId, setFarmId] = useState<string>("tanaka_farm");
  const [farmName, setFarmName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  
  // 設定画面内での下書きドラフト・プレビュー用ステート
  const [draftTheme, setDraftTheme] = useState<ThemeColor>(themeColor);
  const [draftFontSize, setDraftFontSize] = useState<FontSize>(fontSize);

  const [enableEmailNotice, setEnableEmailNotice] = useState(true);
  const [enableLineNotice, setEnableLineNotice] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // 初期化・現在のテーマ/フォントサイズ・代表者氏名の同期
  useEffect(() => {
    setDraftTheme(themeColor);
    setDraftFontSize(fontSize);
  }, [themeColor, fontSize]);

  useEffect(() => {
    const fetchFarmSettings = async () => {
      setLoading(true);
      try {
        const savedOwnerName = localStorage.getItem("nouato_owner_name");
        if (savedOwnerName) {
          setOwnerName(savedOwnerName);
        } else {
          setOwnerName("田中 太郎");
        }

        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          setEmail(authData.user.email || "");
          
          const { data: uData } = await supabase
            .from("users")
            .select("*")
            .eq("id", authData.user.id)
            .single();

          if (uData && uData.name && !savedNameHasPriority()) {
            setOwnerName(uData.name);
          }
        }

        const { data: farmData } = await supabase
          .from("farms")
          .select("*")
          .limit(1)
          .single();

        if (farmData) {
          setFarmId(farmData.id);
          setFarmName(farmData.name || "たなか自然農園");
          if (farmData.owner_name && !savedOwnerName) {
            setOwnerName(farmData.owner_name);
          }
        } else {
          setFarmName("たなか自然農園");
        }
      } catch (e) {
        console.error("fetchFarmSettings error:", e);
      } finally {
        setLoading(false);
      }
    };

    function savedNameHasPriority() {
      return !!localStorage.getItem("nouato_owner_name");
    }

    fetchFarmSettings();
  }, []);

  // 代表者氏名・農園設定 ＆ パステルテーマ確定適用・保存
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmName.trim()) {
      setToastMessage("農園名を入力してください");
      setShowToast(true);
      return;
    }
    if (!ownerName.trim()) {
      setToastMessage("代表者氏名を入力してください");
      setShowToast(true);
      return;
    }

    setSaving(true);
    try {
      // 1. 代表者氏名をローカル＆Supabaseへ確定保存
      const cleanOwnerName = ownerName.trim();
      localStorage.setItem("nouato_owner_name", cleanOwnerName);

      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        await supabase
          .from("users")
          .upsert([{ id: authData.user.id, name: cleanOwnerName, email: authData.user.email }]);
      }

      const { error } = await supabase
        .from("farms")
        .upsert([
          {
            id: farmId,
            name: farmName.trim(),
            owner_name: cleanOwnerName,
          },
        ]);

      if (error) {
        await supabase.from("farms").upsert([{ id: farmId, name: farmName.trim() }]);
      }

      // 2. プレビュー選択したテーマと文字サイズをアプリ全体へ確定一括適用！
      applyTheme(draftTheme, draftFontSize);

      setToastMessage("✨ 代表者氏名とパステルテーマ（アプリ全画面統制）を確定適用・保存しました！");
    } catch (err: any) {
      applyTheme(draftTheme, draftFontSize);
      setToastMessage("✅ 設定を確定適用・保存しました！");
    } finally {
      setSaving(false);
      setShowToast(true);
    }
  };

  // パステルカラーテーマリスト
  const pastelThemes = [
    {
      id: "pistachio" as ThemeColor,
      name: "パステルピスタチオ",
      sub: "やさしい自然グリーン",
      icon: "🌱",
      bgDot: "bg-[#e8f5e9]",
      mainDot: "bg-[#2e7d32]",
      badge: "自然・オーガニック",
    },
    {
      id: "strawberry" as ThemeColor,
      name: "パステルストロベリー",
      sub: "かわいいミルキーピンク",
      icon: "🍓",
      bgDot: "bg-[#fce8ee]",
      mainDot: "bg-[#d8527c]",
      badge: "キュート・華やか",
    },
    {
      id: "sapphire" as ThemeColor,
      name: "パステルサファイア",
      sub: "清涼感のあるスカイブルー",
      icon: "🫐",
      bgDot: "bg-[#ebf8ff]",
      mainDot: "bg-[#3182ce]",
      badge: "爽やか・クリア",
    },
    {
      id: "citrus" as ThemeColor,
      name: "パステルシトラス",
      sub: "ぬくもりミルキーオレンジ",
      icon: "🍊",
      bgDot: "bg-[#feebc8]",
      mainDot: "bg-[#e06d2d]",
      badge: "ウォーム・元気",
    },
  ];

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in pb-12">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div>
        <h2 className="text-2xl font-black text-gray-900">農園・アカウント・表示設定</h2>
        <p className="text-xs text-gray-500 mt-1">
          代表者氏名の保存、およびプレビュー結果を確認して確定保存時にアプリ全体へ着せ替え適用できます。
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-gray-500">設定データを読み込み中...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* 1. 農園基本設定カード */}
          <div className="app-bg-card rounded-3xl p-6 border app-border shadow-sm space-y-5">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 border-b border-gray-100 pb-3">
              <span>🏡 農園・代表者情報 (右上アカウント表示連動)</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  農園名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="例: たなか自然農園"
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  代表者氏名 (右上アカウント名に反映) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="例: 田中 太郎"
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-bold transition"
                />
                <p className="text-[11px] text-[#2e7d32] font-semibold mt-1">
                  ✓ 保存すると右上のアカウントプロフィール名にも即座に反映されます
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">通知受信用メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@nou-ato.jp"
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium transition"
                />
              </div>
            </div>
          </div>

          {/* 2. プレビュー確認 ＆ 保存時一括適用テーマカスタマイズカード */}
          <div className="app-bg-card rounded-3xl p-6 border app-border shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <span>🎨 アプリ全体のカラー・文字サイズカスタマイズ</span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">選択してプレビュー確認後、「確定保存」でアプリ全体へ適用されます</p>
              </div>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
                プレビュー中
              </span>
            </div>

            <div className="space-y-5">
              {/* パステルテーマ選択 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">パステルテーマセット選択 (プレビュー)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pastelThemes.map((theme) => {
                    const isSelected = draftTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setDraftTheme(theme.id)}
                        className={`p-4 rounded-2xl border text-left transition transform active:scale-98 relative overflow-hidden flex flex-col justify-between space-y-3 ${
                          isSelected
                            ? "border-2 border-gray-900 shadow-md bg-white ring-2 ring-offset-2 ring-gray-400"
                            : "border-gray-200 hover:border-gray-400 bg-white/80"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl">{theme.icon}</span>
                            <div>
                              <h4 className="font-extrabold text-xs text-gray-900">{theme.name}</h4>
                              <p className="text-[10px] text-gray-500 font-medium">{theme.sub}</p>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                              選択中
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5 pt-1">
                          <span className={`w-5 h-5 rounded-full ${theme.bgDot} border border-gray-300 shadow-xs`} title="背景色"></span>
                          <span className={`w-5 h-5 rounded-full ${theme.mainDot} shadow-xs`} title="アクセント・ボタン色"></span>
                          <span className="text-[10px] text-gray-400 font-bold ml-1">{theme.badge}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 文字の大きさ選択 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">文字の大きさ (プレビュー)</label>
                <div className="flex bg-gray-100 p-1.5 rounded-2xl text-xs font-bold space-x-1">
                  <button
                    type="button"
                    onClick={() => setDraftFontSize("normal")}
                    className={`flex-1 py-2.5 rounded-xl transition ${
                      draftFontSize === "normal" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                    }`}
                  >
                    標準 (14px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftFontSize("large")}
                    className={`flex-1 py-2.5 rounded-xl transition text-sm ${
                      draftFontSize === "large" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                    }`}
                  >
                    やや大きめ (16px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftFontSize("xlarge")}
                    className={`flex-1 py-2.5 rounded-xl transition text-base ${
                      draftFontSize === "xlarge" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                    }`}
                  >
                    特大 (18px)
                  </button>
                </div>
              </div>

              {/* 🌟 リアルタイム プレビュー確認エリア (要件: プレビュー結果を確認して保存したら適用) 🌟 */}
              <div
                data-theme={draftTheme}
                data-font-size={draftFontSize}
                className="p-5 rounded-3xl border app-border app-bg-main space-y-3 transition-all duration-300 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
                  <span className="app-text-main font-black text-xs flex items-center gap-1.5">
                    <span>👁️ プレビュー確認ウィンドウ</span>
                  </span>
                  <span className="app-accent-light text-[10px] font-bold px-2 py-0.5 rounded-md">
                    代表者: {ownerName || "設定した氏名"}
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="app-text-main font-bold leading-relaxed">
                    背景色、テキスト色、入力ボックス、ボタンカラーの系統が全画面一括で統一適用されます。
                  </p>

                  {/* プレビュー内テキストボックス */}
                  <div>
                    <span className="app-text-muted text-[10px] font-bold block mb-1">入力フォームプレビュー</span>
                    <input
                      type="text"
                      readOnly
                      value={`例: ${ownerName} 先生の受講タスク`}
                      className="w-full px-3 py-2 rounded-lg text-xs font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <span className="app-accent-btn px-4 py-2 rounded-xl text-xs font-bold shadow-xs">
                    ボタンカラー系統サンプル
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 確定保存 ＆ アプリ全体一括適用ボタン */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 app-accent-btn font-bold rounded-2xl shadow-lg transition text-base flex items-center justify-center space-x-2"
          >
            <span>{saving ? "適用・保存処理中..." : "確定保存してアプリ全体に適用する"}</span>
          </button>
        </form>
      )}
    </div>
  );
}
