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

      it('「酵母を使った肥料はどうですか」が変形されないこと', () => {
        expect(sanitizePiiText('酵母を使った肥料はどうですか')).toBe(
          '酵母を使った肥料はどうですか'
        );
      });

      it('「稲妻が多いと豊作と聞きました」が変形されないこと', () => {
        expect(sanitizePiiText('稲妻が多いと豊作と聞きました')).toBe(
          '稲妻が多いと豊作と聞きました'
        );
      });

      it('「母屋の裏の畑です」が変形されないこと', () => {
        expect(sanitizePiiText('母屋の裏の畑です')).toBe('母屋の裏の畑です');
      });

      it('「分母が大きい」が変形されないこと', () => {
        expect(sanitizePiiText('分母が大きい')).toBe('分母が大きい');
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

      it('「母と一緒に植えました」→「[ご家族]と一緒に植えました」', () => {
        expect(sanitizePiiText('母と一緒に植えました')).toBe('[ご家族]と一緒に植えました');
      });

      it('「うちの妻が収穫しました」→「[ご家族]が収穫しました」', () => {
        expect(sanitizePiiText('うちの妻が収穫しました')).toBe('[ご家族]が収穫しました');
      });
    });

    describe('【個人名が残らないこと（not.toContain）】', () => {
      it('「昨日佐藤さんに聞いたら、葉の様子を見ると良いと言われました」で「佐藤」が含まれないこと', () => {
        const result = sanitizePiiText(
          '昨日佐藤さんに聞いたら、葉の様子を見ると良いと言われました'
        );
        expect(result).not.toContain('佐藤');
      });

      it('「息子の太郎が手伝ってくれました」に「太郎」が含まれないこと', () => {
        expect(sanitizePiiText('息子の太郎が手伝ってくれました')).not.toContain('太郎');
      });

      it('「うちの娘のはなこと収穫しました」に「はなこ」が含まれないこと', () => {
        expect(sanitizePiiText('うちの娘のはなこと収穫しました')).not.toContain('はなこ');
      });

      it('「明日香さんと植えました」に「香」が含まれないこと', () => {
        expect(sanitizePiiText('明日香さんと植えました')).not.toContain('香');
      });

      it('「田中様に教わりました」に「田中」が含まれないこと', () => {
        expect(sanitizePiiText('田中様に教わりました')).not.toContain('田中');
      });

      it('「タナカ様に教わりました」に「タナカ」が含まれないこと', () => {
        expect(sanitizePiiText('タナカ様に教わりました')).not.toContain('タナカ');
      });

      it('「さとうさんに聞きました」に「さとう」が含まれないこと', () => {
        expect(sanitizePiiText('さとうさんに聞きました')).not.toContain('さとう');
      });

      it('「息子の畑の太郎が手伝いました」に「太郎」が含まれないこと', () => {
        expect(sanitizePiiText('息子の畑の太郎が手伝いました')).not.toContain('太郎');
      });
    });
  });
});
