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

const mockJournals = [
  {
    id: 'journal-lettuce-1',
    student_id: 'student-1',
    content: 'レタスの苗が虫食いで育ちませんでした。対策教えて',
    reply: 'こんにちは！レタスの苗が虫食いで思うように育たなかったとのこと...',
    created_at: '2026-10-05T14:49:00Z',
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
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: table === 'journals' ? mockJournals : [],
              error: null,
            }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
      update: () => Promise.resolve({ error: null }),
    }),
  },
}));

describe('StudentFarmRecordView - 登録済みタスクのベッド変更機能 & 共通タイムライン分離検証', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('共通バーが最上部に表示され、タップすると共通タイムラインが表示されること', async () => {
    render(<StudentFarmRecordView studentId="student-1" studentName="生徒1" />);

    // 共通切り替えバーが存在すること（補足なしのシンプルな「共通」ボタン）
    const sharedBar = screen.getAllByRole('button', { name: /共通/ })[0];
    expect(sharedBar).toBeDefined();

    // タップして共通タイムラインを表示
    await act(async () => {
      fireEvent.click(sharedBar);
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.getByText('🌐 共通の記録')).toBeDefined();
    expect(screen.getAllByText(/全 1 件/).length).toBeGreaterThan(0);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('特定作物(レタス)の相談・返信は共通タイムラインから除外され、畝2(レタス)にのみ表示されること', async () => {
    render(<StudentFarmRecordView studentId="student-1" studentName="生徒1" />);

    // 1. 共通を選択
    const sharedBar = screen.getAllByRole('button', { name: /共通/ })[0];
    await act(async () => {
      fireEvent.click(sharedBar);
      await new Promise((r) => setTimeout(r, 100));
    });

    // 共通タイムラインにはレタスの返信が表示されないこと
    expect(screen.queryByText(/レタスの苗が虫食いで育ちませんでした/)).toBeNull();

    // 2. 畝2 (レタス) を選択
    const bed2Btn = screen.getByRole('button', { name: /畝 2/ });
    await act(async () => {
      fireEvent.click(bed2Btn);
      await new Promise((r) => setTimeout(r, 100));
    });

    // 畝2のタイムラインにはレタスの返信が表示されること
    expect(screen.getByText(/レタスの苗が虫食いで育ちませんでした/)).toBeDefined();
  });

  it('畝ボタンをタップすると、その畝のタイムラインが表示されスムーズスクロールが呼ばれること', async () => {
    render(<StudentFarmRecordView studentId="student-1" studentName="生徒1" />);

    const bed1Btn = screen.getByRole('button', { name: /畝 1/ });
    await act(async () => {
      fireEvent.click(bed1Btn);
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.getByText(/📅 畝 1 \(きゅうり\) の記録/)).toBeDefined();
    expect(screen.queryByText('👇 現在表示中')).toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('過去の観察記録の編集モーダルを開いたとき、セレクトボックスがロック解除されており、共通へ変更して保存できること', async () => {
    render(<StudentFarmRecordView studentId="student-1" studentName="生徒1" />);

    const bed1Btn = screen.getByRole('button', { name: /畝 1/ });
    await act(async () => {
      fireEvent.click(bed1Btn);
    });

    const editBtn = screen.getByText('✏️ 編集');
    await act(async () => {
      fireEvent.click(editBtn);
    });

    expect(screen.getByText('✏️ 過去の観察記録を編集')).toBeDefined();

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    expect(select.value).toBe('bed-1');

    // 「共通」に切り替え
    await act(async () => {
      fireEvent.change(select, { target: { value: 'shared' } });
    });
    expect(select.value).toBe('shared');

    const submitBtn = screen.getByText('変更内容を更新する');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockUpdateCropRecord).toHaveBeenCalledTimes(1);
    const [recIdArg, payloadArg] = mockUpdateCropRecord.mock.calls[0];
    expect(recIdArg).toBe('rec-1');
    expect(payloadArg.bed_id).toBeNull();
    expect(payloadArg.plot_id).toBe('plot-A1');
  });

  it('過去の観察記録を別の畝（畝1から畝2）に変更して保存できること', async () => {
    render(<StudentFarmRecordView studentId="student-1" studentName="生徒1" />);

    const bed1Btn = screen.getByRole('button', { name: /畝 1/ });
    await act(async () => {
      fireEvent.click(bed1Btn);
    });

    const editBtn = screen.getByText('✏️ 編集');
    await act(async () => {
      fireEvent.click(editBtn);
    });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
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

  it('単一品種（きゅうり）の場合はボタンと見出しにきゅうりのみが表示されること', async () => {
    render(<StudentFarmRecordView studentId="student-1" studentName="生徒1" />);

    const bed1Btn = screen.getByRole('button', { name: /畝 1/ });
    await act(async () => {
      fireEvent.click(bed1Btn);
    });

    // 選択ボタンが「畝 1 きゅうり」であり、見出しも「📅 畝 1 (きゅうり) の記録」と一致すること
    expect(screen.getByText('📅 畝 1 (きゅうり) の記録')).toBeDefined();
  });

  it('畝に複数品種の記録がある場合（混植）、ボタンに「他◯種」が表示され、見出しに全品種が表示され、品種タブが出現すること', async () => {
    // 畝1にミニトマトの記録を追加して混植状態にする
    mockRecords.push({
      id: 'rec-tomato-1',
      bed_id: 'bed-1',
      plot_id: 'plot-A1',
      crop_name: 'ミニトマト',
      date: '2026/10/10',
      notes: '【ミニトマト】第一花房開花',
      growth_stage: '開花・受粉',
      height_cm: 60,
      work_types: ['水やり'],
      created_at: '2026-10-10T11:00:00Z',
    });

    render(<StudentFarmRecordView studentId="student-1" studentName="生徒1" />);

    // 畝1のボタンが「きゅうり他1種」と表示されていること
    expect(screen.getByText('きゅうり他1種')).toBeDefined();

    // 畝1ボタンをタップ
    const bed1Btn = screen.getByRole('button', { name: /畝 1/ });
    await act(async () => {
      fireEvent.click(bed1Btn);
    });

    // 見出しに「きゅうり」と「ミニトマト」の両方が含まれること
    expect(screen.getByText(/📅 畝 1 \(.*きゅうり.*ミニトマト.*\) の記録/)).toBeDefined();

    // 品種フィルタータブ（すべて、きゅうり、ミニトマト）が表示されること
    expect(screen.getByRole('button', { name: /すべて/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /きゅうり\s*\(1\)/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /ミニトマト\s*\(1\)/ })).toBeDefined();
  });
});
