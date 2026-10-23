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

  describe('ユーザー指定コーパス検証（PR #211 差し戻し修正）', () => {
    describe('【変えてはいけない】', () => {
      it('「同じ様に植えても大丈夫ですか」が変形されないこと', () => {
        expect(sanitizePiiText('同じ様に植えても大丈夫ですか')).toBe(
          '同じ様に植えても大丈夫ですか'
        );
      });

      it('「この様な症状は病気ですか」が変形されないこと', () => {
        expect(sanitizePiiText('この様な症状は病気ですか')).toBe('この様な症状は病気ですか');
      });

      it('「お日様に当てた方がいいですか」が変形されないこと', () => {
        expect(sanitizePiiText('お日様に当てた方がいいですか')).toBe(
          'お日様に当てた方がいいですか'
        );
      });

      it('「赤ちゃんの手のひらくらいの葉です」が変形されないこと', () => {
        expect(sanitizePiiText('赤ちゃんの手のひらくらいの葉です')).toBe(
          '赤ちゃんの手のひらくらいの葉です'
        );
      });

      it('「工夫して支柱を立てました」が変形されないこと', () => {
        expect(sanitizePiiText('工夫して支柱を立てました')).toBe('工夫して支柱を立てました');
      });

      it('「様々な害虫が出ます」が変形されないこと', () => {
        expect(sanitizePiiText('様々な害虫が出ます')).toBe('様々な害虫が出ます');
      });

      it('「先生、トマトの脇芽はどうしますか」が変形されないこと', () => {
        expect(sanitizePiiText('先生、トマトの脇芽はどうしますか')).toBe(
          '先生、トマトの脇芽はどうしますか'
        );
      });
    });

    describe('【完全一致で期待値どおりになること】', () => {
      it('「お母さんと一緒に収穫しました」→「[ご家族]と一緒に収穫しました」', () => {
        expect(sanitizePiiText('お母さんと一緒に収穫しました')).toBe(
          '[ご家族]と一緒に収穫しました'
        );
      });

      it('「おじいちゃんの畑を手伝っています」→「[ご家族]の畑を手伝っています」', () => {
        expect(sanitizePiiText('おじいちゃんの畑を手伝っています')).toBe(
          '[ご家族]の畑を手伝っています'
        );
      });

      it('「トマトの苗を植えました。佐藤さん、ありがとう」→「トマトの苗を植えました。[個人名]、ありがとう」', () => {
        expect(sanitizePiiText('トマトの苗を植えました。佐藤さん、ありがとう')).toBe(
          'トマトの苗を植えました。[個人名]、ありがとう'
        );
      });
    });

    describe('【「佐藤」が残らないこと（toContain で否定）】', () => {
      it('「昨日佐藤さんに聞いたら、葉の様子を見ると良いと言われました」で「佐藤」が残らず「昨日」が残ること', () => {
        const result = sanitizePiiText(
          '昨日佐藤さんに聞いたら、葉の様子を見ると良いと言われました'
        );
        expect(result).not.toContain('佐藤');
        expect(result).toContain('昨日');
      });
    });
  });
});
