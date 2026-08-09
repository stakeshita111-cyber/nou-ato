"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

interface LineLinkingCardProps {
  onStatusChange?: () => void;
}

export default function LineLinkingCard({ onStatusChange }: LineLinkingCardProps) {
  const supabase = createClient();
  const [isLinked, setIsLinked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const checkLinkingStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const lineIdentity = user.identities?.find((id) => id.provider === "custom:line" || id.provider === "line");
        setIsLinked(!!lineIdentity);
      }
    } catch (err) {
      console.error("Failed to fetch user identities:", err);
    }
  };

  useEffect(() => {
    checkLinkingStatus();
  }, []);

  const handleLinkLine = async () => {
    setLoading(true);
    setMessage("");
    try {
      const origin = window.location.origin;
      const { data, error } = await supabase.auth.linkIdentity({
        provider: "custom:line" as any,
        options: {
          scopes: 'openid profile email',
          redirectTo: `${origin}/auth/callback?next=/student/quests`,
        },
      });

      if (error) {
        setMessage(`連携失敗: ${error.message}`);
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setMessage(`エラーが発生しました: ${err.message || ""}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkLine = async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const lineIdentity = user?.identities?.find((id) => id.provider === "custom:line" || id.provider === "line");

      if (!lineIdentity) {
        setMessage("LINEアカウントが連携されていません");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.unlinkIdentity(lineIdentity);
      if (error) {
        setMessage(`連携解除失敗: ${error.message}`);
      } else {
        setMessage("LINEアカウントの連携を解除しました");
        setIsLinked(false);
        if (onStatusChange) onStatusChange();
      }
    } catch (err: any) {
      setMessage(`エラーが発生しました: ${err.message || ""}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#06C755] flex items-center justify-center text-white font-black text-lg shadow-sm">
            LINE
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">LINE アカウント連携</h3>
            <p className="text-xs text-gray-500">
              LINEログインや通知連携を有効にします
            </p>
          </div>
        </div>

        {isLinked !== null && (
          <span
            className={`text-xs px-3 py-1 rounded-full font-bold ${
              isLinked
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {isLinked ? "連携済み" : "未連携"}
          </span>
        )}
      </div>

      {message && (
        <div className="text-xs bg-gray-50 p-2.5 rounded-xl text-gray-700 font-medium">
          {message}
        </div>
      )}

      <div>
        {isLinked ? (
          <button
            type="button"
            onClick={handleUnlinkLine}
            disabled={loading}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition"
          >
            {loading ? "解除中..." : "LINE連携を解除する"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLinkLine}
            disabled={loading}
            className="w-full py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2"
          >
            <span>💬</span>
            <span>{loading ? "LINEへ移動中..." : "LINEアカウントと連携する"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
