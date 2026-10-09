// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import StudentSkillBoardView from '../components/student/StudentSkillBoardView';

describe('StudentSkillBoardView', () => {
  const mockTasks = [
    {
      id: 't1',
      status: 'completed',
      title: '土作りタスク',
      badge_name: '土作り名人',
      badge_icon: '🚜',
    },
    {
      id: 't2',
      status: 'not_started',
      title: '種まきタスク',
      badge_name: '種まきビギナー',
      badge_icon: '🌱',
    },
    {
      id: 't3',
      status: 'not_started',
      title: '水やりタスク',
      tasks: {
        title: '水やりプロタスク',
        badge_name: '水やりマスター',
        badge_icon: '💧',
      },
    },
    {
      id: 't4',
      status: 'not_started',
      title: 'バッジなしタスク',
    },
  ];

  it('renders grid list slots with static icon display and without clipping 3D spins in list', () => {
    const html = renderToStaticMarkup(
      React.createElement(StudentSkillBoardView, { tasks: mockTasks, user: { name: 'テスト生徒' } })
    );

    // バッジ連動およびaria-label/title設定の確認
    expect(html).toContain('aria-label="土作り名人"');
    expect(html).toContain('aria-label="種まきビギナー"');
    expect(html).toContain('aria-label="水やりマスター"');

    // バッジ記号（アイコン）の確認
    expect(html).toContain('🚜');
    expect(html).toContain('🌱');
    expect(html).toContain('💧');

    // バッジ総数 & 獲得数表示
    expect(html).toContain('1 / 3 獲得');

    // 一覧スロットの獲得済みバッジアイコンは3Dコイン回転表示
    expect(html).toContain('animate-spin-3d-slow');

    // 未獲得バッジのグレーアウト状態
    expect(html).toContain('grayscale');

    // スライドアニメーションクラス
    expect(html).toContain('animate-slide-left');

    // 成長の足跡確認
    expect(html).toContain('土作りタスク');
  });

  it('renders expanded detail card with main 3D rotation, badge title, status, and cleared task name on click', () => {
    render(
      React.createElement(StudentSkillBoardView, { tasks: mockTasks, user: { name: 'テスト生徒' } })
    );

    // Click on unlocked badge ("土作り名人")
    const unlockedBadgeBtn = screen.getByRole('button', { name: '土作り名人' });
    fireEvent.click(unlockedBadgeBtn);

    // Detail card renders badge title, status badge, and clear task name
    expect(screen.getByText(/土作り名人/)).not.toBeNull();
    expect(screen.getByText('獲得済み')).not.toBeNull();
    expect(screen.getByText(/✅ クリアタスク:/)).not.toBeNull();
    expect(screen.getAllByText('土作りタスク').length).toBeGreaterThan(0);

    // Check that unlocked badge in slot grid has 3D rotation animation class
    expect(unlockedBadgeBtn.querySelector('.animate-spin-3d-slow')).not.toBeNull();

    // Click on unearned badge ("種まきビギナー")
    const unearnedBadgeBtn = screen.getByRole('button', { name: '種まきビギナー' });
    fireEvent.click(unearnedBadgeBtn);

    // Detail card renders unearned badge title, status badge, and acquisition condition
    expect(screen.getByText(/種まきビギナー/)).not.toBeNull();
    expect(screen.getByText('未獲得')).not.toBeNull();
    expect(screen.getByText(/🔒 獲得条件:/)).not.toBeNull();
    expect(screen.getByText('種まきタスク')).not.toBeNull();
    expect(screen.getByText(/をクリアする/)).not.toBeNull();
  });

  it('extracts badges correctly when badge info is in nested tasks or direct properties', () => {
    const mockNestedTasks = [
      {
        id: 't10',
        status: 'completed',
        tasks: {
          title: '芽かき作業',
          badge_name: '芽かきマスター',
          badge_icon: '✂️',
        },
      },
    ];

    render(
      React.createElement(StudentSkillBoardView, {
        tasks: mockNestedTasks,
        user: { name: 'テスト生徒' },
      })
    );

    const badgeBtn = screen.getByRole('button', { name: '芽かきマスター' });
    expect(badgeBtn).not.toBeNull();

    fireEvent.click(badgeBtn);

    expect(screen.getByText(/芽かきマスター/)).not.toBeNull();
    expect(screen.getByText('獲得済み')).not.toBeNull();
    expect(screen.getAllByText('芽かき作業').length).toBeGreaterThan(0);
  });

  it('handles empty tasks gracefully', () => {
    const html = renderToStaticMarkup(
      React.createElement(StudentSkillBoardView, { tasks: [], user: null })
    );

    expect(html).toContain('現在公開中のバッジはありません');
    expect(html).toContain('まだ達成したクエストはありません');
  });
});
