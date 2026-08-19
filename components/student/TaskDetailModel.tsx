"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import { useFarmManager } from "@/hooks/useFarmManager";

interface TaskDetailModelProps {
  task: any;
  studentName?: string;
  onClose: () => void;
  onComplete?: (id: string, bedId?: string, photoUrl?: string, memo?: string) => void;
}

export default function TaskDetailModel({
  task,
  studentName = "佐藤 健太",
  onClose,
  onComplete,
}: TaskDetailModelProps) {
  const { plots, addCropRecord } = useFarmManager();

  // 生徒自身の割当区画＆畝一覧を取得
  const myPlot = plots.find((p) => p.student_name === studentName || p.student_name?.includes(studentName)) || plots[0];
  const myBeds = myPlot?.beds || [];

  const [selectedBedId, setSelectedBedId] = useState<string>(myBeds[0]?.id || "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [reportMemo, setReportMemo] = useState<string>("");

  if (!task) return null;

  const t = task.tasks || task;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReportComplete = () => {
    const targetBed = myBeds.find((b) => b.id === selectedBedId) || myBeds[0];

    // 対象の畝ベッドへ作業記録・現場写真を送信保存
    if (targetBed) {
      addCropRecord(targetBed.id, {
        bed_id: targetBed.id,
        date: new Date().toLocaleDateString("ja-JP"),
        growth_stage: "果実肥大",
        height_cm: 75,
        work_types: [t.title],
        notes: reportMemo.trim(),
        harvest_amount: photoPreview ? "📷 現場写真あり" : undefined,
      });
    }

    if (onComplete) {
      onComplete(task.id, selectedBedId, photoPreview || undefined, reportMemo);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto border border-gray-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 font-bold"
        >
          ✕
        </button>

        <div className="space-y-1">
          <Badge type="crop">{t.target_crop || "春野菜"}</Badge>
          <h3 className="text-xl font-black text-gray-900 leading-snug">{t.title}</h3>
        </div>

        <div className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1">
          <h4 className="font-bold text-gray-800">📖 作業手順・概要</h4>
          <p>{t.description || "苗や土の観察を行い、状態に合わせて手入れを行います。"}</p>
        </div>

        {/* 🌟 1. 対象の畑(畝ベッド)の選択 🌟 */}
        <div className="space-y-1.5 pt-1">
          <label className="block text-xs font-black text-emerald-950">
            🌱 対象の畑(畝ベッド)を選択 *
          </label>
          <select
            value={selectedBedId}
            onChange={(e) => setSelectedBedId(e.target.value)}
            className="w-full p-3 rounded-2xl border-2 border-emerald-600 bg-emerald-50 text-emerald-950 font-black text-xs cursor-pointer shadow-xs"
          >
            {myBeds.map((b) => (
              <option key={b.id} value={b.id}>
                畝 {myPlot?.code}-{b.bed_number}
              </option>
            ))}
          </select>
        </div>

        {/* 🌟 2. 作業メモ・気づきの入力 🌟 */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-gray-700">作業メモ・気づきコメント</label>
          <textarea
            rows={3}
            placeholder="作業時に気づいたことや状態を入力してください..."
            value={reportMemo}
            onChange={(e) => setReportMemo(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 text-xs font-medium"
          />
        </div>

        {/* 🌟 3. 現場写真の撮影・添付 🌟 */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-700">📷 現場写真の添付</label>
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-3 bg-gray-50 flex flex-col items-center justify-center text-center relative cursor-pointer min-h-[90px] hover:bg-gray-100 transition">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            {photoPreview ? (
              <img src={photoPreview} alt="現場写真" className="h-28 object-cover rounded-xl shadow-xs" />
            ) : (
              <div className="text-xs text-gray-500 space-y-1">
                <span className="text-xl">📷</span>
                <p className="font-bold">タップして作業写真を撮影・追加</p>
              </div>
            )}
          </div>
        </div>

        {/* 完了送信ボタン */}
        <div className="pt-2">
          <button
            onClick={handleReportComplete}
            className="w-full py-3.5 bg-[#1d5c23] hover:bg-[#16471a] text-white font-black text-sm rounded-xl shadow-md transition active:scale-95"
          >
            ✓ 畝に記録して作業完了を報告
          </button>
        </div>
      </div>
    </div>
  );
}
