"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/board/Sidebar";
import DashboardHeader from "@/components/board/DashboardHeader";
import PageHeader from "@/components/ui/PageHeader";
import StudentCard, { StudentUser } from "@/components/students/StudentCard";
import { supabase } from "@/lib/supabase";

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
          .from("users")
          .select("farm_id")
          .eq("id", user.id)
          .single();

        if (!userData?.farm_id) return;

        // 同じ農園の受講生（student）を取得
        const { data: studentList, error } = await supabase
          .from("users")
          .select("*")
          .eq("farm_id", userData.farm_id)
          .eq("role", "student");

        if (error) {
          console.error("受講生取得エラー:", error);
          return;
        }

        // 各生徒のタスク進行状況も併せて取得
        const enrichedStudents = await Promise.all(
          (studentList || []).map(async (student) => {
            const { data: stTasks } = await supabase
              .from("student_tasks")
              .select("status")
              .eq("student_id", student.id);

            const total = stTasks?.length || 0;
            const completed = stTasks?.filter((t) => t.status === "completed").length || 0;

            return {
              ...student,
              task_count: total,
              completed_task_count: completed,
            };
          })
        );

        setStudents(enrichedStudents);
      } catch (e) {
        console.error("fetchStudents 例外エラー:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const filteredStudents = students.filter((s) =>
    (s.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#f8faf7] text-gray-800 font-sans">
      {/* 1. サイドバー（左下にアカウントポータルメニューを統合） */}
      <Sidebar activeMenu="students" />

      {/* メインエリア */}
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateTaskClick={() => {}}
        />

        <main className="p-8 flex-1 max-w-6xl w-full mx-auto">
          {/* ページタイトルヘッダー */}
          <PageHeader
            icon="👤"
            title="受講生一覧・学習進捗"
            subtitle="所属農園の受講生メンバーと、現在の配信クエスト消化状況を確認できます。"
          />

          {loading ? (
            <div className="text-center py-12 text-gray-400 font-bold">
              受講生データを読み込み中...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-200/80 shadow-sm">
              <p className="text-4xl mb-3">🌱</p>
              <h3 className="text-lg font-bold text-gray-800 mb-1">受講生がまだ登録されていません</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                ユーザー設定テーブル（`users`）にて `role: 'student'` かつ同じ農園IDが紐付いた受講生が表示されます。
              </p>
            </div>
          ) : (
            /* 受講生カードグリッド（コンポーネント化） */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map((st) => (
                <StudentCard key={st.id} student={st} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
