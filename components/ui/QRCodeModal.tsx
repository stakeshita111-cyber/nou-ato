"use client";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteUrl: string;
  farmName?: string;
}

export default function QRCodeModal({ isOpen, onClose, inviteUrl, farmName = "たなか自然農園" }: QRCodeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 transition"
        >
          ✕
        </button>

        <h3 className="text-xl font-bold text-gray-800 mb-1">{farmName}</h3>
        <p className="text-xs text-gray-500 mb-6">生徒用 招待QRコード</p>

        {/* QRコード画像表示（SVGでの軽量QRコードダミー） */}
        <div className="bg-white p-4 rounded-2xl border-2 border-green-100 shadow-inner flex flex-col items-center justify-center mx-auto w-56 h-56 mb-4">
          <svg className="w-48 h-48 text-gray-800" viewBox="0 0 100 100" fill="currentColor">
            {/* 方眼スタイルのダミーQRデザイン */}
            <path d="M0,0 h30 v30 h-30 z M5,5 h20 v20 h-20 z M10,10 h10 v10 h-10 z" />
            <path d="M70,0 h30 v30 h-30 z M75,5 h20 v20 h-20 z M80,10 h10 v10 h-10 z" />
            <path d="M0,70 h30 v30 h-30 z M5,75 h20 v20 h-20 z M10,80 h10 v10 h-10 z" />
            <rect x="40" y="5" width="10" height="20" />
            <rect x="55" y="10" width="10" height="10" />
            <rect x="35" y="35" width="30" height="30" />
            <rect x="75" y="40" width="20" height="10" />
            <rect x="80" y="55" width="15" height="15" />
            <rect x="40" y="75" width="15" height="20" />
            <rect x="60" y="80" width="25" height="15" />
            <rect x="15" y="40" width="15" height="15" />
          </svg>
        </div>

        <p className="text-xs text-gray-500 mb-4 break-all bg-gray-50 p-2 rounded-lg font-mono">
          {inviteUrl}
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 bg-[#1d5c23] text-white font-bold rounded-xl hover:bg-[#16471a] transition"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
