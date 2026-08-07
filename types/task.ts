export type Task = {
  id: string;
  title: string;
  status: string;
  category?: string;
  created_by?: string;
  farm_id?: string;
  deleted_at?: string | null;       // 論理削除日時

  // 詳細プロパティ
  description?: string | null;      // チェックリスト手順 / 作物等の概要
  estimated_time?: string | null;   // 想定作業時間（例: "30分"）
  tools_needed?: string | null;     // 必要な道具（例: "ハサミ, 軍手"）
  reference_links?: string | null;  // 参考資料（例: "https://..."）
  memo?: string | null;             // 師匠からの補足
  target_crop?: string | null;      // 対象作物
  require_photo?: boolean | null;   // 写真必須トグル
  exp?: number | null;              // 獲得EXP
  difficulty?: number | null;       // 難易度(1〜5)
  badge_name?: string | null;       // 🏆 達成時獲得バッジ名 (例: "芽かきマスター")
  badge_icon?: string | null;       // 🏆 獲得バッジアイコン (例: "✂️")

  // UI装飾用拡張プロパティ（オプション）
  tags?: string[];                  // タグ配列 (例: ["解説資料", "下書き"])
  icon_type?: string;               // アイコンタイプ (例: "tractor", "water", "quiz", "report")
  completion_info?: string;        // 提出・回答状況テキスト (例: "15名が回答済み", "32/40 提出済み")
  due_date_text?: string;           // 締切表記 (例: "金曜 締切")
};

export type ColumnType = {
  id: string;
  title: string;
  subtitle?: string;
  dotColor?: string;
  badgeBg?: string;
  badgeText?: string;
};