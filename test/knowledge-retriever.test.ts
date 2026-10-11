import { describe, it, expect, vi } from 'vitest';
import {
  sanitizePiiText,
  extractTopicFromReply,
  CROPS_LIST,
  STOP_WORDS,
  searchSimilarKnowledge,
  fetchStudentDisplayNames,
  getAnswerWithRag,
  KnowledgeSearchError,
} from '@/lib/rag/qaKnowledgeRetriever';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

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
      expect(clean2).toContain('[個人情報]');
      expect(clean2).toContain('[受講生]');

      const text3 = '妻と息子と娘と一緒に体験農園に行きます。';
      const clean3 = sanitizePiiText(text3);
      expect(clean3).not.toContain('妻と息子と娘');
      expect(clean3).toContain('ご家族');
    });
  });

  describe('2. 定数リストの健全性 (CROPS_LIST, STOP_WORDS)', () => {
    it('CROPS_LIST が主要な作物を網羅し重複がないこと', () => {
      expect(CROPS_LIST.length).toBeGreaterThan(30);
      const unique = new Set(CROPS_LIST);
      expect(unique.size).toBe(CROPS_LIST.length);
      expect(CROPS_LIST).toContain('トマト');
      expect(CROPS_LIST).toContain('ナス');
      expect(CROPS_LIST).toContain('枝豆');
    });

    it('STOP_WORDS が過剰な語句を含まず適切に定義されていること', () => {
      expect(STOP_WORDS).toContain('について');
      expect(STOP_WORDS).toContain('教えて');
      expect(STOP_WORDS).toContain('どうすれば');
    });
  });

  describe('3. トピック見出しの抽出 (extractTopicFromReply)', () => {
    it('正規フォーマットの見出しが正しく抽出されること', () => {
      const reply =
        '【相談トピック: トマトの追肥時期について】\n植え付けから3週間後に追肥を行います。';
      const topic = extractTopicFromReply(reply);
      expect(topic).toBe('【相談トピック: トマトの追肥時期について】');
    });

    it('フォーマットがない場合はデフォルトのトピック見出しを返すこと', () => {
      const reply = '一般的な家庭菜園の知識として、水やりは朝の時間帯がベストです。';
      const topic = extractTopicFromReply(reply);
      expect(topic).toBe('【相談トピック: 野菜の栽培・管理について】');
    });
  });

  describe('4. 自農園メンバー名のRPC取得 (fetchStudentDisplayNames)', () => {
    it('list_farm_member_names RPC からメンバーの表示名リストを取得できること', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [{ display_name: '田中次郎' }, { display_name: '佐藤花子' }, { display_name: 'A' }],
        error: null,
      });
      const mockDb = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

      const names = await fetchStudentDisplayNames(mockDb);
      expect(mockRpc).toHaveBeenCalledWith('list_farm_member_names');
      expect(names).toEqual(['田中次郎', '佐藤花子']);
    });

    it('RPCエラー時は例外を投げること（直接テーブルクエリへフォールバックしてPIIマスキング欠落を起こさない）', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'permission denied' },
      });
      const mockDb = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

      await expect(fetchStudentDisplayNames(mockDb)).rejects.toThrow(
        'Failed to fetch student display names'
      );
    });
  });

  describe('5. 過去ナレッジ検索と生徒生相談文の完全排除 (searchSimilarKnowledge)', () => {
    it('search_knowledge_candidates RPC 経由で取得し、journals テーブルを直接 SELECT しないこと', async () => {
      const mockApprovedData = [
        {
          id: '1',
          reply:
            '【相談トピック: トマトの追肥について】\nトマトの追肥は植え付けから3週間後に行います。',
          created_at: new Date().toISOString(),
        },
      ];

      const mockRpc = vi.fn().mockResolvedValue({ data: mockApprovedData, error: null });
      const mockFrom = vi.fn();
      const mockDb = { rpc: mockRpc, from: mockFrom } as unknown as SupabaseClient<Database>;

      const result = await searchSimilarKnowledge(mockDb, 'トマト 追肥');

      expect(mockRpc).toHaveBeenCalledWith('search_knowledge_candidates', { p_limit: 50 });
      expect(mockFrom).not.toHaveBeenCalled();

      expect(result.length).toBe(1);
      expect(result[0].question).toBe('【相談トピック: トマトの追肥について】');
      expect(result[0].answer).toContain('トマトの追肥は植え付けから3週間後に行います。');
    });

    it('search_knowledge_candidates RPC 失敗時に KnowledgeSearchError をスローすること', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'relation error' },
      });
      const mockDb = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

      await expect(searchSimilarKnowledge(mockDb, 'トマト 追肥')).rejects.toThrow(
        KnowledgeSearchError
      );
    });

    it('生徒の生相談文のキーワードは含まれず、回答文(reply)のみから意図通りヒット・スコアリングされること', async () => {
      const mockDbData = [
        {
          id: '101',
          reply:
            '【相談トピック: ナスの支柱立てと追肥方法】\nナスの支柱は風で倒れないよう早めに立て、追肥は2週間おきに施してください。',
          created_at: new Date().toISOString(),
        },
      ];

      const mockRpc = vi.fn().mockResolvedValue({ data: mockDbData, error: null });
      const mockDb = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

      // 1. reply に含まれないキーワード（「カボチャ」）で検索してもヒットしないこと
      const pumpkinResult = await searchSimilarKnowledge(mockDb, 'カボチャ 相談');
      expect(pumpkinResult.length).toBe(0);

      // 2. reply に含まれるキーワード（「ナス 追肥」）で正しくヒットすること
      const eggplantResult = await searchSimilarKnowledge(mockDb, 'ナス 追肥');
      expect(eggplantResult.length).toBe(1);
      expect(eggplantResult[0].question).toBe('【相談トピック: ナスの支柱立てと追肥方法】');
      expect(eggplantResult[0].question).not.toContain('山田太郎');
      expect(eggplantResult[0].question).not.toContain('カボチャ');
    });

    it('作物不一致の誤ヒット防止が reply のみに対して正常動作すること', async () => {
      const mockDbData = [
        {
          id: '201',
          reply:
            '【相談トピック: 枝豆のカメムシ対策について】\n枝豆にカメムシが発生した場合は防虫ネットを張りましょう。',
          created_at: new Date().toISOString(),
        },
      ];

      const mockRpc = vi.fn().mockResolvedValue({ data: mockDbData, error: null });
      const mockDb = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

      // ユーザーがトマトについて質問した際、replyにトマトが含まれないため除外されること
      const tomatoResult = await searchSimilarKnowledge(mockDb, 'トマト 防虫ネット');
      expect(tomatoResult.length).toBe(0);

      // 枝豆で質問した場合はヒットすること
      const edamameResult = await searchSimilarKnowledge(mockDb, '枝豆 カメムシ');
      expect(edamameResult.length).toBe(1);
    });
  });

  describe('6. 異常系ハンドリング (getAnswerWithRag)', () => {
    it('表示名取得RPC失敗時はPII保護のためGemini呼び出しを行わず status: degraded を返すこと', async () => {
      const mockRpc = vi.fn().mockImplementation((fnName: string) => {
        if (fnName === 'list_farm_member_names') {
          return Promise.resolve({ data: null, error: { message: 'db connection error' } });
        }
        return Promise.resolve({ data: [], error: null });
      });
      const mockDb = { rpc: mockRpc } as unknown as SupabaseClient<Database>;

      const result = await getAnswerWithRag(mockDb, 'トマトの育て方');
      expect(result.status).toBe('degraded');
      expect(result.reply).toContain('AI相棒（しるべぇ）よりお知らせ');
    });
  });
});
