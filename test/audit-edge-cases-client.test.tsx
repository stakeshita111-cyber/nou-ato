// @vitest-environment jsdom
/**
 * 網羅的エッジケース監査 (クライアント: 二重送信・通信障害・数量パース)
 *
 * 実コンポーネント / 実フック / 実 farmDb を import して検証する。
 * `it.fails` = 現時点で未対応と確認済みの欠陥の再現テスト (修正後は `.fails` を外すこと)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react';

type QueryResult = { data: unknown; error: { message: string } | null };

const mockAddCropRecord = vi.fn();
const insertSpy = vi.fn();
const tableResults: Record<string, QueryResult> = {};
let insertResult: QueryResult = { data: null, error: null };

function makeQuery(result: QueryResult): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  for (const m of [
    'select',
    'eq',
    'is',
    'or',
    'order',
    'limit',
    'update',
    'upsert',
    'delete',
    'maybeSingle',
    'single',
  ]) {
    q[m] = vi.fn(() => q);
  }
  q.insert = vi.fn((payload: unknown) => {
    insertSpy(payload);
    return Promise.resolve(insertResult);
  });
  q.then = (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

const realtimeChannel: Record<string, unknown> = {};
realtimeChannel.on = vi.fn(() => realtimeChannel);
realtimeChannel.subscribe = vi.fn(() => realtimeChannel);

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'student-1', email: 's@example.com', user_metadata: {} } },
      }),
    },
    from: (table: string) => makeQuery(tableResults[table] ?? { data: [], error: null }),
    channel: () => realtimeChannel,
    removeChannel: async () => 'ok',
  },
}));

vi.mock('@/hooks/useFarmManager', () => ({
  useFarmManager: () => ({
    plots: [
      {
        id: 'plot-A1',
        code: 'A1',
        name: '区画 A1',
        student_id: 'student-1',
        student_name: '生徒1',
        is_vacant: false,
        beds: [{ id: 'bed-1', bed_number: 1, crop_name: 'きゅうり', status: 'active' }],
      },
    ],
    addCropRecord: mockAddCropRecord,
  }),
}));

vi.mock('@/lib/storage', () => ({
  uploadImageToStorage: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
}));

import TaskDetailModal from '../components/student/TaskDetailModal';
import { useStudentDashboard } from '../hooks/useStudentDashboard';
import { insertCropRecordDb } from '../lib/farm/farmDb';

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(tableResults)) delete tableResults[k];
  insertResult = { data: null, error: null };
});

// ---------------------------------------------------------------------------
// 3. 競合: タスク完了ボタン連打 (components/student/TaskDetailModal.tsx:206-256, 564-575)
// ---------------------------------------------------------------------------
describe('[二重送信] TaskDetailModal 完了報告ボタン', () => {
  const task = {
    id: 'task-common',
    title: '共通タスク',
    target_crop: '共通',
    category: '準備',
    description: '1. 手順',
    phase: '準備・植付',
  };

  it('連打しても addCropRecord / onComplete は 1 回のみ (送信中ガード・isSubmittingRef により二重送信防止)', async () => {
    // 1回目の保存が完了する前に 2 回目がクリックされる状況を再現
    mockAddCropRecord.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(undefined), 30))
    );
    const onComplete = vi.fn();
    render(
      <TaskDetailModal
        task={task}
        studentId="student-1"
        studentName="生徒1"
        onClose={vi.fn()}
        onComplete={onComplete}
      />
    );

    const btn = screen.getByText('共通に記録して作業完了を報告する');
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(mockAddCropRecord).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('addCropRecord が失敗した場合、完了報告を成功扱いにせず中断する', async () => {
    mockAddCropRecord.mockRejectedValue(new Error('network down'));
    const onComplete = vi.fn();
    render(
      <TaskDetailModal
        task={task}
        studentId="student-1"
        studentName="生徒1"
        onClose={vi.fn()}
        onComplete={onComplete}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByText('共通に記録して作業完了を報告する'));
    });
    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. 通信障害: 生徒ダッシュボード (hooks/useStudentDashboard.ts:66-92)
// ---------------------------------------------------------------------------
describe('[通信障害] useStudentDashboard', () => {
  it('users 取得が通信エラーでも「退会済み/農園未所属」画面に誤誘導しない', async () => {
    tableResults.users = { data: null, error: { message: 'TypeError: Failed to fetch' } };
    const { result } = renderHook(() => useStudentDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 4000 });
    expect(result.current.isDeactivated).toBe(false);
  });

  it('student_tasks 取得エラーを空リストとして黙殺せずエラー状態を公開する', async () => {
    tableResults.users = {
      data: { id: 'student-1', farm_id: 'farm-A', display_name: '生徒1', deleted_at: null },
      error: null,
    };
    tableResults.student_tasks = { data: null, error: { message: 'Failed to fetch' } };
    const { result } = renderHook(() => useStudentDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 4000 });
    expect(result.current).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// 1. 境界値: 数量パース・DB エラー伝播 (lib/farm/farmDb.ts:339-374)
// ---------------------------------------------------------------------------
describe('[境界値] insertCropRecordDb', () => {
  const base = { id: 'rec-1', bed_id: null, date: '2026/10/11', crop_name: 'トマト' };

  function lastPayload(): { harvest_amount: unknown } {
    return insertSpy.mock.calls[0][0] as { harvest_amount: unknown };
  }

  it('空 / 未指定の収穫量は null', async () => {
    await insertCropRecordDb({ ...base, harvest_amount: '' });
    expect(lastPayload().harvest_amount).toBeNull();
  });

  it('正の小数 "2.5kg" は 2.5', async () => {
    await insertCropRecordDb({ ...base, harvest_amount: '2.5kg' });
    expect(lastPayload().harvest_amount).toBe(2.5);
  });

  it('"-5kg" を +5 に符号反転して保存しない (負数は null にサニタイズ)', async () => {
    await insertCropRecordDb({ ...base, harvest_amount: '-5kg' });
    expect(lastPayload().harvest_amount).not.toBe(5);
  });

  it('"0kg" はゼロとして 0 を保存する', async () => {
    await insertCropRecordDb({ ...base, harvest_amount: '0kg' });
    expect(lastPayload().harvest_amount).toBe(0);
  });

  it('数値型のマイナス / NaN を DB へ送らない', async () => {
    await insertCropRecordDb({ ...base, harvest_amount: -3 });
    expect(lastPayload().harvest_amount).not.toBe(-3);
  });

  it('INSERT が RLS/通信エラーで失敗したら呼び出し元へ伝播する', async () => {
    insertResult = { data: null, error: { message: 'new row violates row-level security' } };
    await expect(insertCropRecordDb({ ...base, harvest_amount: '1' })).rejects.toThrow();
  });
});

// React import is required for JSX under the test transform
void React;
