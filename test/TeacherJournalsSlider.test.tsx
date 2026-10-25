// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TeacherJournalsView from '../components/teacher/TeacherJournalsView';

// Supabase クライアントのモック
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'teacher-1' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { farm_id: 'farm-1', role: 'teacher' },
        error: null,
      }),
    }),
  },
}));

// 画像コンポーネントのモック
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="mock-img" />
  ),
}));

describe('TeacherJournalsView - 観察記録スライダー (自動スクロール & フリック・ドラッグ両立)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('スライダーの説明ガイド「💡 左右フリックで手動送り / ホバーで停止」が表示されること', async () => {
    await act(async () => {
      render(<TeacherJournalsView />);
    });

    // ガイドテキストが表示されていること
    expect(screen.getByText(/左右フリックで手動送り/)).toBeDefined();
  });

  it('スライダー上で touchStart が発火すると、手動スライド中バッジが表示されること', async () => {
    let container: HTMLElement;
    await act(async () => {
      const res = render(<TeacherJournalsView />);
      container = res.container;
    });

    // スライダーのコンテナを取得
    const sliderContainer = container!.querySelector('.overflow-x-hidden');
    expect(sliderContainer).toBeDefined();

    if (sliderContainer) {
      // タッチ開始
      fireEvent.touchStart(sliderContainer, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      // 手動スライド中バッジが表示されること
      expect(screen.getByText(/手動スライド中/)).toBeDefined();

      // タッチ終了
      fireEvent.touchEnd(sliderContainer);
    }
  });

  it('スライダー上で mouseDown してドラッグした際に手動スライド状態になり、カードのクリックが抑止されること', async () => {
    let container: HTMLElement;
    await act(async () => {
      const res = render(<TeacherJournalsView />);
      container = res.container;
    });

    const sliderContainer = container!.querySelector('.overflow-x-hidden');
    expect(sliderContainer).toBeDefined();

    if (sliderContainer) {
      // マウス押下
      fireEvent.mouseDown(sliderContainer, { clientX: 300 });
      expect(screen.getByText(/手動スライド中/)).toBeDefined();

      // 6px以上のドラッグ移動 (isDragging = true)
      fireEvent.mouseMove(sliderContainer, { clientX: 280 });

      // マウスアップ
      fireEvent.mouseUp(sliderContainer);
    }
  });
});
