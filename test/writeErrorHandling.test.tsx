// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useFarmStore } from '@/store/useFarmStore';

const dbState = vi.hoisted(() => ({
  eventsInsertError: null as { message: string } | null,
  tasksInsertError: null as { message: string } | null,
  tasksUpsertError: null as { message: string } | null,
  tasksUpdateError: null as { message: string } | null,
  tasksRows: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/supabase', () => {
  const makeSelectChain = (rowsGetter: () => unknown[]) => {
    const chain: Record<string, unknown> = {};
    chain.eq = () => chain;
    chain.is = () => chain;
    chain.not = () => chain;
    chain.order = () => chain;
    chain.maybeSingle = () => Promise.resolve({ data: rowsGetter()[0] ?? null, error: null });
    chain.single = () => Promise.resolve({ data: rowsGetter()[0] ?? null, error: null });
    chain.then = (resolve: (val: unknown) => unknown) =>
      Promise.resolve({ data: rowsGetter(), error: null }).then(resolve);
    return chain;
  };

  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
          error: null,
        })),
      },
      channel: vi.fn(() => {
        const ch: Record<string, unknown> = {};
        ch.on = () => ch;
        ch.subscribe = () => ch;
        return ch;
      }),
      removeChannel: vi.fn(async () => 'ok'),
      rpc: vi.fn(async () => ({ data: null, error: null })),
      from: vi.fn((table: string) => {
        if (table === 'events') {
          return {
            select: () => makeSelectChain(() => []),
            insert: vi.fn(async () => ({ error: dbState.eventsInsertError })),
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }
        if (table === 'tasks') {
          return {
            select: () => makeSelectChain(() => dbState.tasksRows),
            insert: vi.fn(async () => ({ error: dbState.tasksInsertError })),
            upsert: vi.fn(async () => ({ error: dbState.tasksUpsertError })),
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: dbState.tasksUpdateError })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }
        return {
          select: () => makeSelectChain(() => []),
        };
      }),
    },
  };
});

import TeacherEventsView from '@/components/teacher/TeacherEventsView';
import TaskEditModal from '@/components/board/TaskEditModal';
import TeacherTemplatesView from '@/components/teacher/TeacherTemplatesView';
import TeacherTaskBoardView from '@/components/teacher/TeacherTaskBoardView';

const FARM_ID = '11111111-1111-4111-8111-111111111111';

describe('R-2: 書き込みエラーのトースト通知（正常系・異常系）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    dbState.eventsInsertError = null;
    dbState.tasksInsertError = null;
    dbState.tasksUpsertError = null;
    dbState.tasksUpdateError = null;
    dbState.tasksRows = [];
    useFarmStore.setState({
      farms: [{ id: FARM_ID, name: '太陽農園' }],
      activeFarmId: FARM_ID,
      activeFarmName: '太陽農園',
    });
  });

  describe('1. イベント新規登録 (TeacherEventsView / useEvents.addEvent)', () => {
    it('DB 書き込み成功時に成功トーストが表示される', async () => {
      render(<TeacherEventsView />);

      fireEvent.click(screen.getByText('新しいイベントをカレンダーに登録'));
      const titleInput = screen.getByPlaceholderText('例: 🥔 夏野菜の剪定・仕立て講習会');
      fireEvent.change(titleInput, { target: { value: '秋の収穫祭' } });
      fireEvent.click(screen.getByText('カレンダーに登録して共有'));

      await waitFor(() => {
        expect(
          screen.getByText('📅 カレンダーに新しいイベントを登録し、生徒画面へ即時共有しました！')
        ).toBeTruthy();
      });
    });

    it('DB 書き込み失敗時にエラートーストが表示され、成功トーストは出ない', async () => {
      dbState.eventsInsertError = { message: 'RLS policy violation' };
      render(<TeacherEventsView />);

      fireEvent.click(screen.getByText('新しいイベントをカレンダーに登録'));
      const titleInput = screen.getByPlaceholderText('例: 🥔 夏野菜の剪定・仕立て講習会');
      fireEvent.change(titleInput, { target: { value: '秋の収穫祭' } });
      fireEvent.click(screen.getByText('カレンダーに登録して共有'));

      await waitFor(() => {
        expect(
          screen.getByText('⚠️ イベントの登録に失敗しました。時間をおいて再度お試しください')
        ).toBeTruthy();
      });
      expect(
        screen.queryByText('📅 カレンダーに新しいイベントを登録し、生徒画面へ即時共有しました！')
      ).toBeNull();
    });
  });

  describe('2. タスク編集からのテンプレート追加 (TaskEditModal.handleSaveAsTemplate)', () => {
    const sampleTask = {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'トマトの誘引',
      status: 'pool',
      category: '果菜',
      description: '支柱に結ぶ',
      target_crop: 'トマト',
      estimated_time: '20分',
      tools_needed: '麻ひも',
      memo: '8の字結び',
      exp: 50,
      difficulty: 2,
      require_photo: true,
    };

    it('DB 書き込み成功時に成功トーストが表示される', async () => {
      render(<TaskEditModal task={sampleTask} onClose={vi.fn()} onSave={vi.fn()} />);

      fireEvent.click(screen.getByText('📋 テンプレートに追加'));

      await waitFor(() => {
        expect(screen.getByText('📋 テンプレートに追加しました！')).toBeTruthy();
      });
    });

    it('DB 書き込み失敗時にエラートーストが表示され、成功トーストは出ない', async () => {
      dbState.tasksInsertError = { message: 'permission denied for table tasks' };
      render(<TaskEditModal task={sampleTask} onClose={vi.fn()} onSave={vi.fn()} />);

      fireEvent.click(screen.getByText('📋 テンプレートに追加'));

      await waitFor(() => {
        expect(
          screen.getByText('❌ テンプレートの追加に失敗しました: permission denied for table tasks')
        ).toBeTruthy();
      });
      expect(screen.queryByText('📋 テンプレートに追加しました！')).toBeNull();
    });
  });

  describe('3. テンプレート管理画面での保存 (TeacherTemplatesView.handleSaveTemplate)', () => {
    it('DB 書き込み成功時に成功トーストが表示される', async () => {
      render(<TeacherTemplatesView />);

      fireEvent.click(screen.getByText('新しいテンプレートを作成'));
      fireEvent.click(screen.getByText('テンプレートを保存する'));

      await waitFor(() => {
        expect(
          screen.getByText(
            '✨ タスクテンプレートを保存しました！クラウドDBに同期されたため、別ブラウザでも利用可能です。'
          )
        ).toBeTruthy();
      });
    });

    it('DB 書き込み失敗時にエラートーストが表示され、成功トーストは出ない', async () => {
      dbState.tasksUpsertError = { message: 'upsert failed' };
      render(<TeacherTemplatesView />);

      fireEvent.click(screen.getByText('新しいテンプレートを作成'));
      fireEvent.click(screen.getByText('テンプレートを保存する'));

      await waitFor(() => {
        expect(
          screen.getByText('⚠️ テンプレートの保存に失敗しました。時間をおいて再度お試しください')
        ).toBeTruthy();
      });
      expect(
        screen.queryByText(
          '✨ タスクテンプレートを保存しました！クラウドDBに同期されたため、別ブラウザでも利用可能です。'
        )
      ).toBeNull();
    });
  });

  describe('4. カンバンボードでのタスク詳細保存 (TeacherTaskBoardView / useKanbanBoard.saveTaskDetails)', () => {
    beforeEach(() => {
      dbState.tasksRows = [
        {
          id: '33333333-3333-4333-8333-333333333333',
          title: 'ナス追肥',
          status: 'pool',
          category: '果菜',
          description: '株元に化成肥料',
          target_crop: 'ナス',
          estimated_time: '15分',
          tools_needed: 'スコップ',
          memo: '',
          exp: 50,
          difficulty: 1,
          require_photo: false,
          is_template: false,
          deleted_at: null,
          farm_id: FARM_ID,
          checklist: {},
        },
      ];
    });

    it('DB 書き込み成功時に成功トーストが表示される', async () => {
      render(<TeacherTaskBoardView />);

      await waitFor(() => expect(screen.getByText('ナス追肥')).toBeTruthy());
      fireEvent.click(screen.getByText('編集'));
      fireEvent.click(screen.getByText('設定を保存する'));

      await waitFor(() => {
        expect(screen.getByText('💾 タスク「ナス追肥」の編集内容を保存しました！')).toBeTruthy();
      });
    });

    it('DB 書き込み失敗時にエラートーストが表示され、成功トーストは出ない', async () => {
      dbState.tasksUpdateError = { message: 'update failed' };
      render(<TeacherTaskBoardView />);

      await waitFor(() => expect(screen.getByText('ナス追肥')).toBeTruthy());
      fireEvent.click(screen.getByText('編集'));
      fireEvent.click(screen.getByText('設定を保存する'));

      await waitFor(() => {
        expect(
          screen.getByText('⚠️ タスクの保存に失敗しました。時間をおいて再度お試しください')
        ).toBeTruthy();
      });
      expect(screen.queryByText('💾 タスク「ナス追肥」の編集内容を保存しました！')).toBeNull();
    });
  });
});
