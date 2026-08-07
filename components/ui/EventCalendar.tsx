"use client";

import { useState } from "react";
import { EventItem } from "@/types/event";

interface EventCalendarProps {
  events: EventItem[];
  mode: "teacher" | "student";
  studentName?: string;
  onSelectEvent?: (event: EventItem) => void;
  onReserveEvent?: (eventId: string) => void;
  onApproveAttendee?: (eventId: string, attendeeName: string) => void;
  onAddNewEventClick?: (dateStr: string) => void;
}

export default function EventCalendar({
  events,
  mode,
  studentName,
  onSelectEvent,
  onReserveEvent,
  onApproveAttendee,
  onAddNewEventClick,
}: EventCalendarProps) {
  // 表示年月の State (初期値: 2026年5月)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(5); // 1-indexed (5月)
  const [selectedDateStr, setSelectedDateStr] = useState<string>("2026-05-24");

  // 月変更操作
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 月の日数を計算
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0: 日曜日

  // 日付マス目生成
  const calendarCells = [];
  // 前月埋め
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push({ day: null, dateStr: "" });
  }
  // 今月日
  for (let d = 1; d <= daysInMonth; d++) {
    const dayFormatted = String(d).padStart(2, "0");
    const monthFormatted = String(currentMonth).padStart(2, "0");
    const dateStr = `${currentYear}-${monthFormatted}-${dayFormatted}`;
    calendarCells.push({ day: d, dateStr });
  }

  // 選択日のイベントリスト
  const selectedDateEvents = events.filter((e) => e.date === selectedDateStr);

  return (
    <div className="space-y-6">
      {/* 1. Googleカレンダー風 ヘッダーコントロール */}
      <div className="app-bg-card p-4 rounded-3xl border app-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <h3 className="text-xl font-black text-gray-900 tracking-tight">
            📅 {currentYear}年 {currentMonth}月
          </h3>
          <span className="bg-blue-100 text-blue-900 font-extrabold text-xs px-2.5 py-0.5 rounded-full border border-blue-200">
            Googleカレンダー風 View
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevMonth}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition"
          >
            ◀ 前月
          </button>
          <button
            onClick={() => {
              setCurrentYear(2026);
              setCurrentMonth(5);
              setSelectedDateStr("2026-05-24");
            }}
            className="px-3.5 py-1.5 app-accent-btn font-bold text-xs rounded-xl shadow-xs transition"
          >
            今月に戻る
          </button>
          <button
            onClick={handleNextMonth}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition"
          >
            次月 ▶
          </button>
        </div>
      </div>

      {/* 2. 7列 カレンダーグリッド */}
      <div className="app-bg-card rounded-3xl border app-border shadow-sm overflow-hidden p-4 space-y-2">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 text-center font-bold text-xs py-2 border-b border-gray-100">
          <span className="text-red-500">日</span>
          <span className="text-gray-700">月</span>
          <span className="text-gray-700">火</span>
          <span className="text-gray-700">水</span>
          <span className="text-gray-700">木</span>
          <span className="text-gray-700">金</span>
          <span className="text-blue-600">土</span>
        </div>

        {/* グリッドセル */}
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (!cell.day) {
              return <div key={`empty_${idx}`} className="h-20 sm:h-24 bg-gray-50/50 rounded-2xl"></div>;
            }

            const dayEvents = events.filter((e) => e.date === cell.dateStr);
            const isSelected = selectedDateStr === cell.dateStr;
            const isSunday = (idx % 7) === 0;
            const isSaturday = (idx % 7) === 6;

            return (
              <div
                key={cell.dateStr}
                onClick={() => setSelectedDateStr(cell.dateStr)}
                className={`h-20 sm:h-24 p-1.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between overflow-hidden ${
                  isSelected
                    ? "border-2 border-emerald-600 bg-emerald-50/60 shadow-md ring-2 ring-emerald-300"
                    : "border-gray-200 hover:border-gray-400 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-black text-xs ${
                      isSunday ? "text-red-500" : isSaturday ? "text-blue-600" : "text-gray-900"
                    }`}
                  >
                    {cell.day}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  )}
                </div>

                {/* セル内のイベントチップ */}
                <div className="space-y-1 overflow-hidden">
                  {dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="bg-amber-100 text-amber-900 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md truncate border border-amber-200 shadow-2xs"
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 選択した日付のイベントカード表示 ＆ アクション */}
      <div className="app-bg-card rounded-3xl p-6 border app-border shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-base">📅</span>
            <h4 className="font-extrabold text-gray-900 text-sm">
              選択日: {selectedDateStr} のイベント ({selectedDateEvents.length}件)
            </h4>
          </div>

          {mode === "teacher" && onAddNewEventClick && (
            <button
              onClick={() => onAddNewEventClick(selectedDateStr)}
              className="px-3.5 py-1.5 app-accent-btn font-bold text-xs rounded-xl shadow-xs transition"
            >
              ＋ この日にイベントを追加
            </button>
          )}
        </div>

        {selectedDateEvents.length === 0 ? (
          <div className="text-center p-6 text-xs text-gray-400 font-medium">
            この日に予定されているイベントはありません。
          </div>
        ) : (
          <div className="space-y-4">
            {selectedDateEvents.map((ev) => {
              const isFull = ev.reservedCount >= ev.capacity;
              const hasAlreadyReserved =
                studentName && ev.attendees.some((a) => a.name === studentName);

              return (
                <div key={ev.id} className="bg-gray-50/80 p-5 rounded-2xl border border-gray-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
                    <div>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                        {ev.time}
                      </span>
                      <h5 className="font-black text-gray-900 text-base mt-1">{ev.title}</h5>
                      <p className="text-xs text-gray-500">📍 場所: {ev.location} • 参加費: {ev.fee}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-gray-700 block">
                        予約: <b className="text-emerald-700">{ev.reservedCount}</b> / {ev.capacity} 名
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {isFull ? "満員御礼" : `残り ${ev.capacity - ev.reservedCount} 枠`}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-700 font-medium leading-relaxed">{ev.description}</p>

                  {/* 講師モード: 参加承認表示 */}
                  {mode === "teacher" && (
                    <div className="pt-2 border-t border-gray-200 space-y-2">
                      <span className="text-[11px] font-bold text-gray-700 block">👥 参加申し込み状況:</span>
                      <div className="flex flex-wrap gap-2">
                        {ev.attendees.map((at, i) => (
                          <div key={i} className="bg-white px-3 py-1.5 rounded-xl border border-gray-200 text-xs flex items-center space-x-2">
                            <span className="font-bold text-gray-900">{at.name} ({at.plot})</span>
                            {at.status === "confirmed" ? (
                              <span className="bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.2 rounded">確定</span>
                            ) : (
                              <button
                                onClick={() => onApproveAttendee && onApproveAttendee(ev.id, at.name)}
                                className="app-accent-btn text-[10px] font-bold px-2 py-0.5 rounded shadow-2xs"
                              >
                                承認
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 生徒モード: 参加予約ボタン連動 */}
                  {mode === "student" && (
                    <div className="pt-2 flex justify-end">
                      {hasAlreadyReserved ? (
                        <span className="bg-green-100 text-[#2e7d32] border border-green-300 font-bold text-xs px-4 py-2 rounded-xl">
                          ✓ 予約申し込み済み (承認待ち)
                        </span>
                      ) : isFull ? (
                        <span className="bg-gray-100 text-gray-400 font-bold text-xs px-4 py-2 rounded-xl">
                          満員のため予約受付終了
                        </span>
                      ) : (
                        <button
                          onClick={() => onReserveEvent && onReserveEvent(ev.id)}
                          className="px-5 py-2.5 app-accent-btn font-bold text-xs rounded-xl shadow-md transition active:scale-95 flex items-center space-x-1"
                        >
                          <span>🙋‍♂️ このイベントに参加予約する</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
