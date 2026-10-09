/**
 * NOU-ATO AI相談チケット管理モジュール
 * - JST 日本時間0時自動リセット
 * - 講師からの受講生追加チケット付与機能（秘密の呪文廃止版）
 * - 将来の「相談し放題（無制限プラン）」や「1日の回数制限変更」に完全対応
 * - 🌟 チケット終了時の「質問ストック・累積メモ」機能（次回コピー用）
 */

export type TicketPlanType = "limited" | "unlimited" | "memo_only";

export const DEFAULT_DAILY_TICKETS = 3;

export interface TicketState {
  date: string; // YYYY-MM-DD (JST)
  count: number; // 残り枚数 (0〜dailyLimit)
  plan: TicketPlanType; // "limited" | "unlimited" | "memo_only"
  dailyLimit: number; // 1日の基本上限枚数
  isUnlimited: boolean; // 相談し放題フラグ
}

/**
 * 日本時間 (JST: Asia/Tokyo) の YYYY-MM-DD 日付文字列を取得
 */
export function getJstDateString(): string {
  const d = new Date();
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/\//g, "-");
}

/**
 * ローカルストレージからチケット情報を取得（JST 0:00 を過ぎていれば自動リセット）
 */
export function getTicketState(
  userId: string = "default",
  customLimit: number = DEFAULT_DAILY_TICKETS,
  plan: TicketPlanType = "limited"
): TicketState {
  const todayJst = getJstDateString();

  if (plan === "unlimited") {
    return {
      date: todayJst,
      count: 999,
      plan: "unlimited",
      dailyLimit: 999,
      isUnlimited: true,
    };
  }

  if (plan === "memo_only") {
    return {
      date: todayJst,
      count: 0,
      plan: "memo_only",
      dailyLimit: 0,
      isUnlimited: false,
    };
  }

  if (typeof window === "undefined" || !window.localStorage) {
    return {
      date: todayJst,
      count: customLimit,
      plan: "limited",
      dailyLimit: customLimit,
      isUnlimited: false,
    };
  }

  const storageKey = `nouato_ai_tickets_${userId}`;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      const initial: TicketState = {
        date: todayJst,
        count: customLimit,
        plan: "limited",
        dailyLimit: customLimit,
        isUnlimited: false,
      };
      localStorage.setItem(storageKey, JSON.stringify(initial));
      return initial;
    }

    const parsed: Partial<TicketState> = JSON.parse(raw);
    if (parsed.date !== todayJst) {
      // 🌟 日本時間0時を跨いだため設定された上限に自動リセット 🌟
      const reset: TicketState = {
        date: todayJst,
        count: customLimit,
        plan: "limited",
        dailyLimit: customLimit,
        isUnlimited: false,
      };
      localStorage.setItem(storageKey, JSON.stringify(reset));
      return reset;
    }

    const currentCount = typeof parsed.count === "number" ? parsed.count : customLimit;

    return {
      date: todayJst,
      count: currentCount,
      plan: parsed.plan || "limited",
      dailyLimit: parsed.dailyLimit || customLimit,
      isUnlimited: false,
    };
  } catch (e) {
    return {
      date: todayJst,
      count: customLimit,
      plan: "limited",
      dailyLimit: customLimit,
      isUnlimited: false,
    };
  }
}

/**
 * チケットを1枚消費して保存
 */
export function consumeTicket(
  userId: string = "default",
  customLimit: number = DEFAULT_DAILY_TICKETS,
  plan: TicketPlanType = "limited"
): TicketState {
  const current = getTicketState(userId, customLimit, plan);

  if (current.isUnlimited) {
    return current;
  }

  const nextCount = Math.max(0, current.count - 1);
  const updated: TicketState = {
    date: getJstDateString(),
    count: nextCount,
    plan: current.plan,
    dailyLimit: current.dailyLimit,
    isUnlimited: false,
  };

  if (typeof window !== "undefined" && window.localStorage) {
    const storageKey = `nouato_ai_tickets_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }

  return updated;
}

/**
 * 講師権限などで特定受講生に追加チケットを付与する関数
 */
export function grantTicket(
  userId: string = "default",
  amount: number = 1,
  customLimit: number = DEFAULT_DAILY_TICKETS,
  plan: TicketPlanType = "limited"
): TicketState {
  const current = getTicketState(userId, customLimit, plan);

  if (current.isUnlimited) {
    return current;
  }

  const nextCount = current.count + amount;
  const updated: TicketState = {
    date: getJstDateString(),
    count: nextCount,
    plan: current.plan,
    dailyLimit: Math.max(current.dailyLimit, nextCount),
    isUnlimited: false,
  };

  if (typeof window !== "undefined") {
    if (window.localStorage) {
      const storageKey = `nouato_ai_tickets_${userId}`;
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }

    // リアルタイム反映用イベント＆BroadcastChannel発火
    if (typeof window.dispatchEvent === "function") {
      try {
        window.dispatchEvent(new CustomEvent("nouato_tickets_updated", { detail: { userId, updated } }));
        window.dispatchEvent(new Event("nouato_sync_event"));
      } catch (e) {
        // ignore event errors
      }
    }

    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("nouato_farm_sync_channel");
        bc.postMessage({ type: "TICKETS_UPDATED", userId, updated, timestamp: Date.now() });
        bc.close();
      }
    } catch (e) {
      // ignore channel errors
    }
  }

  return updated;
}

// ==========================================
// 🌟【新機能】質問ストック（累積メモ）管理 🌟
// ==========================================

/**
 * 蓄積された質問ストックリストを取得
 */
export function getQuestionStock(userId: string = "default"): string[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  const storageKey = `nouato_question_stock_${userId}`;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * 質問ストックに新しいメモを書き足す（累積）
 */
export function addQuestionStock(userId: string = "default", text: string): string[] {
  const current = getQuestionStock(userId);
  const trimmed = text.trim();
  if (!trimmed) return current;

  // 重複追加を防ぎつつ追記
  const nextList = [...current, trimmed];
  if (typeof window !== "undefined" && window.localStorage) {
    const storageKey = `nouato_question_stock_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(nextList));
  }
  return nextList;
}

/**
 * 質問ストックをクリア（次回チケットで質問送信した時などにリセット可能）
 */
export function clearQuestionStock(userId: string = "default"): void {
  if (typeof window !== "undefined" && window.localStorage) {
    const storageKey = `nouato_question_stock_${userId}`;
    localStorage.removeItem(storageKey);
  }
}

/**
 * ストックリストを箇条書きテキストにフォーマット
 */
export function formatStockText(items: string[]): string {
  if (!items || items.length === 0) return "";
  return items.map((it, i) => `・${it}`).join("\n");
}
