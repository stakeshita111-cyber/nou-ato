"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";

interface PaymentRecord {
  id: string;
  studentName: string;
  plot: string;
  itemTitle: string; // 請求項目
  amount: number;
  dueDate: string;
  status: "paid" | "unpaid" | "reminded";
  method: "credit_card" | "line_pay" | "cash";
}

export default function TeacherPaymentsView() {
  const [payments, setPayments] = useState<PaymentRecord[]>([
    {
      id: "p1",
      studentName: "佐藤 健太",
      plot: "区画 1",
      itemTitle: "月額農園利用料 (5月分) + 夏野菜資材代",
      amount: 12800,
      dueDate: "2026-05-25",
      status: "paid",
      method: "credit_card",
    },
    {
      id: "p2",
      studentName: "高橋 美咲",
      plot: "区画 2",
      itemTitle: "月額農園利用料 (5月分)",
      amount: 9800,
      dueDate: "2026-05-25",
      status: "unpaid",
      method: "line_pay",
    },
    {
      id: "p3",
      studentName: "伊藤 大輝",
      plot: "区画 3",
      itemTitle: "月額農園利用料 (5月分) + 収穫体験イベント参加費",
      amount: 14800,
      dueDate: "2026-05-25",
      status: "paid",
      method: "credit_card",
    },
    {
      id: "p4",
      studentName: "渡辺 陸",
      plot: "区画 4",
      itemTitle: "月額農園利用料 (5月分)",
      amount: 9800,
      dueDate: "2026-05-25",
      status: "reminded",
      method: "cash",
    },
  ]);

  const [filter, setFilter] = useState<"all" | "unpaid">("all");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // ----------------------------------------------------
  // 📊 収支シミュレーション用ステート (生徒数×年間受講料 - 経費 - システム利用料(1%))
  // ----------------------------------------------------
  const [studentCount, setStudentCount] = useState<number>(4); // DBから自動計算
  const [annualTuitionFee, setAnnualTuitionFee] = useState<number>(120000); // 手動設定 (年間12万円/人)
  const [annualExpenses, setAnnualExpenses] = useState<number>(150000); // 手動設定 (年間経費15万円)

  // Supabase から実際の生徒数を自動取得
  useEffect(() => {
    const fetchStudentCount = async () => {
      try {
        const { count } = await supabase
          .from("users")
          .select("*", { count: "exact" })
          .eq("role", "student");

        if (count && count > 0) {
          setStudentCount(count);
        }
      } catch (err) {
        console.error("fetchStudentCount error:", err);
      }
    };
    fetchStudentCount();
  }, []);

  // シミュレーション自動計算ロジック
  const grossRevenue = studentCount * annualTuitionFee; // 収入 (生徒数 × 年間受講料)
  const systemFee = Math.round(grossRevenue * 0.01); // システム利用料 (収入の1%で仮置き)
  const netProfit = grossRevenue - annualExpenses - systemFee; // 利益 (収入 - 経費 - システム利用料)

  // 現行実績のサマリー計算
  const totalRevenue = payments.reduce((acc, cur) => acc + cur.amount, 0);
  const paidRevenue = payments
    .filter((p) => p.status === "paid")
    .reduce((acc, cur) => acc + cur.amount, 0);
  const unpaidRevenue = totalRevenue - paidRevenue;
  const collectionRate = totalRevenue > 0 ? Math.round((paidRevenue / totalRevenue) * 100) : 0;

  // 支払い催促LINE送信
  const handleSendRemind = (id: string, studentName: string) => {
    setPayments(
      payments.map((p) => (p.id === id ? { ...p, status: "reminded" } : p))
    );
    setToastMessage(`📱 ${studentName} さんへLINEで未払い利用料の催促メッセージを送信しました`);
    setShowToast(true);
  };

  // 手動で支払済みに変更
  const handleMarkAsPaid = (id: string, studentName: string) => {
    setPayments(
      payments.map((p) => (p.id === id ? { ...p, status: "paid" } : p))
    );
    setToastMessage(`✅ ${studentName} さんの支払いを「支払済み」に更新しました`);
    setShowToast(true);
  };

  const filteredPayments = payments.filter((p) => {
    if (filter === "unpaid") return p.status !== "paid";
    return true;
  });

  return (
    <div className="space-y-8 animate-fade-in text-gray-800 font-sans">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div>
        <h2 className="text-2xl font-black text-gray-900">💳 集金・月額会費・売上管理</h2>
        <p className="text-xs text-gray-500 mt-1">
          受講生の月額区画料・資材代の決済状況、LINE催促、月次収支シミュレーションを一括管理します。
        </p>
      </div>

      {/* 🌟 1. 収支・利益シミュレーター (ご指定の計算式) 🌟 */}
      <div className="bg-white p-6 rounded-3xl border border-emerald-900/10 shadow-lg space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-black text-emerald-950 flex items-center gap-2">
              <span>📊 収支・利益シミュレーター</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                試算ツール
              </span>
            </h3>
            <p className="text-xs text-gray-500 font-bold mt-0.5">
              計算式: [生徒数 (自動)] × [年間受講料] － [経費] － [システム利用料 (収入の1%)]
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-gray-400 block">現在の登録生徒数</span>
            <span className="text-xl font-black text-emerald-800">{studentCount} 名</span>
          </div>
        </div>

        {/* シミュレーション入力コントロール */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/60">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              ① 生徒数（DB自動計算）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={studentCount}
                onChange={(e) => setStudentCount(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <span className="text-xs font-bold text-gray-600 shrink-0">名</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              ② 年間受講料 (1人あたり / 手動)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step={1000}
                value={annualTuitionFee}
                onChange={(e) => setAnnualTuitionFee(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <span className="text-xs font-bold text-gray-600 shrink-0">円/年</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              ③ 年間経費（資材・肥料等 / 手動）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step={5000}
                value={annualExpenses}
                onChange={(e) => setAnnualExpenses(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <span className="text-xs font-bold text-gray-600 shrink-0">円/年</span>
            </div>
          </div>
        </div>

        {/* 🌟 試算結果の視覚的グラフ表示 (総収入構成 ＆ 収支比較) 🌟 */}
        {grossRevenue > 0 && (
          <div className="space-y-4 pt-2">
            {/* 1. 総収入の構造内訳プログレス・バーグラフ */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-gray-900 font-black flex items-center gap-1.5">
                  <span>📈 収支内訳比率グラフ (想定総収入: ¥{grossRevenue.toLocaleString()})</span>
                </span>
                <span className="text-emerald-800 font-black bg-emerald-100 px-2.5 py-0.5 rounded-md">
                  純利益率: {grossRevenue > 0 ? Math.round((Math.max(0, netProfit) / grossRevenue) * 100) : 0}%
                </span>
              </div>

              {/* 積み上げバーグラフ */}
              <div className="w-full h-7 bg-gray-200 rounded-xl overflow-hidden flex shadow-inner">
                {netProfit > 0 && (
                  <div 
                    style={{ width: `${(netProfit / grossRevenue) * 100}%` }}
                    className="bg-emerald-600 h-full flex items-center justify-center text-[10px] font-black text-white px-1 transition-all duration-500 overflow-hidden"
                    title={`純利益: ¥${netProfit.toLocaleString()}`}
                  >
                    {Math.round((netProfit / grossRevenue) * 100)}% 純利益
                  </div>
                )}
                {annualExpenses > 0 && (
                  <div 
                    style={{ width: `${(annualExpenses / grossRevenue) * 100}%` }}
                    className="bg-slate-600 h-full flex items-center justify-center text-[10px] font-black text-white px-1 transition-all duration-500 overflow-hidden"
                    title={`年間経費: ¥${annualExpenses.toLocaleString()}`}
                  >
                    {Math.round((annualExpenses / grossRevenue) * 100)}% 経費
                  </div>
                )}
                {systemFee > 0 && (
                  <div 
                    style={{ width: `${(systemFee / grossRevenue) * 100}%` }}
                    className="bg-amber-500 h-full flex items-center justify-center text-[10px] font-black text-white px-1 transition-all duration-500 overflow-hidden"
                    title={`システム利用料: ¥${systemFee.toLocaleString()}`}
                  >
                    1%
                  </div>
                )}
              </div>

              {/* グラフ凡例 */}
              <div className="flex flex-wrap items-center justify-between text-[11px] font-bold text-gray-600 pt-1">
                <span className="flex items-center gap-1 text-emerald-900">
                  <span className="w-3 h-3 bg-emerald-600 rounded-sm inline-block" />
                  🌟 手取り純利益: <strong>¥{netProfit.toLocaleString()}</strong>
                </span>
                <span className="flex items-center gap-1 text-slate-800">
                  <span className="w-3 h-3 bg-slate-600 rounded-sm inline-block" />
                  🛠️ 想定経費: <strong>¥{annualExpenses.toLocaleString()}</strong>
                </span>
                <span className="flex items-center gap-1 text-amber-900">
                  <span className="w-3 h-3 bg-amber-500 rounded-sm inline-block" />
                  ⚡ システム手数料(1%): <strong>¥{systemFee.toLocaleString()}</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 試算結果数値カード表示 (4区分) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-1">
            <span className="text-[11px] font-bold text-gray-500 block">💰 年間想定総収入</span>
            <span className="text-2xl font-black text-gray-900">¥{grossRevenue.toLocaleString()}</span>
            <span className="text-[10px] text-gray-400 font-medium block">
              {studentCount}名 × ¥{annualTuitionFee.toLocaleString()}
            </span>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-1">
            <span className="text-[11px] font-bold text-gray-500 block">🛠️ 年間想定経費</span>
            <span className="text-2xl font-black text-gray-700">¥{annualExpenses.toLocaleString()}</span>
            <span className="text-[10px] text-gray-400 font-medium block">手動設定分</span>
          </div>

          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-1">
            <span className="text-[11px] font-bold text-amber-900 block">⚡ システム利用料 (1%)</span>
            <span className="text-2xl font-black text-amber-900">¥{systemFee.toLocaleString()}</span>
            <span className="text-[10px] text-amber-700 font-medium block">総収入の 1.0% 仮設定</span>
          </div>

          <div className="bg-emerald-800 text-white p-4 rounded-2xl shadow-md space-y-1">
            <span className="text-[11px] font-bold text-emerald-200 block">🌟 年間手取り想定純利益</span>
            <span className="text-2xl font-black text-white">¥{netProfit.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-100 font-medium block">
              月換算: 約 ¥{Math.round(netProfit / 12).toLocaleString()}/月
            </span>
          </div>
        </div>
      </div>

      {/* 2. 現行実績の売上サマリーカード (4分割) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-gray-500 block">今月の総請求額</span>
          <span className="text-2xl font-black text-gray-900">¥{totalRevenue.toLocaleString()}</span>
          <span className="text-[10px] text-gray-400 block">全 {payments.length} 件の請求</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-green-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-[#2e7d32] block">回収済み入金額</span>
          <span className="text-2xl font-black text-[#2e7d32]">¥{paidRevenue.toLocaleString()}</span>
          <span className="text-[10px] text-green-700 font-bold block">回収率 {collectionRate}%</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-red-600 block">未回収・未払い金</span>
          <span className="text-2xl font-black text-red-600">¥{unpaidRevenue.toLocaleString()}</span>
          <span className="text-[10px] text-red-500 font-bold block">
            {payments.filter((p) => p.status !== "paid").length} 件 未完了
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-1 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-500 block">決済方式割合</span>
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-700">
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">クレカ 50%</span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">LINE 25%</span>
          </div>
        </div>
      </div>

      {/* 3. 集金・決済明細テーブル */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">📋 月次請求・集金ステータス一覧</h3>

          {/* フィルタータブ */}
          <div className="bg-gray-100 p-1 rounded-xl flex text-xs font-bold space-x-1">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition ${filter === "all" ? "bg-white text-gray-900 shadow-xs font-black" : "text-gray-500"}`}
            >
              全員 ({payments.length})
            </button>
            <button
              onClick={() => setFilter("unpaid")}
              className={`px-3 py-1.5 rounded-lg transition ${filter === "unpaid" ? "bg-white text-gray-900 shadow-xs font-black" : "text-gray-500"}`}
            >
              未払いのみ ({payments.filter((p) => p.status !== "paid").length})
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-4 px-6">受講生 / 区画</th>
                <th className="py-4 px-6">請求内容</th>
                <th className="py-4 px-6">請求金額</th>
                <th className="py-4 px-6">決済方法</th>
                <th className="py-4 px-6">ステータス</th>
                <th className="py-4 px-6 text-right">操作・催促</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredPayments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/80 transition">
                  <td className="py-4 px-6">
                    <div className="font-bold text-gray-900">{p.studentName}</div>
                    <span className="text-xs text-gray-400 font-medium">{p.plot}</span>
                  </td>

                  <td className="py-4 px-6 text-xs text-gray-700 font-semibold">
                    {p.itemTitle}
                  </td>

                  <td className="py-4 px-6 font-extrabold text-gray-900">
                    ¥{p.amount.toLocaleString()}
                  </td>

                  <td className="py-4 px-6 text-xs">
                    {p.method === "credit_card" && (
                      <span className="bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-lg border border-blue-100">
                        💳 クレジットカード
                      </span>
                    )}
                    {p.method === "line_pay" && (
                      <span className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-lg border border-emerald-100">
                        🟢 LINE Pay
                      </span>
                    )}
                    {p.method === "cash" && (
                      <span className="bg-amber-50 text-amber-700 font-bold px-2.5 py-1 rounded-lg border border-amber-100">
                        💴 現金手渡し
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-6 text-xs">
                    {p.status === "paid" && (
                      <span className="bg-green-100 text-[#2e7d32] font-bold px-2.5 py-1 rounded-full border border-green-200">
                        ✓ 支払済み
                      </span>
                    )}
                    {p.status === "unpaid" && (
                      <span className="bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-full border border-red-200 animate-pulse">
                        ⚠️ 未払い
                      </span>
                    )}
                    {p.status === "reminded" && (
                      <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full border border-amber-200">
                        💬 催促送信済み
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-6 text-right space-x-2">
                    {p.status !== "paid" ? (
                      <>
                        <button
                          onClick={() => handleSendRemind(p.id, p.studentName)}
                          className="px-3 py-1.5 bg-green-50 text-[#2e7d32] border border-green-200 font-bold text-xs rounded-lg hover:bg-green-100 transition"
                        >
                          📱 LINE催促
                        </button>
                        <button
                          onClick={() => handleMarkAsPaid(p.id, p.studentName)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg transition"
                        >
                          済みにする
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">完了</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
