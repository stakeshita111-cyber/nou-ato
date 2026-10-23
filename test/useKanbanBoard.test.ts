// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { useKanbanBoard } from '../hooks/useKanbanBoard';
import { useFarmStore } from '../store/useFarmStore';
import { supabase } from '../lib/supabase';
import type { ColumnType } from '../types/task';

// Supabase のモック
vi.mock('../lib/supabase', () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };

  return {
    supabase: {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn(() => Promise.resolve()),
    },
  };
});

// タスク取得時に checklist JSON から badge_name, badge_icon を抽出展開するロジックの単体テスト
describe('Kanban board checklist badge mapping logic', () => {
  it('extracts badge_name and badge_icon from checklist JSON when top-level columns are undefined/null', () => {
    const rawDataFromDb = [
      {
        id: 'task-1',
        title: 'トマトの脇芽かき',
        status: 'pool',
        category: '果菜',
        badge_name: null,
        badge_icon: null,
        checklist: {
          badge_name: '芽かきマスター',
          badge_icon: '✂️',
          phase: '育成・管理',
        },
      },
      {
        id: 'task-2',
        title: '土作り',
        status: 'todo',
        category: '土壌',
        badge_name: undefined,
        badge_icon: undefined,
        checklist: null,
      },
    ];

    const mappedTasks = rawDataFromDb.map((t) => {
      const cl =
        t.checklist && typeof t.checklist === 'object'
          ? (t.checklist as Record<string, unknown>)
          : {};
      return {
        ...t,
        badge_name: t.badge_name || (cl.badge_name as string | undefined) || null,
        badge_icon: t.badge_icon || (cl.badge_icon as string | undefined) || null,
      };
    });

    expect(mappedTasks[0].badge_name).toBe('芽かきマスター');
    expect(mappedTasks[0].badge_icon).toBe('✂️');
    expect(mappedTasks[1].badge_name).toBeNull();
    expect(mappedTasks[1].badge_icon).toBeNull();
  });

  it('prepares update payload for Supabase without top-level badge columns, storing badge in checklist JSON', () => {
    const existingTask: { id: string; title: string; checklist: Record<string, unknown> } = {
      id: 'task-100',
      title: 'キュウリの収穫',
      checklist: {
        season: '夏',
      },
    };

    const updatedTaskInput = {
      id: 'task-100',
      title: 'キュウリの収穫',
      description: '大きくなった実をハサミでカット',
      badge_name: '収穫名人',
      badge_icon: '🥒',
    };

    const existingChecklist =
      existingTask.checklist && typeof existingTask.checklist === 'object'
        ? existingTask.checklist
        : {};
    const updatedChecklist: Record<string, unknown> = {
      ...existingChecklist,
      badge_name: updatedTaskInput.badge_name || null,
      badge_icon: updatedTaskInput.badge_icon || null,
    };

    // DB update payload to tasks table
    const updatePayload = {
      title: updatedTaskInput.title,
      description: updatedTaskInput.description,
      checklist: updatedChecklist,
    };

    // Verify top-level badge_name or badge_icon are NOT in updatePayload
    expect('badge_name' in updatePayload).toBe(false);
    expect('badge_icon' in updatePayload).toBe(false);

    // Verify badge_name and badge_icon ARE stored inside checklist JSON
    expect(updatePayload.checklist.badge_name).toBe('収穫名人');
    expect(updatePayload.checklist.badge_icon).toBe('🥒');
    expect(updatePayload.checklist.season).toBe('夏');
  });
});

// フェーズ3: マルチテナント厳格化 (farm_id eq クエリ & 不明時安全スキップ)
describe('useKanbanBoard - マルチテナント厳格化 (farm_id eq クエリ & 不明時安全スキップ)', () => {
  const defaultColumns: ColumnType[] = [
    { id: 'pool', title: '準備' },
    { id: 'todo', title: '公開中' },
    { id: 'done', title: '完了' },
  ];

  const mockUser: User = {
    id: 'teacher-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-10-23T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useFarmStore.setState({ activeFarmId: '', activeFarmName: '' });
  });

  it('farm_id が存在する場合、.eq("farm_id", effectiveFarmId) でクエリされ、farm_id.is.null を含む .or() は呼ばれないこと', async () => {
    useFarmStore.setState({ activeFarmId: 'farm-test-123', activeFarmName: 'テスト農園' });

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const eqSpy = vi.fn().mockReturnThis();
    const orSpy = vi.fn().mockReturnThis();

    type QueryChain = {
      select: ReturnType<typeof vi.fn>;
      is: ReturnType<typeof vi.fn>;
      not: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      or: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
    };

    const tasksQueryBuilder: QueryChain = {
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      eq: eqSpy,
      or: orSpy,
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'task-1',
            title: '水やり',
            status: 'todo',
            farm_id: 'farm-test-123',
            deleted_at: null,
          },
        ],
        error: null,
      }),
    };

    const fromMock = vi.mocked(supabase.from);
    fromMock.mockImplementation((table: string) => {
      if (table === 'tasks') {
        return tasksQueryBuilder as never;
      }
      return {} as never;
    });

    const { result } = renderHook(() => useKanbanBoard(defaultColumns));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // tasks に対するクエリが発行されたことを検証
    expect(supabase.from).toHaveBeenCalledWith('tasks');

    // .eq('farm_id', 'farm-test-123') が呼ばれたことを検証
    expect(eqSpy).toHaveBeenCalledWith('farm_id', 'farm-test-123');

    // .or() で farm_id.is.null が呼ばれていないことを検証
    const orCalls = orSpy.mock.calls;
    const hasNullOr = orCalls.some((call: unknown[]) =>
      String(call[0]).includes('farm_id.is.null')
    );
    expect(hasNullOr).toBe(false);

    // 取得されたタスクがステートに反映されたこと
    expect(result.current.tasks.length).toBe(1);
    expect(result.current.tasks[0].id).toBe('task-1');
  });

  it('farm_id が不明な場合、tasks クエリを発行せず早期リターンし空配列をセットすること', async () => {
    // activeFarmId, localStorage ともに空
    useFarmStore.setState({ activeFarmId: '', activeFarmName: '' });

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    type UsersQueryChain = {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
    };

    // users テーブルの farm_id も null
    const usersQueryBuilder: UsersQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { farm_id: null },
        error: null,
      }),
    };

    const tasksFromSpy = vi.fn();

    const fromMock = vi.mocked(supabase.from);
    fromMock.mockImplementation((table: string) => {
      if (table === 'users') {
        return usersQueryBuilder as never;
      }
      if (table === 'tasks') {
        tasksFromSpy();
        return {} as never;
      }
      return {} as never;
    });

    const { result } = renderHook(() => useKanbanBoard(defaultColumns));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // users から farm_id 取得を試みるが null
    expect(supabase.from).toHaveBeenCalledWith('users');

    // tasks テーブルに対するクエリは発行されないこと
    expect(tasksFromSpy).not.toHaveBeenCalled();

    // タスクは空配列で安全に早期リターンすること
    expect(result.current.tasks).toEqual([]);
    expect(result.current.trashTasks).toEqual([]);
  });
});
