"use client";

import React, { useState } from "react";
import Sidebar from "@/components/board/Sidebar";
import DashboardHeader from "@/components/board/DashboardHeader";
import PageHeader from "@/components/ui/PageHeader";
import TemplateCard, { Template } from "@/components/templates/TemplateCard";
import TemplateCreateModal from "@/components/templates/TemplateCreateModal";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "tpl-1",
    title: "土壌の酸性度(pH)の測定と基本作業",
    category: "work",
    target_crop: "トマト",
    description: "・土壌測定器を水洗消毒する\n・圃場内の3箇所で深度15cmのpHを計測する\n・測定値を日誌に記録し、6.0〜6.5の適正範囲か確認する",
    tools_needed: "土壌pH計、蒸留水、計測用ノート",
    estimated_time: "20分",
    exp: 15,
    difficulty: 2,
    memo: "雨の直後は測定値がブレやすいため、晴天日の午前中に実施してください。",
  },
  {
    id: "tpl-2",
    title: "水耕栽培の栄養液EC・pH濃度調整",
    category: "work",
    target_crop: "レタス",
    description: "・タンク内のECメーター数値を点検\n・A液・B液を規定倍率で希釈投入\n・攪拌後、10分置いて再計測する",
    tools_needed: "ECメーター、pHメーター、スポイト、養液A/B",
    estimated_time: "30分",
    exp: 20,
    difficulty: 3,
    memo: "温度によってEC値が変動するため、液温20℃前後で調液してください。",
  },
  {
    id: "tpl-3",
    title: "農機具・剪定バサミの消毒チェックリスト",
    category: "work",
    target_crop: "イチゴ",
    description: "・刃についた樹液を金属ブラシで除去\n・70%アルコールスプレーで全面噴霧\n・乾燥後に防錆油を薄く塗布する",
    tools_needed: "剪定バサミ、アルコールスプレー、ワイヤーブラシ、防錆油",
    estimated_time: "15分",
    exp: 10,
    difficulty: 1,
    memo: "病害の媒介を防ぐため株と株の移動時にもアルコール消毒を推奨します。",
  },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();

  // テンプレートから教材ストックへ作成（`tasks` テーブルへ挿入）
  const handleCreateTaskFromTemplate = async (template: Template) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("ログイン情報が取得できませんでした。");
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("farm_id")
        .eq("id", user.id)
        .single();

      if (!userData?.farm_id) {
        alert("所属農園情報がありません。");
        return;
      }

      const { error } = await supabase.from("tasks").insert([
        {
          title: template.title,
          status: "pool",
          category: template.category || "work",
          target_crop: template.target_crop || null,
          description: template.description || null,
          tools_needed: template.tools_needed || null,
          estimated_time: template.estimated_time || null,
          exp: template.exp || 10,
          difficulty: template.difficulty || 1,
          memo: template.memo || null,
          created_by: user.id,
          farm_id: userData.farm_id,
        },
      ]);

      if (error) {
        alert("教材作成に失敗しました: " + error.message);
        return;
      }

      alert(`「${template.title}」を教材ストックに作成しました！`);
      router.push("/board");
    } catch (e) {
      console.error(e);
      alert("例外エラーが発生しました。");
    }
  };

  // 新規テンプレートの追加保存
  const handleSaveNewTemplate = (newTpl: Partial<Template>) => {
    const created: Template = {
      id: `tpl-${Date.now()}`,
      title: newTpl.title || "無題のテンプレート",
      category: "work",
      target_crop: newTpl.target_crop || "",
      description: newTpl.description || "",
      tools_needed: newTpl.tools_needed || "",
      estimated_time: newTpl.estimated_time || "30分",
      exp: newTpl.exp || 15,
      difficulty: newTpl.difficulty || 1,
      memo: newTpl.memo || "",
    };
    setTemplates([created, ...templates]);
    setShowCreateModal(false);
  };

  const filteredTemplates = templates.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.target_crop.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#f8faf7] text-gray-800 font-sans">
      {/* 1. サイドバー（左下にアカウントポータルメニューを統合） */}
      <Sidebar activeMenu="templates" />

      {/* メインエリア */}
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateTaskClick={() => setShowCreateModal(true)}
        />

        <main className="p-8 flex-1 max-w-6xl w-full mx-auto">
          {/* ページタイトルヘッダー */}
          <PageHeader
            icon="📝"
            title="教材テンプレート管理"
            subtitle="頻出する実習手順や講義課題を保存し、ワンクリックで教材ストックへ発行できます。"
            actionButton={
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="bg-[#1b431e] hover:bg-[#153417] text-white text-sm font-bold px-5 py-2.5 rounded-2xl shadow-md transition cursor-pointer flex items-center gap-2 shrink-0"
              >
                <span>+</span>
                <span>新規テンプレート登録</span>
              </button>
            }
          />

          {/* テンプレートカードグリッド（コンポーネント化） */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onCreateTask={handleCreateTaskFromTemplate}
              />
            ))}
          </div>
        </main>
      </div>

      {/* 新規テンプレート登録モーダル（コンポーネント化） */}
      {showCreateModal && (
        <TemplateCreateModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleSaveNewTemplate}
        />
      )}
    </div>
  );
}
