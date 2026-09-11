"use client";

import { useState } from "react";

export default function JournalInput({ 
  value, 
  onChange, 
  onSubmit 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  onSubmit: () => void | Promise<void>; 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = async () => {
    if (!value.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isButtonDisabled = !value.trim() || isSubmitting;

  return (
    <div className="mb-8 px-2">
      <h2 className="font-semibold text-xl mb-4 text-gray-800">師匠への気づきメモ</h2>
      <div className="flex flex-col gap-3">
        <textarea 
          className="border p-4 rounded-xl shadow-sm resize-none w-full bg-white text-lg text-gray-800 border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100" 
          placeholder="トマトの葉の裏に白い斑点を発見しました！" 
          rows={3}
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          disabled={isSubmitting}
        />
        <button 
          type="button"
          onClick={handleClick} 
          disabled={isButtonDisabled}
          className={`py-3 rounded-xl font-bold shadow-md transition ${
            isButtonDisabled
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] cursor-pointer"
          }`}
        >
          {isSubmitting ? "送信中..." : "送信する"}
        </button>
      </div>
    </div>
  );
}