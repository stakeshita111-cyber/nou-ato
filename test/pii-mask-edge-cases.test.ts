import { describe, expect, it } from 'vitest';
import { sanitizePiiText } from '@/lib/rag/qaKnowledgeRetriever';

describe('Phase 2: sanitizePiiText PII Masking & False-Positive Tests', () => {
  describe('誤変換しないこと（一般語の保護）', () => {
    it('「葉の様子が気になります」が「子が気になります」にならず正しく保持されること', () => {
      expect(sanitizePiiText('葉の様子が気になります')).toBe('葉の様子が気になります');
    });

    it('「大丈夫です」が「大丈[ご家族]です」にならず正しく保持されること', () => {
      expect(sanitizePiiText('大丈夫です')).toBe('大丈夫です');
    });

    it('「水やりは毎日で大丈夫ですか」が「…大丈[ご家族]ですか」にならず正しく保持されること', () => {
      expect(sanitizePiiText('水やりは毎日で大丈夫ですか')).toBe('水やりは毎日で大丈夫ですか');
    });

    it('「みなさん、こんにちは」が誤変換・全削除されず正しく保持されること', () => {
      expect(sanitizePiiText('みなさん、こんにちは')).toBe('みなさん、こんにちは');
    });
  });

  describe('マスクすること（個人情報の置換）', () => {
    it('「佐藤さん」（単独）がマスクされ「[個人名]」となること', () => {
      expect(sanitizePiiText('佐藤さん')).toBe('[個人名]');
    });

    it('「佐藤さんに聞いたのですが」が文崩れせず「[個人名]に聞いたのですが」となること', () => {
      expect(sanitizePiiText('佐藤さんに聞いたのですが')).toBe('[個人名]に聞いたのですが');
    });

    it('「山田と申します」が「[受講生]と申します」にマスクされること', () => {
      expect(sanitizePiiText('山田と申します')).toBe('[受講生]と申します');
    });

    it('電話番号がマスクされること', () => {
      expect(sanitizePiiText('電話は090-1234-5678です')).toContain('[個人情報]');
    });

    it('メールアドレスがマスクされること', () => {
      expect(sanitizePiiText('連絡先はtest@example.comです')).toContain('[個人情報]');
    });

    it('「娘と一緒に」が「[ご家族]と一緒に」にマスクされること', () => {
      expect(sanitizePiiText('娘と一緒に作業しました')).toBe('[ご家族]と一緒に作業しました');
    });
  });

  describe('全部マスクされた場合の安全なフォールバック', () => {
    it('個人挨拶ブロックのみで全体が除去された場合、原文を返さず「[ご相談内容]」を返すこと', () => {
      expect(sanitizePiiText('田中さん、こんにちは！😊')).toBe('[ご相談内容]');
    });

    it('対話文脈行のみで全体が除去された場合、原文を返さず「[ご相談内容]」を返すこと', () => {
      expect(sanitizePiiText('チケット無事に復活しましたね✨')).toBe('[ご相談内容]');
    });
  });
});
