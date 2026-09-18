import { describe, it, expect } from "vitest";
import {
  sanitizePersonalNames,
  CROPS_LIST,
  STOP_WORDS,
} from "@/lib/rag/qaKnowledgeRetriever";

describe("Knowledge Retriever & Quality Logic Tests (コード品質・プライバシー保護)", () => {
  describe("1. 個人名匿名化・プライバシー保護 (sanitizePersonalNames)", () => {
    it("文頭の個人向け挨拶（『竹下翔さん、こんにちは！😊』）を完全に除去すること", () => {
      const raw = "竹下翔さん、こんにちは！😊\nトマトの芽かきについてアドバイスします。";
      const cleaned = sanitizePersonalNames(raw);
      expect(cleaned).not.toContain("竹下");
      expect(cleaned).not.toContain("翔");
      expect(cleaned).toBe("トマトの芽かきについてアドバイスします。");
    });

    it("文中の個人名呼びかけ（『〜さん、』『〜様』等）を除去すること", () => {
      const raw = "佐藤さん、追肥の時期は植え付けから3週間後です。";
      const cleaned = sanitizePersonalNames(raw);
      expect(cleaned).not.toContain("佐藤さん");
      expect(cleaned).toContain("追肥の時期は植え付けから3週間後です。");
    });

    it("『受講生の〇〇さん』を『受講生の方』に一般化すること", () => {
      const raw = "受講生の鈴木さんからのご相談ですね。";
      const cleaned = sanitizePersonalNames(raw);
      expect(cleaned).toContain("受講生の方");
      expect(cleaned).not.toContain("鈴木");
    });

    it("チケット復活などの対話文脈行を除去すること", () => {
      const raw = "チケット無事に復活しましたね✨\n本日の作業はナスの支柱立てです。";
      const cleaned = sanitizePersonalNames(raw);
      expect(cleaned).not.toContain("チケット無事");
      expect(cleaned).toBe("本日の作業はナスの支柱立てです。");
    });
  });

  describe("2. 作物リストと作物フィルタリング整合性 (CROPS_LIST)", () => {
    it("主要作物が網羅されていること", () => {
      expect(CROPS_LIST).toContain("トマト");
      expect(CROPS_LIST).toContain("きゅうり");
      expect(CROPS_LIST).toContain("ナス");
      expect(CROPS_LIST).toContain("枝豆");
      expect(CROPS_LIST).toContain("ジャガイモ");
    });

    it("ユーザー質問から正しい作物が特定できること", () => {
      const question = "枝豆の葉っぱに虫がついて困っています";
      const matchedCrops = CROPS_LIST.filter((crop) => question.includes(crop));
      expect(matchedCrops).toContain("枝豆");
      expect(matchedCrops).not.toContain("トマト");
    });
  });

  describe("3. ストップワード除去と重要キーワード抽出 (STOP_WORDS)", () => {
    it("助詞や一般的すぎる単語が正しく登録されていること", () => {
      expect(STOP_WORDS).toContain("教えて");
      expect(STOP_WORDS).toContain("ください");
      expect(STOP_WORDS).toContain("どうすれば");
      expect(STOP_WORDS).toContain("方法");
    });

    it("質問からストップワードを除去して重要単語のみ抽出できること", () => {
      const question = "トマトの追肥のやり方を教えてください";
      const rawTokens = question.replace(/[、。！？!?]/g, " ").split(/\s+/);
      const keywords = rawTokens.filter((token) => !STOP_WORDS.includes(token));

      expect(keywords.some((k) => k.includes("トマト"))).toBe(true);
      expect(keywords.some((k) => k.includes("追肥"))).toBe(true);
    });
  });
});
