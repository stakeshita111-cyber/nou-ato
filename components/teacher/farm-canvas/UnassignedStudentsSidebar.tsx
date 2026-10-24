'use client';

import React, { useState } from 'react';
import { UnassignedStudent } from '@/hooks/farm/useStudentDrag';

export interface UnassignedStudentsSidebarProps {
  unassignedList: UnassignedStudent[];
  draggingStudent: UnassignedStudent | null;
  onDragStart: (student: UnassignedStudent) => void;
  onDragEnd: () => void;
  onAssignAll: () => void;
}

export default function UnassignedStudentsSidebar({
  unassignedList,
  draggingStudent,
  onDragStart,
  onDragEnd,
  onAssignAll,
}: UnassignedStudentsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // 検索フィルター
  const filteredStudents = unassignedList.filter(
    (s) => s.name.includes(searchQuery) || s.grade.includes(searchQuery)
  );

  return (
    <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-gray-900 flex items-center gap-1.5">
            <span>🧑‍🌾</span>
            <span>未割り当て受講生</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {unassignedList.length} 名
            </span>
          </span>
          <span className="text-[10px] text-gray-500 font-normal">
            ※カードをマスにドラッグして割り当て。マス同士をドラッグ＆ドロップすると区画データを相互入れ替えできます
          </span>
        </div>
        <div className="flex items-center gap-2">
          {unassignedList.length > 0 && (
            <button
              type="button"
              onClick={onAssignAll}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <span>⚡</span>
              <span>空き区画へ一括割り当て</span>
            </button>
          )}
          {unassignedList.length > 5 && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="受講生を検索..."
              className="text-xs border border-gray-200 rounded-xl px-2.5 py-1 w-36 focus:outline-emerald-500"
            />
          )}
        </div>
      </div>

      {filteredStudents.length > 0 ? (
        <div className="flex flex-wrap gap-2 items-center">
          {filteredStudents.map((student) => (
            <div
              key={student.id}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/json', JSON.stringify(student));
                e.dataTransfer.effectAllowed = 'copyMove';
                onDragStart(student);
              }}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-xs transition cursor-grab active:cursor-grabbing select-none ${
                draggingStudent?.id === student.id ? 'opacity-40 ring-2 ring-emerald-500' : ''
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${student.colorBg}`}
              >
                {student.initials}
              </div>
              <span className="text-xs font-bold text-gray-800">{student.name}</span>
              <span className="text-[9px] bg-white border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded-md font-bold">
                {student.grade}
              </span>
              <span className="text-[10px] text-gray-400">⠿</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-400 py-1 font-medium">
          {unassignedList.length === 0
            ? '✨ すべての受講生が畑の区画に割り当てられています。'
            : '検索条件に一致する受講生はいません。'}
        </div>
      )}
    </div>
  );
}
