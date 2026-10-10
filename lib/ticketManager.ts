/**
 * NOU-ATO AI相談チケット管理モジュール
 * - 残数・上限は DB（ai_usage / ai_tickets）が正。画面は get_ai_ticket_status() の値を表示するだけ。
 * - JST 日本時間0時のリセットも DB 側（Asia/Tokyo）で判定する。
 * - 🌟【機能】チケット終了時の「質問ストック・累積メモ」機能（次回コピー用）のみ端末ローカル保存
 */

export type TicketPlanType = 'limited' | 'unlimited' | 'memo_only';

export const DEFAULT_DAILY_TICKETS = 3;

export interface TicketState {
  date: string; // YYYY-MM-DD (JST)
  count: number; // 残り枚数
  plan: TicketPlanType; // "limited" | "unlimited" | "memo_only"
  dailyLimit: number; // 本日の上限枚数（基本3 + 講師付与分）
  isUnlimited: boolean; // 相談し放題フラグ
}

/**
 * 日本時間 (JST: Asia/Tokyo) の YYYY-MM-DD 日付文字列を取得
 */
export function getJstDateString(): string {
  const d = new Date();
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(d)
    .replace(/\//g, '-');
}

/**
 * プラン別の初期チケット状態（サーバー応答前の仮表示にも使う。永続化はしない）
 */
export function getTicketState(
  customLimit: number = DEFAULT_DAILY_TICKETS,
  plan: TicketPlanType = 'limited'
): TicketState {
  const todayJst = getJstDateString();

  if (plan === 'unlimited') {
    return { date: todayJst, count: 999, plan: 'unlimited', dailyLimit: 999, isUnlimited: true };
  }

  if (plan === 'memo_only') {
    return { date: todayJst, count: 0, plan: 'memo_only', dailyLimit: 0, isUnlimited: false };
  }

  return {
    date: todayJst,
    count: customLimit,
    plan: 'limited',
    dailyLimit: customLimit,
    isUnlimited: false,
  };
}

/**
 * RPC get_ai_ticket_status() の戻り値を TicketState に変換する。
 * 形式が想定外の場合は null（呼び出し側は失敗として扱い、成功に見せない）。
 */
export function parseTicketStatus(data: unknown): TicketState | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const rec = data as Record<string, unknown>;
  const { date, daily_limit: dailyLimit, remaining } = rec;
  if (
    typeof date !== 'string' ||
    typeof dailyLimit !== 'number' ||
    typeof remaining !== 'number' ||
    !Number.isFinite(dailyLimit) ||
    !Number.isFinite(remaining)
  ) {
    return null;
  }
  return {
    date,
    count: Math.max(0, remaining),
    plan: 'limited',
    dailyLimit,
    isUnlimited: false,
  };
}

// ==========================================
// 🌟【機能】質問ストック（累積メモ）管理 🌟
// ==========================================

/**
 * 蓄積された質問ストックリストを取得
 */
export function getQuestionStock(userId: string = 'default'): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const storageKey = `nouato_question_stock_${userId}`;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * 質問ストックに新しいメモを書き足す（累積）
 */
export function addQuestionStock(userId: string = 'default', text: string): string[] {
  const current = getQuestionStock(userId);
  const trimmed = text.trim();
  if (!trimmed) return current;

  // 重複追加を防ぎつつ追記
  const nextList = [...current, trimmed];
  if (typeof window !== 'undefined' && window.localStorage) {
    const storageKey = `nouato_question_stock_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(nextList));
  }
  return nextList;
}

/**
 * 質問ストックをクリア（次回チケットで質問送信した時などにリセット可能）
 */
export function clearQuestionStock(userId: string = 'default'): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    const storageKey = `nouato_question_stock_${userId}`;
    localStorage.removeItem(storageKey);
  }
}

/**
 * ストックリストを箇条書きテキストにフォーマット
 */
export function formatStockText(items: string[]): string {
  if (!items || items.length === 0) return '';
  return items.map((it) => `・${it}`).join('\n');
}
