export type Task = {
  id: string;
  title: string;
  status: string;
  category?: string;
  created_by?: string;
  farm_id?: string;
  
  // ★詳細設定モーダル用に追加したプロパティ
  description?: string | null;      // チェックリスト手順（改行区切りテキスト）
  estimated_time?: string | null;   // 想定作業時間（例: "30分"）
  tools_needed?: string | null;     // 必要な道具（例: "ハサミ, 軍手"）
  reference_links?: string | null;  // 参考資料（例: "https://..."）
  memo?: string | null;             // 師匠からの補足
  target_crop?: string | null;      // 対象作物
  require_photo?: boolean | null;   // 写真必須トグル
  exp?: number | null;              // 獲得EXP
  difficulty?: number | null;       // 難易度(1〜5)
};

export type ColumnType = {
  id: string;
  title: string;
};