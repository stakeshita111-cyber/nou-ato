"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Toast from "@/components/ui/Toast";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteUrl: string;
  farmName?: string;
}

export default function QRCodeModal({
  isOpen,
  onClose,
  inviteUrl,
  farmName = "農園招待",
}: QRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (isOpen && inviteUrl) {
      // 1. HTML5 Canvas 上へ高解像度 QRコードを描画
      if (canvasRef.current) {
        QRCode.toCanvas(
          canvasRef.current,
          inviteUrl,
          {
            width: 240,
            margin: 2,
            color: {
              dark: "#064e3b", // 深いエメラルドグリーン
              light: "#ffffff",
            },
          },
          (error) => {
            if (error) console.error("QR Code canvas generation error:", error);
          }
        );
      }

      // 2. ダウンロード用 DataURL 生成
      QRCode.toDataURL(
        inviteUrl,
        {
          width: 500,
          margin: 2,
          color: {
            dark: "#064e3b",
            light: "#ffffff",
          },
        },
        (err, url) => {
          if (!err && url) {
            setDataUrl(url);
          }
        }
      );
    }
  }, [isOpen, inviteUrl]);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setToastMessage("📋 招待URLをクリップボードにコピーしました！");
      setShowToast(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center border border-gray-100">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 transition"
        >
          ✕
        </button>

        <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-1">
          実在スキャン用 QRコード
        </span>
        <h3 className="text-lg font-black text-gray-900 mb-1">{farmName}</h3>
        <p className="text-xs text-gray-500 mb-4">カメラ・LINEアプリで読み取り可能</p>

        {/* リアルQRコード表示コンテナ */}
        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/80 shadow-inner flex flex-col items-center justify-center mx-auto w-60 h-60 mb-4">
          <canvas ref={canvasRef} className="rounded-xl shadow-xs max-w-full max-h-full" />
        </div>

        {/* 招待URLテキスト */}
        <p className="text-[11px] text-gray-600 mb-4 break-all bg-gray-50 p-2.5 rounded-xl border border-gray-200 font-mono text-left">
          {inviteUrl}
        </p>

        {/* アクションボタン */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={handleCopyUrl}
            className="py-2.5 bg-gray-100 text-gray-800 font-bold text-xs rounded-xl hover:bg-gray-200 transition"
          >
            📋 URLをコピー
          </button>
          {dataUrl ? (
            <a
              href={dataUrl}
              download={`${farmName}_招待QR.png`}
              className="py-2.5 bg-emerald-800 text-white font-bold text-xs rounded-xl hover:bg-emerald-900 transition flex items-center justify-center gap-1 shadow-sm"
            >
              📥 QR画像保存
            </a>
          ) : (
            <button disabled className="py-2.5 bg-gray-200 text-gray-400 font-bold text-xs rounded-xl">
              読み込み中...
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-gray-900 text-white font-bold text-xs rounded-xl hover:bg-gray-800 transition"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
