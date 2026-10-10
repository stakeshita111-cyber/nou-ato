// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import StudentSkillBoardView from '../components/student/StudentSkillBoardView';
import { CropRecord } from '../types/farm';

describe('StudentSkillBoardView', () => {
  const mockTasks = [
    {
      id: 't1',
      status: 'completed',
      title: '土作りタスク',
      description: '良質な堆肥をすき込みます',
      completed_at: '2026-05-10T10:00:00Z',
      badge_name: '土作り名人',
      badge_icon: '🚜',
    },
    {
      id: 't2',
      status: 'not_started',
      title: '種まきタスク',
      description: 'スジまきで均等に播種します',
      badge_name: '種まきビギナー',
      badge_icon: '🌱',
    },
    {
      id: 't3',
      status: 'not_started',
      title: '水やりタスク',
      tasks: {
        title: '水やりプロタスク',
        description: '朝夕の適切な水やり管理',
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

  const mockRecords: CropRecord[] = [
    {
      id: 'rec1',
      date: '2026-05-10',
      work_types: ['水やり', '追肥'],
      growth_stage: '発芽・活着',
      notes: '土作り完了後に元気に発芽',
      created_at: '2026-05-10T10:30:00Z',
    },
    {
      id: 'rec2',
      date: '2026-05-10',
      work_types: ['除草・土寄せ'],
      growth_stage: '発芽・活着',
      notes: '畝まわりの除草完了',
      created_at: '2026-05-10T14:00:00Z',
    },
    {
      id: 'rec3',
      date: '2026-05-15',
      work_types: ['わき芽かき・仕立て'],
      growth_stage: '本葉展開・つる伸び',
      notes: '勢いよく生長中',
      created_at: '2026-05-15T09:00:00Z',
    },
  ];

  it('renders badges with compact borderless padding, 3D spins, and without legacy footprints list', () => {
    const html = renderToStaticMarkup(
      React.createElement(StudentSkillBoardView, {
        tasks: mockTasks,
        records: mockRecords,
        user: { name: 'テスト生徒' },
      })
    );

    // バッジ連動およびaria-label/title設定の確認
    expect(html).toContain('aria-label="土作り名人"');
    expect(html).toContain('aria-label="種まきビギナー"');
    expect(html).toContain('aria-label="水やりマスター"');

    // バッジアイコンの確認
    expect(html).toContain('🚜');
    expect(html).toContain('🌱');
    expect(html).toContain('💧');

    // バッジ総数 & 獲得数表示
    expect(html).toContain('1 / 3 獲得');

    // 獲得済みバッジアイコンは3Dコイン回転表示
    expect(html).toContain('animate-spin-3d-slow');

    // 未獲得バッジのグレーアウト状態
    expect(html).toContain('grayscale');

    // 🌟 旧「クエスト達成の足跡」リストは撤廃され、新グラフが配置されていること 🌟
    expect(html).not.toContain('📜 クエスト達成の足跡');
    expect(html).toContain('📈 畑の記録データ ＆ 足跡グラフ');
  });

  it('renders expanded quest detail card on badge click and shows achievement info', () => {
    render(
      React.createElement(StudentSkillBoardView, {
        tasks: mockTasks,
        records: mockRecords,
        user: { name: 'テスト生徒' },
      })
    );

    // 獲得済みバッジ ("土作り名人") をクリック
    const unlockedBadgeBtn = screen.getByRole('button', { name: '土作り名人' });
    fireEvent.click(unlockedBadgeBtn);

    // 詳細カードにバッジ名・ステータス・達成クエスト名・獲得日が表示される
    expect(screen.getAllByText(/土作り名人/).length).toBeGreaterThan(0);
    expect(screen.getByText(/獲得済み/)).not.toBeNull();
    expect(screen.getByText(/達成したクエスト/)).not.toBeNull();
    expect(screen.getAllByText(/土作りタスク/).length).toBeGreaterThan(0);
    expect(screen.getByText(/良質な堆肥をすき込みます/)).not.toBeNull();
    expect(screen.getByText(/\+50 EXP/)).not.toBeNull();

    // 未獲得バッジ ("種まきビギナー") をクリック
    const unearnedBadgeBtn = screen.getByRole('button', { name: '種まきビギナー' });
    fireEvent.click(unearnedBadgeBtn);

    // 未獲得バッジの詳細カードに獲得条件が表示される
    expect(screen.getAllByText(/種まきビギナー/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/未獲得/).length).toBeGreaterThan(0);
    expect(screen.getByText(/対象クエスト/)).not.toBeNull();
    expect(screen.getAllByText(/種まきタスク/).length).toBeGreaterThan(0);
  });

  it('renders footprint chart with date X-axis, record count Y-axis, and highlights badge date with grayout on badge select', () => {
    const { container } = render(
      React.createElement(StudentSkillBoardView, {
        tasks: mockTasks,
        records: mockRecords,
        user: { name: 'テスト生徒' },
      })
    );

    // グラフ上に日付ラベルが表示されていることを確認 (5/10, 5/15)
    expect(screen.getByText('5/10')).not.toBeNull();
    expect(screen.getByText('5/15')).not.toBeNull();

    // 5/10 は記録2件＋タスク1件で合計3件、5/15 は記録1件
    expect(screen.getByText('3')).not.toBeNull();
    expect(screen.getByText('1')).not.toBeNull();

    // 獲得済みバッジ ("土作り名人") をクリックして連動開始
    const unlockedBadgeBtn = screen.getByRole('button', { name: '土作り名人' });
    fireEvent.click(unlockedBadgeBtn);

    // 連動中インジケーターが表示される
    expect(screen.getByText(/「土作り名人」と連動中/)).not.toBeNull();
    expect(screen.getAllByText(/2026-05-10/).length).toBeGreaterThan(0);

    // 5/10 は獲得日なのでハイライトクラス (ring-amber-400 など) が適用される
    const highlightBar = container.querySelector('.ring-amber-400');
    expect(highlightBar).not.toBeNull();

    // 5/15 など関係ない日付はグレーアウトクラス (opacity-30 や grayscale) が適用される
    const grayedOutBar = container.querySelector('.opacity-30');
    expect(grayedOutBar).not.toBeNull();
  });

  it('supports time range preset and monthly view switching for long-term contract navigation', () => {
    render(
      React.createElement(StudentSkillBoardView, {
        tasks: mockTasks,
        records: mockRecords,
        user: { name: 'テスト生徒' },
      })
    );

    // 月別展開ボタンをクリック
    const monthlyBtn = screen.getByRole('button', { name: '📊 月別' });
    fireEvent.click(monthlyBtn);

    // 月別サマリーカードが表示される
    expect(screen.getByText(/2026年5月/)).not.toBeNull();
    expect(screen.getAllByText(/4 記録/).length).toBeGreaterThan(0); // ヘッダー累計および月別カード

    // 日別展開ボタンに戻す
    const dailyBtn = screen.getByRole('button', { name: '📅 日別' });
    fireEvent.click(dailyBtn);

    // 期間プリセット (全期間, 1ヶ月, 3ヶ月, 半年) が表示されていること
    expect(screen.getByRole('button', { name: '全期間' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '1ヶ月' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '3ヶ月' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '半年' })).not.toBeNull();
  });

  it('handles empty tasks and empty records gracefully', () => {
    const html = renderToStaticMarkup(
      React.createElement(StudentSkillBoardView, { tasks: [], records: [], user: null })
    );

    expect(html).toContain('現在公開中のバッジはありません');
    expect(html).toContain('まだ畑の記録データがありません');
  });
});
