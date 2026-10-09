import { sanitizePersonalNames } from "@/lib/rag/qaKnowledgeRetriever";

/**
 * 🌟 ただの記録（質問・SOSではない日常の畝作業・観察記録）判定ヘルパー 🌟
 */
export const isRegularRecord = (content?: string): boolean => {
  if (!content) return false;
  const trimmed = content.trim();
  // 【畝...】で始まる記録
  if (trimmed.startsWith("【畝")) {
    const hasQuestion =
      /[?？]/.test(trimmed) ||
      trimmed.includes("教えて") ||
      trimmed.includes("どうすれば") ||
      trimmed.includes("どうしたら") ||
      trimmed.includes("相談");
    const hasUrgent = ["枯れ", "病", "害虫", "元気がない", "しおれ", "異変", "カビ"].some(
      (k) => trimmed.includes(k)
    );
    // 質問やSOSが含まれていなければ「ただの記録」
    return !hasQuestion && !hasUrgent;
  }
  return false;
};

/**
 * 送信前メッセージのフォーマットヘルパー（オプトアウト・非公開相談タグ付与）
 */
export const prepareMessageForSend = (
  rawInput: string,
  allowKnowledgeShare: boolean
): string => {
  const trimmed = rawInput.trim();
  if (!trimmed) return "";
  return allowKnowledgeShare || trimmed.startsWith("【非公開相談】")
    ? trimmed
    : `【非公開相談】${trimmed}`;
};

export interface MatchedKnowledgeTopicItem {
  question: string;
  matchedKeywords?: string[];
}

/**
 * 質問トピック整形ヘルパー（個人情報サニタイズ・キーワード優先表示）
 */
export const formatQuestionTopic = (item: MatchedKnowledgeTopicItem): string => {
  if (item.matchedKeywords && item.matchedKeywords.length > 0) {
    return `【${item.matchedKeywords.join("・")}】に関する栽培相談`;
  }
  const cleanQ = sanitizePersonalNames(item.question);
  if (cleanQ) {
    return cleanQ.length > 35 ? cleanQ.slice(0, 35) + "..." : cleanQ;
  }
  return "【農園トピック】に関する栽培相談";
};
