"use client";

export default function JournalInput({ 
  value, 
  onChange, 
  onSubmit 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  onSubmit: () => void; 
}) {
  return (
    <div className="mb-8 px-2">
      <h2 className="font-semibold text-xl mb-4 text-gray-800">師匠への気づきメモ</h2>
      <div className="flex flex-col gap-3">
        <textarea 
          className="border p-4 rounded-xl shadow-sm resize-none w-full bg-white text-lg text-gray-800 border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500" 
          placeholder="トマトの葉の裏に白い斑点を発見しました！" 
          rows={3}
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
        />
        <button 
          onClick={onSubmit} 
          className="bg-blue-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 transition"
        >
          送信する
        </button>
      </div>
    </div>
  );
}