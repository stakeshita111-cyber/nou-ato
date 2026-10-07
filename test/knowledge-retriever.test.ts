import { describe, it, expect, vi } from "vitest";
import {
  sanitizePiiText,
  sanitizePersonalNames,
  CROPS_LIST,
  STOP_WORDS,
  searchSimilarKnowledge,
} from "@/lib/rag/qaKnowledgeRetriever";
import { supabase } from "@/lib/supabase";

describe("Knowledge Retriever & Quality Logic Tests (コード品質・プライバシー保護)", () => {
  describe("1. 包括的PIIサニタイズ (sanitizePiiText / sanitizePersonalNames)", () => {
    it("文頭の個人向け挨拶（『竹下翔さん、こんにちは！😊』）を完全に除去すること", () => {
      const raw = "竹下翔さん、こんにちは！😊\nトマトの芽かきについてアドバイスします。";
      const cleaned = sanitizePiiText(raw);
      expect(cleaned).not.toContain("竹下");
      expect(cleaned).not.toContain("翔");
      expect(cleaned).toBe("トマトの芽かきについてアドバイスします。");
    });

    it("文中の個人名呼びかけ（『〜さん、』『〜様』等）を除去すること", () => {
      const raw = "佐藤さん、追肥の時期は植え付けから3週間後です。";
      const cleaned = sanitizePiiText(raw);
      expect(cleaned).not.toContain("佐藤さん");
      expect(cleaned).toContain("追肥の時期は植え付けから3週間後です。");
    });

    it("『受講生の〇〇さん』を『受講生の方』に一般化すること", () => {
      const raw = "受講生の鈴木さんからのご相談ですね。";
      const cleaned = sanitizePiiText(raw);
      expect(cleaned).toContain("受講生の方");
      expect(cleaned).not.toContain("鈴木");
    });

    it("チケット復活などの対話文脈行を除去すること", () => {
      const raw = "チケット無事に復活しましたね✨\n本日の作業はナスの支柱立てです。";
      const cleaned = sanitizePiiText(raw);
      expect(cleaned).not.toContain("チケット無事");
      expect(cleaned).toBe("本日の作業はナスの支柱立てです。");
    });

    it("電話番号・メールアドレス・住所・SNSアカウント・名乗り・家族情報を検知しサニタイズすること", () => {
      const text1 = "連絡先は090-1234-5678とtest@example.comです。住所は〒150-0001 東京都渋谷区神宮前1-2-3です。";
      const clean1 = sanitizePiiText(text1);
      expect(clean1).not.toContain("090-1234-5678");
      expect(clean1).not.toContain("test@example.com");
      expect(clean1).not.toContain("東京都渋谷区神宮前1-2-3");
      expect(clean1).toContain("[個人情報]");

      const text2 = "LINE ID: tanaka_nouen まで連絡ください。山田太郎です。田中と申します。";
      const clean2 = sanitizePiiText(text2);
      expect(clean2).not.toContain("tanaka_nouen");
      expect(clean2).not.toContain("山田太郎です");
      expect(clean2).not.toContain("田中と申します");
      expect(clean2).toContain("[受講生]です");
      expect(clean2).toContain("[受講生]と申します");

      const text3 = "うちの娘がトマトの苗を植えました。息子の健太も手伝いました。";
      const clean3 = sanitizePiiText(text3);
      expect(clean3).not.toContain("うちの娘");
      expect(clean3).not.toContain("息子の健太");
      expect(clean3).toContain("[ご家族]");
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

  describe("4. 過去ナレッジ検索とクエリ条件 (searchSimilarKnowledge)", () => {
    it("journals テーブルから eq('is_approved', true) 条件を付与して厳格取得し、未承認データを含めないこと", async () => {
      const mockApprovedData = [
        {
          id: "1",
          content: "トマトの追肥タイミングを教えてください",
          reply: "トマトの追肥は植え付けから3週間後に行います。",
          is_approved: true,
          student_id: "s1",
        },
      ];

      const limitMock = vi.fn().mockResolvedValue({ data: mockApprovedData, error: null });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const neqMock = vi.fn().mockReturnValue({ order: orderMock });
      const notMock = vi.fn().mockReturnValue({ neq: neqMock });
      const eqMock = vi.fn().mockReturnValue({ not: notMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.spyOn(supabase, "from").mockReturnValue({ select: selectMock } as any);

      const result = await searchSimilarKnowledge("トマト 追肥");

      expect(fromMock).toHaveBeenCalledWith("journals");
      expect(selectMock).toHaveBeenCalledWith("id, content, reply, is_approved, student_id");
      expect(eqMock).toHaveBeenCalledWith("is_approved", true);
      expect(notMock).toHaveBeenCalledWith("reply", "is", null);
      expect(neqMock).toHaveBeenCalledWith("reply", "");
      expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(limitMock).toHaveBeenCalledWith(50);

      expect(result.length).toBe(1);
      expect(result[0].question).toContain("トマトの追肥");

      fromMock.mockRestore();
    });
  });
});
