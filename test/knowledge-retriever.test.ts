import { describe, it, expect, vi } from 'vitest';
import {
  sanitizePiiText,
  extractTopicFromReply,
  CROPS_LIST,
  STOP_WORDS,
  searchSimilarKnowledge,
} from '@/lib/rag/qaKnowledgeRetriever';
import { supabase } from '@/lib/supabase';

describe('Knowledge Retriever & Quality Logic Tests (コード品質・プライバシー保護)', () => {
  describe('1. 包括的PIIサニタイズ (sanitizePiiText / sanitizePersonalNames)', () => {
    it('受講生の動的表示名リストに基づくサニタイズが機能し、任意の名前が[受講生]等に置換されること', () => {
      const raw = '山田太郎さん、こんにちは！佐藤花子様のイチゴ栽培についてご案内します。';
      const cleaned = sanitizePiiText(raw, ['山田太郎', '佐藤花子']);
      expect(cleaned).not.toContain('山田太郎');
      expect(cleaned).not.toContain('佐藤花子');
      expect(cleaned).toContain('[受講生]');
    });

    it('文頭の個人向け挨拶（『〇〇さん、こんにちは！😊』）を完全に除去すること', () => {
      const raw = '受講生さん、こんにちは！😊\nトマトの芽かきについてアドバイスします。';
      const cleaned = sanitizePiiText(raw);
      expect(cleaned).not.toContain('受講生さん');
      expect(cleaned).toBe('トマトの芽かきについてアドバイスします。');
    });

    it('文中の個人名呼びかけ（『〜さん、』『〜様』等）を除去すること', () => {
      const raw = '佐藤さん、追肥の時期は植え付けから3週間後です。';
      const cleaned = sanitizePiiText(raw);
      expect(cleaned).not.toContain('佐藤さん');
      expect(cleaned).toContain('追肥の時期は植え付けから3週間後です。');
    });

    it('『受講生の〇〇さん』を『受講生の方』に一般化すること', () => {
      const raw = '受講生の鈴木さんからのご相談ですね。';
      const cleaned = sanitizePiiText(raw);
      expect(cleaned).toContain('受講生の方');
      expect(cleaned).not.toContain('鈴木');
    });

    it('チケット復活などの対話文脈行を除去すること', () => {
      const raw = 'チケット無事に復活しましたね✨\n本日の作業はナスの支柱立てです。';
      const cleaned = sanitizePiiText(raw);
      expect(cleaned).not.toContain('チケット無事');
      expect(cleaned).toBe('本日の作業はナスの支柱立てです。');
    });

    it('電話番号・メールアドレス・住所・SNSアカウント・名乗り・家族情報を検知しサニタイズすること', () => {
      const text1 =
        '連絡先は090-1234-5678とtest@example.comです。住所は〒150-0001 東京都渋谷区神宮前1-2-3です。';
      const clean1 = sanitizePiiText(text1);
      expect(clean1).not.toContain('090-1234-5678');
      expect(clean1).not.toContain('test@example.com');
      expect(clean1).not.toContain('東京都渋谷区神宮前1-2-3');
      expect(clean1).toContain('[個人情報]');

      const text2 = 'LINE ID: tanaka_nouen まで連絡ください。山田太郎です。田中と申します。';
      const clean2 = sanitizePiiText(text2);
      expect(clean2).not.toContain('tanaka_nouen');
      expect(clean2).not.toContain('山田太郎です');
      expect(clean2).not.toContain('田中と申します');
      expect(clean2).toContain('[受講生]です');
      expect(clean2).toContain('[受講生]と申します');

      const text3 = 'うちの娘がトマトの苗を植えました。息子の健太も手伝いました。';
      const clean3 = sanitizePiiText(text3);
      expect(clean3).not.toContain('うちの娘');
      expect(clean3).not.toContain('息子の健太');
      expect(clean3).toContain('[ご家族]');
    });
  });

  describe('2. 作物リストと作物フィルタリング整合性 (CROPS_LIST)', () => {
    it('主要作物が網羅されていること', () => {
      expect(CROPS_LIST).toContain('トマト');
      expect(CROPS_LIST).toContain('きゅうり');
      expect(CROPS_LIST).toContain('ナス');
      expect(CROPS_LIST).toContain('枝豆');
      expect(CROPS_LIST).toContain('ジャガイモ');
    });

    it('ユーザー質問から正しい作物が特定できること', () => {
      const question = '枝豆の葉っぱに虫がついて困っています';
      const matchedCrops = CROPS_LIST.filter((crop) => question.includes(crop));
      expect(matchedCrops).toContain('枝豆');
      expect(matchedCrops).not.toContain('トマト');
    });
  });

  describe('3. ストップワード除去と重要キーワード抽出 (STOP_WORDS)', () => {
    it('助詞や一般的すぎる単語が正しく登録されていること', () => {
      expect(STOP_WORDS).toContain('教えて');
      expect(STOP_WORDS).toContain('ください');
      expect(STOP_WORDS).toContain('どうすれば');
      expect(STOP_WORDS).toContain('方法');
    });

    it('質問からストップワードを除去して重要単語のみ抽出できること', () => {
      const question = 'トマトの追肥のやり方を教えてください';
      const rawTokens = question.replace(/[、。！？!?]/g, ' ').split(/\s+/);
      const keywords = rawTokens.filter((token) => !STOP_WORDS.includes(token));

      expect(keywords.some((k) => k.includes('トマト'))).toBe(true);
      expect(keywords.some((k) => k.includes('追肥'))).toBe(true);
    });
  });

  describe('4. 回答からのトピック抽出機能 (extractTopicFromReply)', () => {
    it('回答内に【相談トピック: 〇〇】がある場合、正しく抽出すること', () => {
      const reply =
        '【相談トピック: トマトの葉の黄変と追肥について】\nこんにちは！トマトの葉が黄色くなった場合は...';
      const topic = extractTopicFromReply(reply);
      expect(topic).toBe('【相談トピック: トマトの葉の黄変と追肥について】');
    });

    it('回答内に【農園アドバイス: 〇〇】がある場合、トピック形式に変換して抽出すること', () => {
      const reply =
        '【農園アドバイス：追肥の基本】🌱\n植え付けから2〜3週間後が1回目の追肥タイミングです。';
      const topic = extractTopicFromReply(reply);
      expect(topic).toBe('【相談トピック: 追肥の基本】');
    });

    it('トピック明記がない旧形式の回答でも適切な一般化トピックを返却すること', () => {
      const reply = '一般的な家庭菜園の知識として、水やりは朝の時間帯がベストです。';
      const topic = extractTopicFromReply(reply);
      expect(topic).toBe('【相談トピック: 野菜の栽培・管理について】');
    });
  });

  describe('5. 過去ナレッジ検索と生徒生相談文の完全排除 (searchSimilarKnowledge)', () => {
    it("journals テーブルから select('id, reply, is_approved, is_private, student_id') のみを取得し content を要求しないこと", async () => {
      const mockApprovedData = [
        {
          id: '1',
          reply:
            '【相談トピック: トマトの追肥について】\nトマトの追肥は植え付けから3週間後に行います。',
          is_approved: true,
          is_private: false,
          student_id: 's1',
        },
      ];

      const limitMock = vi.fn().mockResolvedValue({ data: mockApprovedData, error: null });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const neqMock = vi.fn().mockReturnValue({ order: orderMock });
      const notMock = vi.fn().mockReturnValue({ neq: neqMock });
      const eqMock = vi.fn();
      eqMock.mockReturnValue({ eq: eqMock, not: notMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi
        .spyOn(supabase, 'from')
        .mockReturnValue({ select: selectMock } as unknown as ReturnType<typeof supabase.from>);

      const result = await searchSimilarKnowledge('トマト 追肥');

      expect(fromMock).toHaveBeenCalledWith('journals');
      expect(selectMock).toHaveBeenCalledWith('id, reply, is_approved, is_private, student_id');
      expect(eqMock).toHaveBeenCalledWith('is_approved', true);
      expect(eqMock).toHaveBeenCalledWith('is_private', false);
      expect(notMock).toHaveBeenCalledWith('reply', 'is', null);
      expect(neqMock).toHaveBeenCalledWith('reply', '');
      expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(limitMock).toHaveBeenCalledWith(50);

      expect(result.length).toBe(1);
      expect(result[0].question).toBe('【相談トピック: トマトの追肥について】');
      expect(result[0].answer).toContain('トマトの追肥は植え付けから3週間後に行います。');

      fromMock.mockRestore();
    });

    it('生徒の生相談文(content)のキーワードは無視され、回答文(reply)のみから意図通りヒット・スコアリングされること', async () => {
      const mockDbData = [
        {
          id: '101',
          content:
            '山田太郎です。電話090-1234-5678。住所は東京都渋谷区。緊急でカボチャの相談です。',
          reply:
            '【相談トピック: ナスの支柱立てと追肥方法】\nナスの支柱は風で倒れないよう早めに立て、追肥は2週間おきに施してください。',
          is_approved: true,
          is_private: false,
          student_id: 's101',
        },
      ];

      const limitMock = vi.fn().mockResolvedValue({ data: mockDbData, error: null });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const neqMock = vi.fn().mockReturnValue({ order: orderMock });
      const notMock = vi.fn().mockReturnValue({ neq: neqMock });
      const eqMock = vi.fn();
      eqMock.mockReturnValue({ eq: eqMock, not: notMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi
        .spyOn(supabase, 'from')
        .mockReturnValue({ select: selectMock } as unknown as ReturnType<typeof supabase.from>);

      // 1. content のみに含まれるキーワード（「カボチャ」）で検索してもヒットしないこと
      const pumpkinResult = await searchSimilarKnowledge('カボチャ 相談');
      expect(pumpkinResult.length).toBe(0);

      // 2. reply に含まれるキーワード（「ナス 追肥」）で正しくヒットすること
      const eggplantResult = await searchSimilarKnowledge('ナス 追肥');
      expect(eggplantResult.length).toBe(1);
      expect(eggplantResult[0].question).toBe('【相談トピック: ナスの支柱立てと追肥方法】');
      expect(eggplantResult[0].question).not.toContain('山田太郎');
      expect(eggplantResult[0].question).not.toContain('カボチャ');
      expect(eggplantResult[0].answer).not.toContain('山田太郎');

      fromMock.mockRestore();
    });

    it('作物不一致の誤ヒット防止が reply のみに対して正常動作すること', async () => {
      const mockDbData = [
        {
          id: '201',
          content: 'トマトを育てています。枝豆の栽培について教えてください。',
          reply:
            '【相談トピック: 枝豆のカメムシ対策について】\n枝豆にカメムシが発生した場合は防虫ネットを張りましょう。',
          is_approved: true,
          is_private: false,
          student_id: 's201',
        },
      ];

      const limitMock = vi.fn().mockResolvedValue({ data: mockDbData, error: null });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const neqMock = vi.fn().mockReturnValue({ order: orderMock });
      const notMock = vi.fn().mockReturnValue({ neq: neqMock });
      const eqMock = vi.fn();
      eqMock.mockReturnValue({ eq: eqMock, not: notMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi
        .spyOn(supabase, 'from')
        .mockReturnValue({ select: selectMock } as unknown as ReturnType<typeof supabase.from>);

      // ユーザーがトマトについて質問した際、replyにトマトが含まれないため除外されること
      const tomatoResult = await searchSimilarKnowledge('トマト 防虫ネット');
      expect(tomatoResult.length).toBe(0);

      // 枝豆で質問した場合はヒットすること
      const edamameResult = await searchSimilarKnowledge('枝豆 カメムシ');
      expect(edamameResult.length).toBe(1);

      fromMock.mockRestore();
    });
  });
});
