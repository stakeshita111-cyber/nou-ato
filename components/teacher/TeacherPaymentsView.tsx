"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Toast from "@/components/ui/Toast";

interface PaymentRecord {
  id: string;
  studentName: string;
  plot: string;
  itemTitle: string; // 請求項目 (月額区画料, 資材セット代等)
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

  // サマリー計算
  const totalRevenue = payments.reduce((acc, cur) => acc + cur.amount, 0);
  const paidRevenue = payments
    .filter((p) => p.status === "paid")
    .reduce((acc, cur) => acc + cur.amount, 0);
  const unpaidRevenue = totalRevenue - paidRevenue;
  const collectionRate = Math.round((paidRevenue / totalRevenue) * 100);

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
    <div className="space-y-6 animate-fade-in">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div>
        <h2 className="text-2xl font-black text-gray-900">💳 集金・月額会費・売上管理</h2>
        <p className="text-xs text-gray-500 mt-1">
          受講生の月額区画料・資材代の決済状況、LINE督促通知、月次売上の回収率をリアルタイムに一括管理します。
        </p>
      </div>

      {/* 1. 売上サマリーカード (4分割) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="app-bg-card p-5 rounded-2xl border app-border shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-gray-500 block">今月の総請求額</span>
          <span className="text-2xl font-black text-gray-900">¥{totalRevenue.toLocaleString()}</span>
          <span className="text-[10px] text-gray-400 block">全 {payments.length} 件の請求</span>
        </div>

        <div className="app-bg-card p-5 rounded-2xl border border-green-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-[#2e7d32] block">回収済み入金額</span>
          <span className="text-2xl font-black text-[#2e7d32]">¥{paidRevenue.toLocaleString()}</span>
          <span className="text-[10px] text-green-700 font-bold block">回収率 {collectionRate}%</span>
        </div>

        <div className="app-bg-card p-5 rounded-2xl border border-red-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-red-600 block">未回収・未払い金</span>
          <span className="text-2xl font-black text-red-600">¥{unpaidRevenue.toLocaleString()}</span>
          <span className="text-[10px] text-red-500 font-bold block">
            {payments.filter((p) => p.status !== "paid").length} 件 未完了
          </span>
        </div>

        <div className="app-bg-card p-5 rounded-2xl border app-border shadow-xs space-y-1 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-500 block">決済方式割合</span>
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-700">
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">クレカ 50%</span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">LINE 25%</span>
          </div>
        </div>
      </div>

      {/* 2. 集金・決済明細テーブル */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">📋 月次請求・集金ステータス一覧</h3>

          {/* フィルタータブ */}
          <div className="bg-gray-100 p-1 rounded-xl flex text-xs font-bold space-x-1">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition ${filter === "all" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500"}`}
            >
              全員 ({payments.length})
            </button>
            <button
              onClick={() => setFilter("unpaid")}
              className={`px-3 py-1.5 rounded-lg transition ${filter === "unpaid" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500"}`}
            >
              未払いのみ ({payments.filter((p) => p.status !== "paid").length})
            </button>
          </div>
        </div>

        <div className="app-bg-card rounded-2xl border app-border shadow-sm overflow-hidden">
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
