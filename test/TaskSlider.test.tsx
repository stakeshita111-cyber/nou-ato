// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, fireEvent, act, screen } from '@testing-library/react';
import TaskSlider from '../components/student/TaskSlider';

describe('TaskSlider Component', () => {
  const mockTasks = [
    {
      id: 'task-1',
      title: 'トマトの芽かき',
      description: 'わき芽を摘み取りましょう。',
      target_crop: 'トマト',
      status: 'in_progress',
    },
    {
      id: 'task-2',
      title: 'ナスへの水やり',
      description: '根元にたっぷり水をあげましょう。',
      target_crop: 'ナス',
      status: 'in_progress',
    },
    {
      id: 'task-3',
      title: 'キュウリの収穫',
      description: '大きくなった実をハサミで切り取ります。',
      target_crop: 'キュウリ',
      status: 'completed',
    },
  ];

  it('renders active task slider correctly', () => {
    const handleSelect = vi.fn();
    const handleComplete = vi.fn();

    const html = renderToStaticMarkup(
      React.createElement(TaskSlider, {
        tasks: mockTasks,
        onSelect: handleSelect,
        onComplete: handleComplete,
      })
    );

    // Active tasks count display: "1 / 2" (since 2 tasks are active and 1 is completed)
    expect(html).toContain('1 / 2');
    expect(html).toContain('進行中のタスク (2)');
    expect(html).toContain('トマトの芽かき');
    expect(html).toContain('わき芽を摘み取りましょう。');
    expect(html).toContain('📖 詳細・手順を確認して作業する');
    expect(html).toContain('‹');
    expect(html).toContain('›');
  });

  it('renders card stack (deck style) UI with background card', () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskSlider, {
        tasks: mockTasks,
        onSelect: vi.fn(),
        onComplete: vi.fn(),
      })
    );

    // Top card: トマトの芽かき (1 / 2)
    expect(html).toContain('トマトの芽かき');
    expect(html).toContain('1 / 2');

    // 2nd stacked card: ナスへの水やり (2 / 2)
    expect(html).toContain('ナスへの水やり');
    expect(html).toContain('2 / 2');

    // 2nd card stacked transform style scale(0.95)
    expect(html).toContain('scale(0.95)');
    expect(html).toContain('translateY(6px)');
  });

  it('renders 3-card stack when 3 or more active tasks exist', () => {
    const threeActiveTasks = [
      { id: 't1', title: 'タスク1', status: 'in_progress' },
      { id: 't2', title: 'タスク2', status: 'in_progress' },
      { id: 't3', title: 'タスク3', status: 'in_progress' },
    ];

    const html = renderToStaticMarkup(
      React.createElement(TaskSlider, {
        tasks: threeActiveTasks,
        onSelect: vi.fn(),
        onComplete: vi.fn(),
      })
    );

    expect(html).toContain('1 / 3');
    expect(html).toContain('2 / 3');
    expect(html).toContain('3 / 3');

    // Check stacked card transforms
    expect(html).toContain('scale(0.95)');
    expect(html).toContain('scale(0.90)');
    expect(html).toContain('translateY(12px)');
  });

  it('renders empty state when tasks list is empty', () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskSlider, {
        tasks: [],
        onSelect: vi.fn(),
        onComplete: vi.fn(),
      })
    );

    expect(html).toContain('取り組むタスクはありません');
    expect(html).toContain('講師が教材を公開すると、ここに表示されます。');
  });

  it('renders completed tasks when toggled', () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskSlider, {
        tasks: [
          {
            id: 'task-3',
            title: 'キュウリの収穫',
            description: '収穫完了',
            target_crop: 'キュウリ',
            status: 'completed',
          },
        ],
        onSelect: vi.fn(),
        onComplete: vi.fn(),
      })
    );

    expect(html).toContain('すべてのタスクを完了しました！');
    expect(html).toContain('完了済みを表示 (1)');
  });

  describe('Interactive Touch Flick & Swipe Tests', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('switches to the next task on quick left flick (<= 300ms, >= 25px offset)', () => {
      const { container } = render(
        <TaskSlider tasks={mockTasks} onSelect={vi.fn()} onComplete={vi.fn()} />
      );

      // Top card initially shows task 1
      expect(screen.getByText('1 / 2')).not.toBeNull();
      expect(screen.getByText('トマトの芽かき')).not.toBeNull();

      const touchArea = container.querySelector('.touch-pan-y');
      expect(touchArea).not.toBeNull();

      // Quick flick left (30px move in 100ms)
      const now = Date.now();
      vi.setSystemTime(now);

      fireEvent.touchStart(touchArea!, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchMove(touchArea!, {
        touches: [{ clientX: 170, clientY: 100 }],
      });

      vi.setSystemTime(now + 100);

      fireEvent.touchEnd(touchArea!);

      // Advance timers by 350ms animation duration
      act(() => {
        vi.advanceTimersByTime(350);
      });

      // Now top task should be task 2 ("ナスへの水やり")
      expect(screen.getByText('2 / 2')).not.toBeNull();
      expect(screen.getByText('ナスへの水やり')).not.toBeNull();
    });

    it('switches to the next task on normal left swipe (>= 35px offset)', () => {
      const { container } = render(
        <TaskSlider tasks={mockTasks} onSelect={vi.fn()} onComplete={vi.fn()} />
      );

      const touchArea = container.querySelector('.touch-pan-y');

      // Slow swipe left (40px move in 500ms)
      const now = Date.now();
      vi.setSystemTime(now);

      fireEvent.touchStart(touchArea!, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchMove(touchArea!, {
        touches: [{ clientX: 160, clientY: 100 }],
      });

      vi.setSystemTime(now + 500);

      fireEvent.touchEnd(touchArea!);

      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(screen.getByText('2 / 2')).not.toBeNull();
      expect(screen.getByText('ナスへの水やり')).not.toBeNull();
    });

    it('switches to the previous task on quick right flick (looping to last active task)', () => {
      const { container } = render(
        <TaskSlider tasks={mockTasks} onSelect={vi.fn()} onComplete={vi.fn()} />
      );

      const touchArea = container.querySelector('.touch-pan-y');

      // Quick flick right (30px move in 100ms) from task 1 -> loops to task 2
      const now = Date.now();
      vi.setSystemTime(now);

      fireEvent.touchStart(touchArea!, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchMove(touchArea!, {
        touches: [{ clientX: 130, clientY: 100 }],
      });

      vi.setSystemTime(now + 100);

      fireEvent.touchEnd(touchArea!);

      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(screen.getByText('2 / 2')).not.toBeNull();
      expect(screen.getByText('ナスへの水やり')).not.toBeNull();
    });

    it('does not switch task if touch drag distance is below thresholds', () => {
      const { container } = render(
        <TaskSlider tasks={mockTasks} onSelect={vi.fn()} onComplete={vi.fn()} />
      );

      const touchArea = container.querySelector('.touch-pan-y');

      // Slow small swipe (10px move in 500ms)
      const now = Date.now();
      vi.setSystemTime(now);

      fireEvent.touchStart(touchArea!, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchMove(touchArea!, {
        touches: [{ clientX: 190, clientY: 100 }],
      });

      vi.setSystemTime(now + 500);

      fireEvent.touchEnd(touchArea!);

      act(() => {
        vi.advanceTimersByTime(350);
      });

      // Task remains as task 1
      expect(screen.getByText('1 / 2')).not.toBeNull();
      expect(screen.getByText('トマトの芽かき')).not.toBeNull();
    });
  });
});
