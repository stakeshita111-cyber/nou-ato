"use client";

import { useState } from "react";
import Toast from "@/components/ui/Toast";
import EventCalendar from "@/components/ui/EventCalendar";
import { useEvents } from "@/hooks/useEvents";

export default function TeacherEventsView() {
  const { events, addEvent, approveAttendee } = useEvents();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("2026-05-24");
  const [newTime, setNewTime] = useState("10:00 - 12:30");
  const [newCapacity, setNewCapacity] = useState(10);
  const [newDescription, setNewDescription] = useState("");

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // カレンダーの日付から直接追加モーダルを開く
  const handleOpenAddModalForDate = (dateStr: string) => {
    setNewDate(dateStr);
    setShowAddModal(true);
  };

  // 新規イベント登録 (生徒画面へ即時共有連動)
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate.trim()) return;

    await addEvent({
      title: newTitle,
      date: newDate,
      dateDisplay: `${newDate} 開催`,
      time: newTime,
      location: "たなか自然農園 A区画メインエリア",
      capacity: newCapacity,
      fee: "無料 (受講生特典)",
      category: "harvest",
      description: newDescription || "農園での体験イベントです。",
    });

    setShowAddModal(false);
    setNewTitle("");
    setNewDescription("");
    setToastMessage("📅 カレンダーに新しいイベントを登録し、生徒画面へ即時共有しました！");
    setShowToast(true);
  };

  // 予約承認
  const handleApprove = async (eventId: string, attendeeName: string) => {
    await approveAttendee(eventId, attendeeName);
    setToastMessage(`✅ ${attendeeName} さんのイベント参加予約を承認確定しました`);
    setShowToast(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900">📅 カレンダー予約 ＆ イベント管理</h2>
          <p className="text-xs text-gray-500 mt-1">
            Googleカレンダー風ビューでイベントを管理し、登録したイベントは生徒受講画面とリアルタイム共有されます。
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-3 app-accent-btn font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-1.5"
        >
          <span className="text-base leading-none">＋</span>
          <span>新しいイベントをカレンダーに登録</span>
        </button>
      </div>

      {/* Googleカレンダー風ビューコンポーネント (講師モード) */}
      <EventCalendar
        events={events}
        mode="teacher"
        onApproveAttendee={handleApprove}
        onAddNewEventClick={handleOpenAddModalForDate}
      />

      {/* 新規イベント登録モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-gray-800">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-gray-900 text-base">🎉 カレンダーにイベントを登録 (生徒共有)</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-gray-700 mb-1">イベントタイトル *</label>
                <input
                  type="text"
                  required
                  placeholder="例: 🥔 夏野菜の剪定・仕立て講習会"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1">開催日付 (YYYY-MM-DD) *</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1">募集定員 (名)</label>
                  <input
                    type="number"
                    min="1"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(Number(e.target.value))}
                    className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">開催時間帯</label>
                <input
                  type="text"
                  placeholder="例: 10:00 - 12:00"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">イベント詳細・持ち物説明</label>
                <textarea
                  rows={3}
                  placeholder="イベントの内容や持ち物を入力..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 resize-none font-medium"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 app-accent-btn font-bold rounded-xl shadow"
                >
                  カレンダーに登録して共有
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
