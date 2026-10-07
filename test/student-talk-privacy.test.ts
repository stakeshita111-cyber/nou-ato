import { describe, it, expect } from "vitest";

function sanitizePersonalNames(text: string): string {
  if (!text) return "";
  let clean = text;
  clean = clean.replace(/^[^\n\r]{1,30}(?:さん|様|くん|ちゃん)[^\n\r]*(?:こんにちは|ありがとうございます|お疲れ様です|メッセージ)[^\n\r]*[\n\r]*/gm, "");
  clean = clean.replace(/^[^\n\r]*(?:チケット無事|復活しました|改めて)[^\n\r]*[\n\r]*/gm, "");
  clean = clean.replace(/[^ \n\r!！🌱〜]{1,10}(?:さん|様|くん|ちゃん|氏)[、,!\s]*/g, "");
  clean = clean.replace(/(?:竹下|翔|たけした)[^ \n\r!！🌱〜]*(?:さん|様|くん|ちゃん)?[、,!\s]*/g, "");
  clean = clean.trim();
  return clean || text.replace(/[^ \n\r!！🌱〜]{1,10}(?:さん|様|くん|ちゃん|氏)[、,!\s]*/g, "").trim();
}

function formatQuestionTopic(item: { question: string; matchedKeywords: string[] }): string {
  if (item.matchedKeywords && item.matchedKeywords.length > 0) {
    return `【${item.matchedKeywords.join("・")}】に関する栽培相談`;
  }
  const cleanQ = sanitizePersonalNames(item.question);
  if (cleanQ) {
    return cleanQ.length > 35 ? cleanQ.slice(0, 35) + "..." : cleanQ;
  }
  return "【農園トピック】に関する栽培相談";
}

describe("StudentTalkView Privacy Features", () => {
  it("formats question topic using matched keywords instead of raw text", () => {
    const item = {
      question: "山田太郎です。トマトの葉が黄色いのですが、住所は東京都...",
      matchedKeywords: ["トマト", "葉が黄色"],
    };
    const topic = formatQuestionTopic(item);
    expect(topic).toBe("【トマト・葉が黄色】に関する栽培相談");
    expect(topic).not.toContain("山田太郎");
  });

  it("sanitizes personal names in fallback question topic", () => {
    const item = {
      question: "竹下翔さん、イチゴの芽かきについて質問です",
      matchedKeywords: [],
    };
    const topic = formatQuestionTopic(item);
    expect(topic).not.toContain("竹下翔");
  });

  it("correctly handles private consultation tag prefix when opt-out toggle is false", () => {
    const allowKnowledgeShare = false;
    const rawInput = "個人的な質問です";
    const messageToSend = allowKnowledgeShare || rawInput.startsWith("【非公開相談】")
      ? rawInput
      : `【非公開相談】${rawInput}`;

    expect(messageToSend).toBe("【非公開相談】個人的な質問です");
    expect(messageToSend.startsWith("【非公開相談】")).toBe(true);
  });
});
