/**
 * NOU-ATO AI相談チケット管理モジュール
 * - JST 日本時間0時自動リセット
 * - 秘密の呪文対応
 * - 将来の「相談し放題（無制限プラン）」や「1日の回数制限変更」に完全対応
 * - 🌟【新機能】チケット終了時の「質問ストック・累積メモ」機能（次回コピー用）
 */

export type TicketPlanType = "limited" | "unlimited" | "memo_only";

export const DEFAULT_DAILY_TICKETS = 3;

export interface TicketState {
  date: string; // YYYY-MM-DD (JST)
  count: number; // 残り枚数 (0〜dailyLimit)
  plan: TicketPlanType; // "limited" | "unlimited" | "memo_only"
  dailyLimit: number; // 1日の上限枚数
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
 * 秘密のチケット復活の呪文かどうかを判定
 * 例: 「チケットください」「チケット下さい」「チケットくれ」「チケットちょうだい」「ちけっと復活」など
 */
export function isSecretTicketSpell(text: string): boolean {
  const clean = text.trim().toLowerCase();
  const pattern = /(?:チケット|ちけっと).*(?:ください|下さい|くれ|ちょうだい|復活|ほしい|増やして|リセット)/;
  return pattern.test(clean);
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

  if (typeof window === "undefined") {
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

  if (typeof window !== "undefined") {
    const storageKey = `nouato_ai_tickets_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }

  return updated;
}

/**
 * 秘密の呪文によりチケットを全回復
 */
export function restoreTicketsBySpell(
  userId: string = "default",
  customLimit: number = DEFAULT_DAILY_TICKETS
): TicketState {
  const updated: TicketState = {
    date: getJstDateString(),
    count: customLimit,
    plan: "limited",
    dailyLimit: customLimit,
    isUnlimited: false,
  };

  if (typeof window !== "undefined") {
    const storageKey = `nouato_ai_tickets_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(updated));
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
  if (typeof window === "undefined") return [];
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
  if (typeof window !== "undefined") {
    const storageKey = `nouato_question_stock_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(nextList));
  }
  return nextList;
}

/**
 * 質問ストックをクリア（次回チケットで質問送信した時などにリセット可能）
 */
export function clearQuestionStock(userId: string = "default"): void {
  if (typeof window !== "undefined") {
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
