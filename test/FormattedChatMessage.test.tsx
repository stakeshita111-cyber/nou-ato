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
});
