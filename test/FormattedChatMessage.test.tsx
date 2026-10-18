// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormattedChatMessage from '@/components/ui/FormattedChatMessage';

describe('FormattedChatMessage', () => {
  it('太字記法 (**テキスト**) を <strong> タグとして正しく整形し、アスタリスクを除去する', () => {
    render(<FormattedChatMessage text="これは**トマトの病気**に関するアドバイスです。" />);

    // 生のアスタリスクが表示されていないことを確認
    expect(screen.queryByText(/\*\*トマトの病気\*\*/)).toBeNull();

    // <strong> タグでテキストが描画されていることを確認
    const strongEl = screen.getByText('トマトの病気');
    expect(strongEl.tagName).toBe('STRONG');
    expect(strongEl.className).toContain('font-black');
  });

  it('箇条書き記法 (* および -) を中黒リストとして整形する', () => {
    const text = '対処法:\n* 水やりを控える\n- 日当たりの良い場所に移動する';
    render(<FormattedChatMessage text={text} />);

    expect(screen.getByText('水やりを控える')).toBeDefined();
    expect(screen.getByText('日当たりの良い場所に移動する')).toBeDefined();

    // 生の "* 水やり" や "- 日当たり" ではなくプレフィックスが除去されていること
    expect(screen.queryByText(/^\*\s+/)).toBeNull();
    expect(screen.queryByText(/^-\s+/)).toBeNull();
  });

  it('番号付きリスト (1. 2.) を正しく連番表示する', () => {
    const text = '手順:\n1. 追肥を行う\n2. 支柱を立てる';
    render(<FormattedChatMessage text={text} />);

    expect(screen.getByText('1.')).toBeDefined();
    expect(screen.getByText('追肥を行う')).toBeDefined();
    expect(screen.getByText('2.')).toBeDefined();
    expect(screen.getByText('支柱を立てる')).toBeDefined();
  });

  it('検索キーワードがある場合に <mark> でハイライトする', () => {
    render(<FormattedChatMessage text="トマトの葉が黄色くなりました。" searchKeyword="トマト" />);

    const markEl = screen.getByText('トマト');
    expect(markEl.tagName).toBe('MARK');
    expect(markEl.className).toContain('bg-amber-300');
  });

  it('isMe=true の場合は生徒自身の吹き出しとしてシンプルに描画する', () => {
    render(<FormattedChatMessage text="質問です**テスト**" isMe={true} />);
    expect(screen.getByText('質問です**テスト**')).toBeDefined();
  });

  it('Markdown テーブル (| 項目 | 内容 |) を <table> 要素として構造化描画し、生のパイプ記号や区切り行を表示しない', () => {
    const tableText =
      '| 作業項目 | 目安時期 |\n| :--- | :--- |\n| **定植** | 5月上旬 |\n| 追肥 | 5月下旬 |';
    const { container } = render(<FormattedChatMessage text={tableText} />);

    const tableEl = container.querySelector('table');
    expect(tableEl).not.toBeNull();
    expect(screen.getByText('作業項目').tagName).toBe('TH');
    expect(screen.getByText('目安時期').tagName).toBe('TH');
    expect(screen.getByText('定植').tagName).toBe('STRONG');
    expect(screen.getByText('5月上旬').tagName).toBe('TD');
    expect(screen.queryByText(/:---/)).toBeNull();
  });

  it('1行に繋がった番号付きリスト (1. 〇〇 2. △△) や1行テーブルを自動的に改行・分割して整形描画する', () => {
    const inlineListText = '対処手順： 1. 病葉を摘み取る 2. 風通しを良くする 3. 殺菌剤を散布する';
    render(<FormattedChatMessage text={inlineListText} />);

    expect(screen.getByText('1.')).toBeDefined();
    expect(screen.getByText('病葉を摘み取る')).toBeDefined();
    expect(screen.getByText('2.')).toBeDefined();
    expect(screen.getByText('風通しを良くする')).toBeDefined();
    expect(screen.getByText('3.')).toBeDefined();
    expect(screen.getByText('殺菌剤を散布する')).toBeDefined();
  });

  it('単一アスタリスクのイタリック (*テキスト*) や太字イタリック (***テキスト***)、孤立アスタリスクを整形し、アスタリスク文字を残さない', () => {
    const text = 'アドバイス: *水やりの頻度* と ***日当たり*** に注意してください。 * ';
    render(<FormattedChatMessage text={text} />);

    expect(screen.queryByText(/\*水やりの頻度\*/)).toBeNull();
    expect(screen.queryByText(/\*\*\*日当たり\*\*\*/)).toBeNull();
    expect(screen.getByText('水やりの頻度').tagName).toBe('STRONG');
    expect(screen.getByText('日当たり').tagName).toBe('STRONG');
  });
});
