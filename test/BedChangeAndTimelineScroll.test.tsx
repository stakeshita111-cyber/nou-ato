// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import StudentFarmRecordView from '../components/student/StudentFarmRecordView';
import { CropRecord, FarmPlot } from '@/types/farm';

const mockUpdateCropRecord = vi.fn();
const mockAddCropRecord = vi.fn();

const mockPlot: FarmPlot = {
  id: 'plot-A1',
  farm_id: 'farm-1',
  code: 'A1',
  name: '区画 A1',
  student_id: 'student-1',
  student_name: '生徒1',
  is_vacant: false,
  position: { x: 0, y: 0 },
  beds: [
    {
      id: 'bed-1',
      plot_id: 'plot-A1',
      bed_number: 1,
      crop_name: 'きゅうり',
      status: 'active',
      progress_percent: 50,
      is_updated: false,
    },
    {
      id: 'bed-2',
      plot_id: 'plot-A1',
      bed_number: 2,
      crop_name: 'レタス',
      status: 'active',
      progress_percent: 20,
      is_updated: false,
    },
  ],
};

const mockRecords: CropRecord[] = [
  {
    id: 'rec-1',
    bed_id: 'bed-1',
    plot_id: 'plot-A1',
    crop_name: 'きゅうり',
    date: '2026/10/10',
    notes: '【きゅうり】つるが伸びてきた',
    growth_stage: '果実肥大',
    height_cm: 75,
    work_types: ['水やり'],
    created_at: '2026-10-10T10:00:00Z',
  },
  {
    id: 'rec-shared-1',
    bed_id: null,
    plot_id: 'plot-A1',
    crop_name: '全体共通',
    date: '2026/10/09',
    notes: '【全体共通】苗を受け取りました',
    growth_stage: '播種・苗植え',
    work_types: ['水やり'],
    created_at: '2026-10-09T10:00:00Z',
  },
];

vi.mock('@/hooks/useFarmManager', () => ({
  useFarmManager: () => ({
    plots: [mockPlot],
    records: mockRecords,
    isLoading: false,
    updateCropRecord: mockUpdateCropRecord,
    addCropRecord: mockAddCropRecord,
    deleteCropRecord: vi.fn(),
    updateBedCrop: vi.fn(),
    completeBedCrop: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
      update: () => Promise.resolve({ error: null }),
    }),
  },
}));

describe('StudentFarmRecordView - 登録済みタスクのベッド変更機能 & 案BタイムラインUI検証', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Element.prototype.scrollIntoView のモック
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('全体共有バーが最上部に表示され、タップすると全体共有タイムラインが表示されること', async () => {
    render(<StudentFarmRecordView studentId="student-1" studentName="生徒1" />);

    // 全体共有切り替えバーが存在すること
    const sharedBar = screen.getByRole('button', {
      name: /全体共有（区画全体 \/ 共通作業）/,
    });
    expect(sharedBar).toBeDefined();

    // タップして全体共有タイムラインを表示
    await act(async () => {
      fireEvent.click(sharedBar);
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.getByText('🌐 全体共有・共通作業の記録')).toBeDefined();
    expect(screen.getAllByText(/全 1 件/).length).toBeGreaterThan(0);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('畝ボタンをタップすると、その畝のタイムラインが表示されスムーズスクロールが呼ばれること', async () => {
    render(<StudentFarmRecordView studentId="student-1" studentName="生徒1" />);

    // 畝1ボタンをタップ
    const bed1Btn = screen.getByRole('button', { name: /畝 1/ });
    await act(async () => {
      fireEvent.click(bed1Btn);
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.getByText(/📅 畝 1 \(きゅうり\) の記録/)).toBeDefined();
    expect(screen.getByText('👇 現在表示中')).toBeDefined();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('過去の観察記録の編集モーダルを開いたとき、セレクトボックスがロック解除されており、全体共有へ変更して保存できること', async () => {
    render(<StudentFarmRecordView studentId="student-1" studentName="生徒1" />);

    // 畝1を選択してタイムラインを表示
    const bed1Btn = screen.getByRole('button', { name: /畝 1/ });
    await act(async () => {
      fireEvent.click(bed1Btn);
    });

    // 編集ボタンをクリック
    const editBtn = screen.getByText('✏️ 編集');
    await act(async () => {
      fireEvent.click(editBtn);
    });

    expect(screen.getByText('✏️ 過去の観察記録を編集')).toBeDefined();

    // セレクトボックスを取得
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(false); // disabled が解除されていること
    expect(select.value).toBe('bed-1');

    // 「全体共有」に切り替え
    await act(async () => {
      fireEvent.change(select, { target: { value: 'shared' } });
    });
    expect(select.value).toBe('shared');

    // 保存ボタンをクリック
    const submitBtn = screen.getByText('変更内容を更新する');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // updateCropRecord が bed_id: null, plot_id: 'plot-A1' で呼ばれたこと（畝1から全体共有へ引っ越し成功）
    expect(mockUpdateCropRecord).toHaveBeenCalledTimes(1);
    const [recIdArg, payloadArg] = mockUpdateCropRecord.mock.calls[0];
    expect(recIdArg).toBe('rec-1');
    expect(payloadArg.bed_id).toBeNull();
    expect(payloadArg.plot_id).toBe('plot-A1');
  });

  it('過去の観察記録を別の畝（畝1から畝2）に変更して保存できること', async () => {
    render(<StudentFarmRecordView studentId="student-1" studentName="生徒1" />);

    // 畝1を選択
    const bed1Btn = screen.getByRole('button', { name: /畝 1/ });
    await act(async () => {
      fireEvent.click(bed1Btn);
    });

    // 編集ボタンをクリック
    const editBtn = screen.getByText('✏️ 編集');
    await act(async () => {
      fireEvent.click(editBtn);
    });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    // 「畝2」に切り替え
    await act(async () => {
      fireEvent.change(select, { target: { value: 'bed-2' } });
    });

    const submitBtn = screen.getByText('変更内容を更新する');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockUpdateCropRecord).toHaveBeenCalledTimes(1);
    const [recIdArg, payloadArg] = mockUpdateCropRecord.mock.calls[0];
    expect(recIdArg).toBe('rec-1');
    expect(payloadArg.bed_id).toBe('bed-2');
  });
});
