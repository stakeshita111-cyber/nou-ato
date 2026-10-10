// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TaskDetailModal from '../components/student/TaskDetailModal';

const mockAddCropRecord = vi.fn();

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
        beds: [
          { id: 'bed-1', bed_number: 1, crop_name: 'きゅうり', status: 'active' },
          { id: 'bed-2', bed_number: 2, crop_name: 'レタス', status: 'active' },
        ],
      },
    ],
    addCropRecord: mockAddCropRecord,
  }),
}));

vi.mock('@/lib/storage', () => ({
  uploadImageToStorage: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
}));

describe('TaskDetailModal Component - 全体共有タスクと畝選択の連動検証', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const commonTask = {
    id: 'task-spring-prep',
    title: '【春の準備】春夏野菜の種・苗配布＆資材受取',
    target_crop: '共通',
    category: '準備',
    description: '1. 管理棟前の配布ブースで受付を行う\n2. 資材を受け取る',
    phase: '準備・植付',
  };

  const cropSpecificTask = {
    id: 'task-cucumber',
    title: 'きゅうりの整枝・誘引',
    target_crop: 'きゅうり',
    category: '手入れ',
    description: '1. つるを支柱に固定する',
    phase: '育成',
  };

  it('共通タスクの場合、初期状態で「全体共有」が選択されること', () => {
    render(
      <TaskDetailModal
        task={commonTask}
        studentId="student-1"
        studentName="生徒1"
        onClose={vi.fn()}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('shared');
    expect(screen.getByText('🌐 共通')).toBeDefined();
  });

  it('特定作物のタスクの場合、合致する畝が初期選択されること', () => {
    render(
      <TaskDetailModal
        task={cropSpecificTask}
        studentId="student-1"
        studentName="生徒1"
        onClose={vi.fn()}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('bed-1');
  });

  it('全体共有を選択して作業完了報告した場合、addCropRecord に shared および plot_id が渡され、畝1に記録が紐付かないこと', async () => {
    const handleComplete = vi.fn();
    render(
      <TaskDetailModal
        task={commonTask}
        studentId="student-1"
        studentName="生徒1"
        onClose={vi.fn()}
        onComplete={handleComplete}
      />
    );

    const submitBtn = screen.getByText('共通に記録して作業完了を報告する');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockAddCropRecord).toHaveBeenCalledTimes(1);
    const [bedIdArg, payloadArg] = mockAddCropRecord.mock.calls[0];

    // bedIdArg は 'shared' であり、畝1 ('bed-1') ではないこと
    expect(bedIdArg).toBe('shared');
    expect(payloadArg.bed_id).toBeNull();
    expect(payloadArg.plot_id).toBe('plot-A1');
    expect(payloadArg.work_types).toContain('【春の準備】春夏野菜の種・苗配布＆資材受取');

    expect(handleComplete).toHaveBeenCalledWith('task-spring-prep', 'shared', undefined, '');
  });

  it('ユーザーが意図して畝2を選択して報告した場合、畝2に記録が保存されること', async () => {
    render(
      <TaskDetailModal
        task={commonTask}
        studentId="student-1"
        studentName="生徒1"
        onClose={vi.fn()}
      />
    );

    const select = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(select, { target: { value: 'bed-2' } });
    });

    const submitBtn = screen.getByText('畝に記録して作業完了を報告する');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockAddCropRecord).toHaveBeenCalledTimes(1);
    const [bedIdArg, payloadArg] = mockAddCropRecord.mock.calls[0];

    expect(bedIdArg).toBe('bed-2');
    expect(payloadArg.bed_id).toBe('bed-2');
  });
});
