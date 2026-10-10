// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FarmFootprintChart, { ChartBadgeItem } from '../components/student/FarmFootprintChart';
import { CropRecord } from '../types/farm';

describe('FarmFootprintChart', () => {
  const mockBadges: ChartBadgeItem[] = [
    {
      id: 'b1',
      title: '土作りマスター',
      icon: '🚜',
      desc: '土作りタスククリア',
      unlocked: true,
      taskTitle: '元肥と堆肥のすき込み',
      earnedDate: '2026-05-01',
      exp: 50,
    },
    {
      id: 'b2',
      title: '収穫の喜び',
      icon: '🧺',
      desc: '初収穫達成',
      unlocked: false,
      taskTitle: 'ミニトマトの収穫',
      earnedDate: null,
      exp: 50,
    },
  ];

  const mockRecords: CropRecord[] = [
    {
      id: 'rec1',
      date: '2026-05-01',
      work_types: ['除草・土寄せ'],
      growth_stage: '播種・苗植え',
      notes: '畝立て完了',
      created_at: '2026-05-01T08:00:00Z',
    },
    {
      id: 'rec2',
      date: '2026-05-01',
      work_types: ['水やり'],
      growth_stage: '播種・苗植え',
      notes: 'たっぷり潅水',
      created_at: '2026-05-01T09:00:00Z',
    },
    {
      id: 'rec3',
      date: '2026-05-15',
      work_types: ['追肥'],
      growth_stage: '本葉展開・つる伸び',
      notes: '化成肥料を追肥',
      created_at: '2026-05-15T11:00:00Z',
    },
  ];

  it('renders footprint chart with daily record bars and displays activities on click', () => {
    const { container } = render(
      React.createElement(FarmFootprintChart, {
        records: mockRecords,
        badges: mockBadges,
        selectedBadge: null,
      })
    );

    // グラフヘッダー
    expect(screen.getByText(/畑の記録データ ＆ 足跡グラフ/)).not.toBeNull();
    expect(screen.getByText(/累計 3 記録/)).not.toBeNull();

    // 横軸日付ラベル (5/1, 5/15)
    expect(screen.getByText('5/1')).not.toBeNull();
    expect(screen.getByText('5/15')).not.toBeNull();

    // 5/1のバーをクリックすると作業詳細カードが展開
    const dayBar = container.querySelector('[title*="2026-05-01"]');
    expect(dayBar).not.toBeNull();
    if (dayBar) {
      fireEvent.click(dayBar);
    }

    // 作業タグやメモの展開確認
    expect(screen.getAllByText(/2026-05-01/).length).toBeGreaterThan(0);
    expect(screen.getByText(/計 2 件の足跡/)).not.toBeNull();
    expect(screen.getByText(/🌿 除草・土寄せ/)).not.toBeNull();
    expect(screen.getByText(/🌿 水やり/)).not.toBeNull();
  });

  it('highlights the earned badge date and grays out unrelated dates when a badge is selected', () => {
    const { container, rerender } = render(
      React.createElement(FarmFootprintChart, {
        records: mockRecords,
        badges: mockBadges,
        selectedBadge: null,
      })
    );

    // 未選択時はグレーアウトなし
    expect(container.querySelectorAll('.opacity-30').length).toBe(0);

    // 「土作りマスター」（2026-05-01獲得）を選択
    rerender(
      React.createElement(FarmFootprintChart, {
        records: mockRecords,
        badges: mockBadges,
        selectedBadge: mockBadges[0],
      })
    );

    // 連動中インジケーターが表示される
    expect(screen.getByText(/「土作りマスター」と連動中/)).not.toBeNull();

    // 5/1 はハイライトクラス (ring-amber-400)
    const highlightedBar = container.querySelector('.ring-amber-400');
    expect(highlightedBar).not.toBeNull();

    // 5/15 など無関係な日付はグレーアウト (opacity-30 / grayscale)
    const grayedBar = container.querySelector('.opacity-30');
    expect(grayedBar).not.toBeNull();
  });

  it('switches between daily and monthly views for long-term contract overview', () => {
    render(
      React.createElement(FarmFootprintChart, {
        records: mockRecords,
        badges: mockBadges,
        selectedBadge: null,
      })
    );

    // 月別ボタンをクリック
    const monthlyBtn = screen.getByRole('button', { name: '📊 月別' });
    fireEvent.click(monthlyBtn);

    // 月次サマリー
    expect(screen.getByText('2026年5月')).not.toBeNull();
    expect(screen.getByText('3 記録')).not.toBeNull();

    // 日別ボタンに戻す
    const dailyBtn = screen.getByRole('button', { name: '📅 日別' });
    fireEvent.click(dailyBtn);

    // 期間プリセットボタンが存在すること
    expect(screen.getByRole('button', { name: '全期間' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '1ヶ月' })).not.toBeNull();
  });

  it('handles empty records cleanly', () => {
    render(
      React.createElement(FarmFootprintChart, {
        records: [],
        badges: [],
        selectedBadge: null,
      })
    );

    expect(screen.getByText(/まだ畑の記録データがありません/)).not.toBeNull();
  });
});
