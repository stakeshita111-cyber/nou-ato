"use client";

import { useEffect, useState, useMemo } from "react";
import { VEGETABLE_TASK_TEMPLATES, TaskTemplate, TaskSeason, TaskPhase, TaskCategory } from "@/lib/taskTemplates";
import Toast from "@/components/ui/Toast";
import StudentTaskPreviewModal from "@/components/templates/StudentTaskPreviewModal";
import { supabase } from "@/lib/supabase";
import { useFarmStore } from "@/store/useFarmStore";

// 公式テンプレートとカスタムテンプレートを安全にマージする関数
const mergeTemplates = (customList: TaskTemplate[]): TaskTemplate[] => {
  const map = new Map<string, TaskTemplate>();
  // 1. 公式をセット
  VEGETABLE_TASK_TEMPLATES.forEach((tpl) => map.set(tpl.id, tpl));
  // 2. カスタムで上書き / 追加
  customList.forEach((tpl) => map.set(tpl.id, tpl));
  return Array.from(map.values());
};

export default function TeacherTemplatesView() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  // 絞り込み状態 (4軸 + 検索 + ソート)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  const [selectedCrop, setSelectedCrop] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("default");

  // 生徒視点プレビューモーダル状態
  const [previewTemplate, setPreviewTemplate] = useState<TaskTemplate | null>(null);

  // モバイル用フィルタードロワー表示トグル
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // 初期読み込み
  useEffect(() => {
    let customTemplates: TaskTemplate[] = [];
    const saved = localStorage.getItem("nouato_custom_templates");
    if (saved) {
      try {
        customTemplates = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse custom templates:", e);
      }
    }
    setTemplates(mergeTemplates(customTemplates));
  }, []);

  // Escapeキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingTemplate) setEditingTemplate(null);
        if (previewTemplate) setPreviewTemplate(null);
        if (isMobileFilterOpen) setIsMobileFilterOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingTemplate, previewTemplate, isMobileFilterOpen]);

  // ストレージへの保存（公式 tpl_ を除外したカスタム分のみ永続化）
  const saveTemplatesToStorage = (updatedList: TaskTemplate[]) => {
    setTemplates(updatedList);
    try {
      const customOnly = updatedList.filter((t) => !t.id.startsWith("tpl_"));
      localStorage.setItem("nouato_custom_templates", JSON.stringify(customOnly));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
    }
  };

  // テンプレートから教材/タスクに追加する処理
  const handleAddToTasks = async (tpl: TaskTemplate) => {
    setAddingId(tpl.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let farmId =
        useFarmStore.getState().activeFarmId ||
        (typeof window !== "undefined" ? localStorage.getItem("nouato_active_farm_id") : null);

      if (!farmId && user) {
        const { data: userData } = await supabase
          .from("users")
          .select("farm_id")
          .eq("id", user.id)
          .maybeSingle();
        if (userData?.farm_id) farmId = userData.farm_id;
      }

      const memoContent = [
        tpl.memo || "",
        tpl.timing ? `【実施目安】${tpl.timing}` : "",
        tpl.source ? `【出典】${tpl.source}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const newTaskData = {
        title: tpl.title,
        status: "pool", // 教材準備レーンへ
        category: tpl.category || "work",
        description: tpl.description,
        tools_needed: tpl.tools_needed,
        memo: memoContent || null,
        target_crop: tpl.target_crop,
        require_photo: tpl.require_photo ?? true,
        exp: tpl.exp || 50,
        difficulty: tpl.difficulty || 1,
        estimated_time: tpl.estimated_time,
        badge_name: tpl.badge_name || null,
        badge_icon: tpl.badge_icon || null,
        reference_links: tpl.reference_links || null,
        created_by: user?.id || null,
        farm_id: farmId || null,
      };

      const { error } = await supabase.from("tasks").insert([newTaskData]);
      if (error) {
        throw error;
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nouato_tasks_updated"));
        window.dispatchEvent(new Event("nouato_sync_event"));
      }

      setToastMessage(
        `✨ テンプレート「${tpl.title}」を教材・タスクに追加しました！看板ボード（教材準備）で配信できます。`
      );
      setShowToast(true);
    } catch (e: any) {
      console.error("handleAddToTasks error:", e);
      setToastMessage(`❌ タスクの追加に失敗しました: ${e?.message || "不明なエラー"}`);
      setShowToast(true);
    } finally {
      setAddingId(null);
    }
  };

  // 新規テンプレート作成の開始
  const handleStartCreate = () => {
    const newTpl: TaskTemplate = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `custom_tpl_${Date.now()}`,
      title: "🌱 新しい栽培タスクテンプレート",
      target_crop: "野菜",
      variety: "",
      category: "果菜",
      season: "春夏",
      phase: "準備・植付",
      estimated_time: "30分",
      tools_needed: "軍手, ハサミ",
      description: "・作業手順1\n・作業手順2",
      memo: "師匠からのアドバイスを記入...",
      exp: 50,
      difficulty: 2,
      require_photo: true,
      badge_name: "栽培マスター",
      badge_icon: "🌿",
    };
    setEditingTemplate(newTpl);
    setIsCreatingNew(true);
  };

  // 公式テンプレートを複製して編集
  const handleDuplicateOfficial = (tpl: TaskTemplate) => {
    const duplicatedTpl: TaskTemplate = {
      ...tpl,
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `custom_tpl_${Date.now()}`,
      title: `【コピー】${tpl.title}`,
    };
    setEditingTemplate(duplicatedTpl);
    setIsCreatingNew(true);
  };

  // 保存処理
  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    let nextList: TaskTemplate[];
    if (isCreatingNew) {
      nextList = [editingTemplate, ...templates];
    } else {
      nextList = templates.map((t) => (t.id === editingTemplate.id ? editingTemplate : t));
    }

    saveTemplatesToStorage(nextList);
    setEditingTemplate(null);
    setIsCreatingNew(false);
    setToastMessage("✨ タスクテンプレートを保存しました！タスク追加時に選択できます。");
    setShowToast(true);
  };

  // 削除処理（カスタムテンプレートのみ）
  const handleDeleteTemplate = (id: string, title: string) => {
    if (id.startsWith("tpl_")) {
      alert("公式テンプレートは削除できません。");
      return;
    }
    if (!confirm(`テンプレート「${title}」を削除しますか？`)) return;
    const nextList = templates.filter((t) => t.id !== id);
    saveTemplatesToStorage(nextList);
    setToastMessage("🗑 テンプレートを削除しました。");
    setShowToast(true);
  };

  // 初期状態にリセット
  const handleResetTemplates = () => {
    if (confirm("公式テンプレートを初期状態に戻しますか？（※ご自身で作成されたカスタムテンプレートは維持されます）")) {
      const customOnly = templates.filter((t) => !t.id.startsWith("tpl_"));
      const resetTemplates = mergeTemplates(customOnly);
      setTemplates(resetTemplates);
      localStorage.setItem("nouato_custom_templates", JSON.stringify(customOnly));
      setToastMessage("🔄 テンプレートを初期状態にリセットしました。");
      setShowToast(true);
    }
  };

  // ────────────── 動的連動カスケード作物の抽出 ──────────────
  // カテゴリ・季節・工程・キーワード検索に合致する「母集団」から、作物名とその該当件数を集計
  const availableCrops = useMemo(() => {
    const counts = new Map<string, number>();

    templates.forEach((tpl) => {
      // 1. カテゴリ一致
      const matchesCategory =
        selectedCategory === "all" ||
        tpl.category === selectedCategory ||
        (selectedCategory === "共通" && (tpl.category === "土作り" || tpl.category === "共通"));

      // 2. 季節一致 (通年は春夏・秋冬どちらにも含める)
      const matchesSeason =
        selectedSeason === "all" ||
        tpl.season === selectedSeason ||
        tpl.season === "通年";

      // 3. 作業工程一致
      const matchesPhase = selectedPhase === "all" || tpl.phase === selectedPhase;

      // 4. キーワード検索 (作物名以外でマッチするか)
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (tpl.title && tpl.title.toLowerCase().includes(query)) ||
        (tpl.description && tpl.description.toLowerCase().includes(query)) ||
        (tpl.target_crop && tpl.target_crop.toLowerCase().includes(query));

      if (matchesCategory && matchesSeason && matchesPhase && matchesSearch) {
        const crop = tpl.target_crop || "共通";
        counts.set(crop, (counts.get(crop) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([crop, count]) => ({ crop, count }))
      .sort((a, b) => b.count - a.count || a.crop.localeCompare(b.crop, "ja"));
  }, [templates, selectedCategory, selectedSeason, selectedPhase, searchQuery]);

  // 他のフィルター変更により、選択中の作物が候補から外れた場合は安全に "all" へリセット
  useEffect(() => {
    if (selectedCrop !== "all") {
      const exists = availableCrops.some((c) => c.crop === selectedCrop);
      if (!exists) {
        setSelectedCrop("all");
      }
    }
  }, [availableCrops, selectedCrop]);

  // ────────────── 最終フィルタ・ソート結果 ──────────────
  const filteredAndSortedTemplates = useMemo(() => {
    return templates
      .filter((tpl) => {
        const matchesCategory =
          selectedCategory === "all" ||
          tpl.category === selectedCategory ||
          (selectedCategory === "共通" && (tpl.category === "土作り" || tpl.category === "共通"));

        const matchesSeason =
          selectedSeason === "all" ||
          tpl.season === selectedSeason ||
          tpl.season === "通年";

        const matchesPhase = selectedPhase === "all" || tpl.phase === selectedPhase;

        const matchesCrop = selectedCrop === "all" || tpl.target_crop === selectedCrop;

        const query = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !query ||
          (tpl.title && tpl.title.toLowerCase().includes(query)) ||
          (tpl.target_crop && tpl.target_crop.toLowerCase().includes(query)) ||
          (tpl.description && tpl.description.toLowerCase().includes(query));

        return matchesCategory && matchesSeason && matchesPhase && matchesCrop && matchesSearch;
      })
      .sort((a, b) => {
        if (sortOrder === "title_asc") return a.title.localeCompare(b.title, "ja");
        if (sortOrder === "title_desc") return b.title.localeCompare(a.title, "ja");
        if (sortOrder === "exp_desc") return (b.exp || 0) - (a.exp || 0);
        if (sortOrder === "difficulty_asc") return (a.difficulty || 1) - (b.difficulty || 1);
        return 0;
      });
  }, [templates, selectedCategory, selectedSeason, selectedPhase, selectedCrop, searchQuery, sortOrder]);

  // アクティブなフィルター件数
  const activeFilterCount =
    (selectedCategory !== "all" ? 1 : 0) +
    (selectedSeason !== "all" ? 1 : 0) +
    (selectedPhase !== "all" ? 1 : 0) +
    (selectedCrop !== "all" ? 1 : 0) +
    (searchQuery.trim() !== "" ? 1 : 0);

  const handleResetFilters = () => {
    setSelectedCategory("all");
    setSelectedSeason("all");
    setSelectedPhase("all");
    setSelectedCrop("all");
    setSearchQuery("");
  };

  // ────────────── サイドバーUIコンポーネント ──────────────
  const renderSidebarFilters = () => (
    <div className="space-y-5 text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center space-x-1.5 font-black text-gray-900 text-sm">
          <span>🌪️</span>
          <span>絞り込み条件</span>
          {activeFilterCount > 0 && (
            <span className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer"
          >
            条件リセット
          </button>
        )}
      </div>

      {/* 1. 季節 (春夏 / 秋冬) */}
      <div className="space-y-2">
        <label className="block font-black text-gray-800 text-[11px] flex items-center space-x-1">
          <span>📅</span>
          <span>栽培シーズン (季節)</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5 font-bold">
          {[
            { id: "all", label: "すべて" },
            { id: "春夏", label: "🌸☀️ 春夏" },
            { id: "秋冬", label: "🍂❄️ 秋冬" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSeason(s.id)}
              className={`py-2 px-1 rounded-xl text-center transition cursor-pointer text-[11px] ${
                selectedSeason === s.id
                  ? "bg-emerald-700 text-white font-black shadow-xs"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. カテゴリ (共通・農園管理含む) */}
      <div className="space-y-2">
        <label className="block font-black text-gray-800 text-[11px] flex items-center space-x-1">
          <span>🏷️</span>
          <span>野菜カテゴリ</span>
        </label>
        <div className="space-y-1">
          {[
            { id: "all", label: "すべてのカテゴリ", icon: "🌱" },
            { id: "果菜", label: "果菜 (トマト・ナス等)", icon: "🍅" },
            { id: "根菜", label: "根菜 (イモ・ダイコン等)", icon: "🥔" },
            { id: "葉菜", label: "葉菜 (キャベツ・ネギ等)", icon: "🥬" },
            { id: "共通", label: "共通・農園管理 (土・草・苗・事務)", icon: "🚜" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`w-full text-left px-3 py-2 rounded-xl transition cursor-pointer flex items-center justify-between font-bold ${
                selectedCategory === cat.id
                  ? "bg-emerald-100 text-emerald-950 font-black border border-emerald-300 shadow-xs"
                  : "hover:bg-gray-100 text-gray-700 border border-transparent"
              }`}
            >
              <div className="flex items-center space-x-2">
                <span>{cat.icon}</span>
                <span className="text-[11px]">{cat.label}</span>
              </div>
              {selectedCategory === cat.id && <span className="text-emerald-700 text-xs">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 3. 作業順 (工程フェーズ) */}
      <div className="space-y-2">
        <label className="block font-black text-gray-800 text-[11px] flex items-center space-x-1">
          <span>🔄</span>
          <span>作業工程 (フェーズ)</span>
        </label>
        <div className="space-y-1">
          {[
            { id: "all", label: "すべての工程" },
            { id: "準備・植付", label: "🌱 1. 準備・植え付け" },
            { id: "育成・管理", label: "✂️ 2. 育成・管理" },
            { id: "収穫・片付け", label: "🧺 3. 収穫・片付け" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPhase(p.id)}
              className={`w-full text-left px-3 py-2 rounded-xl transition cursor-pointer flex items-center justify-between font-bold ${
                selectedPhase === p.id
                  ? "bg-emerald-100 text-emerald-950 font-black border border-emerald-300 shadow-xs"
                  : "hover:bg-gray-100 text-gray-700 border border-transparent"
              }`}
            >
              <span className="text-[11px]">{p.label}</span>
              {selectedPhase === p.id && <span className="text-emerald-700 text-xs">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 4. 野菜名・品種 (動的連動型) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block font-black text-gray-800 text-[11px] flex items-center space-x-1">
            <span>🥕</span>
            <span>対象作物・品種</span>
          </label>
          <span className="text-[10px] text-gray-400 font-bold">{availableCrops.length}品種</span>
        </div>

        {/* 作物クイック選択チップ */}
        <div className="max-h-48 overflow-y-auto pr-1 space-y-1">
          <button
            type="button"
            onClick={() => setSelectedCrop("all")}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer flex items-center justify-between font-bold ${
              selectedCrop === "all"
                ? "bg-emerald-600 text-white font-black"
                : "bg-gray-50 hover:bg-gray-100 text-gray-700"
            }`}
          >
            <span>すべて</span>
            <span className="text-[10px] opacity-80">{templates.length}件</span>
          </button>

          {availableCrops.map(({ crop, count }) => (
            <button
              key={crop}
              type="button"
              onClick={() => setSelectedCrop(crop)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer flex items-center justify-between font-bold ${
                selectedCrop === crop
                  ? "bg-emerald-600 text-white font-black"
                  : "bg-gray-50 hover:bg-gray-100 text-gray-700"
              }`}
            >
              <span className="truncate pr-1">{crop}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedCrop === crop ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <Toast isOpen={showToast} message={toastMessage} onClose={() => setShowToast(false)} />

      {/* 生徒視点プレビューモーダル */}
      <StudentTaskPreviewModal
        template={previewTemplate}
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        onAddToTasks={(tpl) => {
          handleAddToTasks(tpl);
        }}
        isAdding={addingId === previewTemplate?.id}
      />

      {/* ヘッダーエリア */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">📝 教材・タスクテンプレート作成・管理</h2>
          <p className="text-xs text-gray-500 mt-1">
            作物の作業手順や獲得バッジをテンプレート化して保存・編集できます。生徒視点での見え方も直接確認できます。
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetTemplates}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1 cursor-pointer"
            title="公式テンプレートを初期データに再読み込みします"
          >
            <span>🔄 リセット</span>
          </button>
          <button
            type="button"
            onClick={handleStartCreate}
            className="px-5 py-2.5 app-accent-btn font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <span className="text-base leading-none">＋</span>
            <span>新しいテンプレートを作成</span>
          </button>
        </div>
      </div>

      {/* モバイル用絞り込みトグルボタン */}
      <div className="lg:hidden flex items-center justify-between gap-2 bg-white p-3 rounded-2xl border app-border">
        <button
          type="button"
          onClick={() => setIsMobileFilterOpen(true)}
          className="flex-1 py-2 px-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs flex items-center justify-center space-x-2"
        >
          <span>🌪️ 絞り込み条件</span>
          {activeFilterCount > 0 && (
            <span className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-bold bg-white outline-none"
        >
          <option value="default">デフォルト順</option>
          <option value="title_asc">名前順 (昇順)</option>
          <option value="title_desc">名前順 (降順)</option>
          <option value="exp_desc">EXPが多い順</option>
        </select>
      </div>

      {/* ────────────── メインレイアウト (左: サイドバー / 右: カード一覧) ────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* デスクトップ用 左固定サイドバー */}
        <aside className="hidden lg:block w-72 shrink-0 bg-white p-5 rounded-3xl border app-border shadow-sm sticky top-6">
          {renderSidebarFilters()}
        </aside>

        {/* 右メインエリア */}
        <div className="flex-1 w-full space-y-4">
          {/* 上部検索バー ＆ ソート＆ 件数ステータス */}
          <div className="bg-white p-4 rounded-2xl border app-border shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="w-full sm:flex-1 relative">
              <input
                type="text"
                placeholder="🔍 テンプレート名、作物名、作業手順でフリーワード検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-gray-300 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-gray-50 focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-gray-500">並び順:</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-300 text-xs font-bold bg-white focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
              >
                <option value="default">デフォルト順</option>
                <option value="title_asc">名前順 (昇順)</option>
                <option value="title_desc">名前順 (降順)</option>
                <option value="exp_desc">EXPが多い順</option>
                <option value="difficulty_asc">難易度が低い順</option>
              </select>
            </div>
          </div>

          {/* 絞り込み条件ピル＆件数インジケーター */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 text-xs">
              <span className="font-bold text-gray-500">表示件数:</span>
              <span className="font-black text-emerald-800 text-sm">
                {filteredAndSortedTemplates.length}
              </span>
              <span className="text-gray-400 font-medium">/ 全 {templates.length} 件</span>

              {/* 選択中のタグ表示 */}
              {selectedSeason !== "all" && (
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  季節: {selectedSeason}
                  <button type="button" onClick={() => setSelectedSeason("all")} className="hover:text-red-500">
                    ✕
                  </button>
                </span>
              )}
              {selectedCategory !== "all" && (
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  カテゴリ: {selectedCategory}
                  <button type="button" onClick={() => setSelectedCategory("all")} className="hover:text-red-500">
                    ✕
                  </button>
                </span>
              )}
              {selectedPhase !== "all" && (
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  工程: {selectedPhase}
                  <button type="button" onClick={() => setSelectedPhase("all")} className="hover:text-red-500">
                    ✕
                  </button>
                </span>
              )}
              {selectedCrop !== "all" && (
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  作物: {selectedCrop}
                  <button type="button" onClick={() => setSelectedCrop("all")} className="hover:text-red-500">
                    ✕
                  </button>
                </span>
              )}
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-gray-500 hover:text-red-600 font-bold underline cursor-pointer"
              >
                すべての絞り込みを解除
              </button>
            )}
          </div>

          {/* テンプレートカード一覧 */}
          {filteredAndSortedTemplates.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border app-border space-y-3">
              <span className="text-4xl">🔍</span>
              <h3 className="font-black text-gray-800 text-base">該当するテンプレートが見つかりませんでした</h3>
              <p className="text-xs text-gray-500 font-medium max-w-md mx-auto">
                条件を変更するか、右上の「条件リセット」を押してすべてのテンプレートを表示してください。
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-xs hover:bg-emerald-700 transition cursor-pointer"
              >
                フィルターを初期化する
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredAndSortedTemplates.map((tpl) => {
                const isOfficial = tpl.id.startsWith("tpl_");
                return (
                  <div
                    key={tpl.id}
                    className="app-bg-card rounded-3xl p-6 border app-border shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isOfficial
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            {isOfficial ? "公式" : "カスタム"}
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                            {tpl.category} • 想定{tpl.estimated_time}
                          </span>
                          {tpl.season && (
                            <span className="bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                              {tpl.season}
                            </span>
                          )}
                          {tpl.timing && (
                            <span className="bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                              📅 {tpl.timing}
                            </span>
                          )}
                          {tpl.badge_name && (
                            <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                              {tpl.badge_icon} {tpl.badge_name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-gray-400">+{tpl.exp} EXP</span>
                      </div>

                      <h3 className="font-extrabold text-gray-900 text-base leading-snug">{tpl.title}</h3>
                      <p className="text-xs text-gray-500 font-semibold flex flex-wrap gap-x-2">
                        <span>
                          🌱 対象作物: {tpl.target_crop}
                          {tpl.variety && (
                            <span className="text-emerald-700 ml-1 font-bold">（{tpl.variety}）</span>
                          )}
                        </span>
                        <span>|</span>
                        <span>🛠️ 道具: {tpl.tools_needed}</span>
                        {tpl.phase && (
                          <>
                            <span>|</span>
                            <span>工程: {tpl.phase}</span>
                          </>
                        )}
                      </p>

                      <div className="text-xs text-gray-700 bg-gray-50/80 p-4 rounded-2xl border app-border whitespace-pre-wrap leading-relaxed font-medium">
                        {tpl.description}
                      </div>

                      {tpl.memo && (
                        <div className="text-[11px] text-amber-950 bg-amber-50/70 p-3 rounded-2xl border border-amber-200/60 leading-relaxed font-medium">
                          <span className="font-bold">💡 師匠のメモ: </span>
                          {tpl.memo}
                          {tpl.source && (
                            <span className="block text-[10px] text-amber-800/80 mt-1 font-semibold">
                              出典: {tpl.source}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 下部アクションバー */}
                    <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        {/* 🌟 生徒視点プレビューボタン 🌟 */}
                        <button
                          type="button"
                          onClick={() => setPreviewTemplate(tpl)}
                          className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl transition flex items-center space-x-1 cursor-pointer"
                          title="生徒がスマホでこのタスクを受け取った時の画面を表示します"
                        >
                          <span>👀 生徒視点プレビュー</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddToTasks(tpl)}
                          disabled={addingId === tpl.id}
                          className="px-3.5 py-2 app-accent-btn font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          <span>{addingId === tpl.id ? "追加中..." : "＋ 教材/タスクに追加"}</span>
                        </button>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isOfficial ? (
                          <button
                            type="button"
                            onClick={() => handleDuplicateOfficial(tpl)}
                            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition flex items-center space-x-1 cursor-pointer"
                            title="この公式テンプレートをコピーして新しいカスタムテンプレートを作ります"
                          >
                            <span>📋 複製して編集</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTemplate({ ...tpl });
                                setIsCreatingNew(false);
                              }}
                              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              ✏️ 編集
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(tpl.id, tpl.title)}
                              className="px-2.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              🗑 削除
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ────────────── モバイル用 フィルタードロワーモーダル ────────────── */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-900 text-base flex items-center gap-1.5">
                <span>🌪️</span>
                <span>絞り込みフィルター</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {renderSidebarFilters()}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-full py-3 app-accent-btn font-black text-xs rounded-xl shadow-md transition"
              >
                この条件で表示する ({filteredAndSortedTemplates.length}件)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────── 編集・新規作成モーダル ────────────── */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-900 text-base">
                {isCreatingNew ? "📝 新しいタスクテンプレートを作成" : "✏️ テンプレートの編集"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">テンプレートタイトル (必須)</label>
                <input
                  type="text"
                  required
                  value={editingTemplate.title}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 text-sm font-bold focus:bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">カテゴリ</label>
                  <select
                    value={editingTemplate.category}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="果菜">果菜 (トマト等)</option>
                    <option value="根菜">根菜 (ジャガイモ等)</option>
                    <option value="葉菜">葉菜 (コマツナ等)</option>
                    <option value="共通">共通・農園管理</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">シーズン</label>
                  <select
                    value={editingTemplate.season || "春夏"}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, season: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="春夏">🌸☀️ 春夏</option>
                    <option value="秋冬">🍂❄️ 秋冬</option>
                    <option value="通年">🔄 通年</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">作業工程</label>
                  <select
                    value={editingTemplate.phase || "準備・植付"}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, phase: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="準備・植付">🌱 1. 準備・植付</option>
                    <option value="育成・管理">✂️ 2. 育成・管理</option>
                    <option value="収穫・片付け">🧺 3. 収穫・片付け</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">対象作物</label>
                  <input
                    type="text"
                    value={editingTemplate.target_crop}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, target_crop: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">代表品種 (任意)</label>
                <input
                  type="text"
                  value={editingTemplate.variety || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, variety: e.target.value })}
                  placeholder="例: 千果、アイコ など"
                  className="w-full p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">想定作業時間</label>
                  <input
                    type="text"
                    value={editingTemplate.estimated_time}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, estimated_time: e.target.value })}
                    className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="例: 30分"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">実施目安時期 (任意)</label>
                  <input
                    type="text"
                    value={editingTemplate.timing || ""}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, timing: e.target.value })}
                    className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="例: 5月上旬〜中旬"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">必要な道具</label>
                <input
                  type="text"
                  value={editingTemplate.tools_needed}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, tools_needed: e.target.value })}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="例: 軍手, ハサミ, 支柱"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">作業の手順・チェックリスト (1行に1つ)</label>
                <textarea
                  rows={4}
                  value={editingTemplate.description}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 resize-none font-medium focus:bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">師匠からのアドバイス・補足メモ (任意)</label>
                <textarea
                  rows={3}
                  value={editingTemplate.memo || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, memo: e.target.value })}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 resize-none font-medium focus:bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="現場の知恵や失敗しないコツを記入..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">難易度 (1〜5)</label>
                  <select
                    value={editingTemplate.difficulty}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, difficulty: parseInt(e.target.value) || 1 })}
                    className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white outline-none"
                  >
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        {level} {level === 1 ? "(簡単)" : level === 5 ? "(難しい)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">獲得EXP</label>
                  <input
                    type="number"
                    min="0"
                    value={editingTemplate.exp}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, exp: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white outline-none"
                  />
                </div>

                <div className="flex flex-col justify-center mt-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTemplate.require_photo}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, require_photo: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                    />
                    <span className="text-gray-700 font-bold text-xs">写真提出必須</span>
                  </label>
                </div>
              </div>

              {/* 獲得バッジ設定 */}
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-3">
                <div className="flex items-center space-x-2">
                  <span>🏆</span>
                  <span className="text-amber-900 font-bold">達成時獲得バッジ設定</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-amber-800 mb-1">バッジアイコン</label>
                    <input
                      type="text"
                      value={editingTemplate.badge_icon || ""}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, badge_icon: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-center font-bold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] text-amber-800 mb-1">獲得バッジ名</label>
                    <input
                      type="text"
                      value={editingTemplate.badge_name || ""}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, badge_name: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 app-accent-btn font-bold rounded-xl shadow transition active:scale-95 cursor-pointer"
                >
                  テンプレートを保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
