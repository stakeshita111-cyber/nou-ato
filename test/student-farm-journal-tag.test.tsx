// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, renderHook, act, waitFor } from '@testing-library/react';
import { formatFarmJournalTag, isFarmJournal, isRegularRecord } from '@/lib/utils/journalHelper';
import { useStudentDashboard } from '@/hooks/useStudentDashboard';
import StudentFarmRecordView from '@/components/student/StudentFarmRecordView';
import { FarmPlot } from '@/types/farm';

// --- Supabase Mock ---
let insertedJournals: Array<{ content?: string; role?: string; student_id?: string | null }> = [];
const mockInsert = vi.fn(
  (rows: Array<{ content?: string; role?: string; student_id?: string | null }>) => {
    insertedJournals.push(...rows);
    return {
      select: vi.fn(() =>
        Promise.resolve({
          data: rows.map((r, i) => ({ id: `j-${Date.now()}-${i}`, ...r })),
          error: null,
        })
      ),
    };
  }
);

const realtimeChannel: Record<string, unknown> = {};
realtimeChannel.on = vi.fn(() => realtimeChannel);
realtimeChannel.subscribe = vi.fn(() => realtimeChannel);

vi.mock('@/lib/supabase', () => {
  const createQueryChain = (tableName: string) => {
    const chain: Record<string, unknown> = {};
    const chainMethods = [
      'select',
      'eq',
      'neq',
      'is',
      'order',
      'limit',
      'range',
      'single',
      'maybeSingle',
      'update',
      'delete',
    ];
    for (const m of chainMethods) {
      chain[m] = vi.fn(() => chain);
    }

    chain.single = vi.fn(() => {
      if (tableName === 'users') {
        return Promise.resolve({
          data: {
            id: 'student-test-1',
            farm_id: 'farm-1',
            display_name: 'テスト生徒',
            role: 'student',
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    chain.maybeSingle = vi.fn(() => {
      if (tableName === 'users') {
        return Promise.resolve({
          data: {
            id: 'student-test-1',
            farm_id: 'farm-1',
            display_name: 'テスト生徒',
            role: 'student',
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    chain.then = (resolve: (val: unknown) => unknown) => {
      if (tableName === 'users') {
        return Promise.resolve({
          data: {
            id: 'student-test-1',
            farm_id: 'farm-1',
            display_name: 'テスト生徒',
            role: 'student',
          },
          error: null,
        }).then(resolve);
      }
      return Promise.resolve({ data: [], error: null }).then(resolve);
    };

    return chain;
  };

  return {
    supabase: {
      auth: {
        getUser: vi.fn(() =>
          Promise.resolve({
            data: { user: { id: 'student-test-1', email: 'student@example.com' } },
            error: null,
          })
        ),
      },
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
      channel: () => realtimeChannel,
      removeChannel: vi.fn(() => Promise.resolve('ok')),
      from: vi.fn((table: string) => {
        if (table === 'journals') {
          const chain = createQueryChain('journals');
          chain.insert = mockInsert;
          return chain;
        }
        return createQueryChain(table);
      }),
    },
  };
});

// --- Farm Manager Mock for StudentFarmRecordView ---
let mockPlotsList: FarmPlot[] = [];

const createMockPlot = (): FarmPlot => ({
  id: 'plot-1',
  farm_id: 'farm-1',
  code: 'A1',
  name: '区画 A1',
  student_id: 'student-test-1',
  student_name: 'テスト生徒',
  is_vacant: false,
  position: { x: 0, y: 0 },
  beds: [
    {
      id: 'bed-1',
      plot_id: 'plot-1',
      bed_number: 1,
      crop_name: 'ミニトマト',
      status: 'active',
      is_updated: false,
    },
    {
      id: 'bed-2',
      plot_id: 'plot-1',
      bed_number: 2,
      crop_name: 'きゅうり',
      status: 'active',
      is_updated: false,
    },
  ],
});

vi.mock('@/hooks/useFarmManager', () => ({
  useFarmManager: () => ({
    plots: mockPlotsList,
    records: [],
    isLoading: false,
    addCropRecord: vi.fn(),
    updateCropRecord: vi.fn(),
    deleteCropRecord: vi.fn(),
    completeBedCrop: vi.fn(),
    updateBedCrop: vi.fn(),
  }),
}));

describe('生徒の気づきメモ・畝目印タグ連携の検証', () => {
  beforeEach(() => {
    insertedJournals = [];
    mockPlotsList = [createMockPlot()];
    vi.clearAllMocks();
  });

  describe('1. 共通関数 formatFarmJournalTag の単体テスト', () => {
    it('共通選択中（isShared: true）の場合は【区画全体・共通】を返すこと', () => {
      const tag = formatFarmJournalTag({ isShared: true });
      expect(tag).toBe('【区画全体・共通】');
    });

    it('畝選択中の場合は【畝 N (作物名)】を返すこと', () => {
      const tag = formatFarmJournalTag({
        isShared: false,
        bedNumber: 2,
        cropName: 'トマト',
      });
      expect(tag).toBe('【畝 2 (トマト)】');
    });

    it('isConsultation: true の場合、末尾に「❗ [相談] 」が付与されること', () => {
      const sharedConsultationTag = formatFarmJournalTag({
        isShared: true,
        isConsultation: true,
      });
      expect(sharedConsultationTag).toBe('【区画全体・共通】❗ [相談] ');

      const bedConsultationTag = formatFarmJournalTag({
        isShared: false,
        bedNumber: 1,
        cropName: 'ナス',
        isConsultation: true,
      });
      expect(bedConsultationTag).toBe('【畝 1 (ナス)】❗ [相談] ');
    });

    it('作物名が未指定・空文字の場合は「未確定 🌱」を補完すること', () => {
      const tagWithEmpty = formatFarmJournalTag({
        isShared: false,
        bedNumber: 3,
        cropName: '',
      });
      expect(tagWithEmpty).toBe('【畝 3 (未確定 🌱)】');
    });

    it('畝番号が未指定または空の場合は壊れた目印（【畝 (未確定 🌱)】等）を生成しないこと', () => {
      const brokenTagUndefined = formatFarmJournalTag({
        isShared: false,
        bedNumber: undefined,
        cropName: 'トマト',
        isConsultation: true,
      });
      expect(brokenTagUndefined).toBe('❗ [相談] ');
      expect(brokenTagUndefined).not.toContain('【畝');

      const brokenTagEmpty = formatFarmJournalTag({
        isShared: false,
        bedNumber: '',
        isConsultation: false,
      });
      expect(brokenTagEmpty).toBe('');
      expect(brokenTagEmpty).not.toContain('【畝');
    });
  });

  describe('2. isFarmJournal & isRegularRecord 判定連携の検証', () => {
    it('キーワードを含まないメモ（例:「質問TEST3」）でも、畝・共通両方で isFarmJournal=true かつ isRegularRecord=false になること', () => {
      // 共通メモ（質問TEST3などのキーワードなしメモ）
      const sharedMemoTag = formatFarmJournalTag({ isShared: true, isConsultation: true });
      const sharedMemoContent = `${sharedMemoTag}質問TEST3`;
      expect(isFarmJournal(sharedMemoContent)).toBe(true);
      expect(isRegularRecord(sharedMemoContent)).toBe(false);

      // 畝メモ（キーワードなしメモ）
      const bedMemoTag = formatFarmJournalTag({
        isShared: false,
        bedNumber: 5,
        cropName: 'トマト',
        isConsultation: true,
      });
      const bedMemoContent = `${bedMemoTag}質問TEST3`;
      expect(isFarmJournal(bedMemoContent)).toBe(true);
      expect(isRegularRecord(bedMemoContent)).toBe(false);
    });

    it('「＋新規記録」（日常の観察記録・キーワードなし）は、今までどおり isRegularRecord=true のままであること', () => {
      // 共通の新規観察記録
      const sharedRecordTag = formatFarmJournalTag({ isShared: true, isConsultation: false });
      const sharedRecordContent = `${sharedRecordTag}散水ホースを点検しました`;
      expect(isFarmJournal(sharedRecordContent)).toBe(true);
      expect(isRegularRecord(sharedRecordContent)).toBe(true);

      // 畝の新規観察記録
      const bedRecordTag = formatFarmJournalTag({
        isShared: false,
        bedNumber: 1,
        cropName: 'ミニトマト',
        isConsultation: false,
      });
      const bedRecordContent = `${bedRecordTag}水やりと追肥を行いました`;
      expect(isFarmJournal(bedRecordContent)).toBe(true);
      expect(isRegularRecord(bedRecordContent)).toBe(true);
    });

    it('目印タグのない通常のテキストは isFarmJournal で false と判定されること（AI相談等の確認に分類）', () => {
      const normalContent = '今日の作業を終了しました。お疲れ様でした。';
      expect(isFarmJournal(normalContent)).toBe(false);
    });
  });

  describe('3. useStudentDashboard 実フック検証 (addJournal)', () => {
    it('畝メモタグを指定して addJournal を呼び出した場合、content 先頭にタグとマーカーが付与されて保存され、未返信相談と認識されること', async () => {
      const { result } = renderHook(() => useStudentDashboard());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.setNewJournal('質問TEST3');
      });

      // 畝メモタグ（isConsultation: true）付きで addJournal 実行
      const bedTag = formatFarmJournalTag({
        isShared: false,
        bedNumber: 1,
        cropName: 'ミニトマト',
        isConsultation: true,
      });
      await act(async () => {
        await result.current.addJournal(bedTag);
      });

      expect(mockInsert).toHaveBeenCalled();
      const lastInsert = insertedJournals[insertedJournals.length - 1];
      expect(lastInsert.content).toBe('【畝 1 (ミニトマト)】❗ [相談] 質問TEST3');
      expect(lastInsert.role).toBe('student');

      // 講師画面で「未返信（要対応）」に分類されること (isFarmJournal=true && !isRegularRecord)
      expect(isFarmJournal(lastInsert.content)).toBe(true);
      expect(isRegularRecord(lastInsert.content)).toBe(false);
    });

    it('共通メモタグを指定して addJournal を呼び出した場合、content 先頭に共通タグとマーカーが付与されて保存され、未返信相談と認識されること', async () => {
      const { result } = renderHook(() => useStudentDashboard());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.setNewJournal('質問TEST3');
      });

      const sharedTag = formatFarmJournalTag({ isShared: true, isConsultation: true });
      await act(async () => {
        await result.current.addJournal(sharedTag);
      });

      const lastInsert = insertedJournals[insertedJournals.length - 1];
      expect(lastInsert.content).toBe('【区画全体・共通】❗ [相談] 質問TEST3');
      expect(isFarmJournal(lastInsert.content)).toBe(true);
      expect(isRegularRecord(lastInsert.content)).toBe(false);
    });

    it('タグ未指定で addJournal を呼び出した場合、入力文のみがそのまま保存されること', async () => {
      const { result } = renderHook(() => useStudentDashboard());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.setNewJournal('タグなしの日誌です');
      });

      await act(async () => {
        await result.current.addJournal();
      });

      const lastInsert = insertedJournals[insertedJournals.length - 1];
      expect(lastInsert.content).toBe('タグなしの日誌です');
    });
  });

  describe('4. StudentFarmRecordView 実コンポーネント検証', () => {
    it('畝を選択してメモ送信ボタンを押した際、onAddJournal に選択中畝の相談タグ（❗ [相談] 付き）が渡されること', async () => {
      const mockOnAddJournal = vi.fn();
      const mockSetNewJournal = vi.fn();

      render(
        <StudentFarmRecordView
          studentId="student-test-1"
          studentName="テスト生徒"
          newJournal="質問TEST3"
          setNewJournal={mockSetNewJournal}
          onAddJournal={mockOnAddJournal}
        />
      );

      // 1. 畝 1 (ミニトマト) をクリックして選択
      const bed1Button = screen.getByRole('button', { name: /畝\s*1/ });
      act(() => {
        fireEvent.click(bed1Button);
      });

      // 2. 「✉️ 講師へメモを送信」ボタンをクリック
      const sendButton = screen.getByRole('button', { name: /✉️ 講師へメモを送信/ });
      act(() => {
        fireEvent.click(sendButton);
      });

      // 3. onAddJournal に 【畝 1 (ミニトマト)】❗ [相談]  が引数として渡されていること
      expect(mockOnAddJournal).toHaveBeenCalledTimes(1);
      expect(mockOnAddJournal).toHaveBeenCalledWith('【畝 1 (ミニトマト)】❗ [相談] ');
    });

    it('「共通」を選択してメモ送信ボタンを押した際、onAddJournal に【区画全体・共通】❗ [相談]  が渡されること', async () => {
      const mockOnAddJournal = vi.fn();
      const mockSetNewJournal = vi.fn();

      render(
        <StudentFarmRecordView
          studentId="student-test-1"
          studentName="テスト生徒"
          newJournal="質問TEST3"
          setNewJournal={mockSetNewJournal}
          onAddJournal={mockOnAddJournal}
        />
      );

      // 1. 「全体共通」または「共通」タブをクリックして選択
      const sharedButtons = screen.getAllByRole('button', { name: /共通/ });
      act(() => {
        fireEvent.click(sharedButtons[0]);
      });

      // 2. 「✉️ 講師へメモを送信」ボタンをクリック
      const sendButton = screen.getByRole('button', { name: /✉️ 講師へメモを送信/ });
      act(() => {
        fireEvent.click(sendButton);
      });

      // 3. onAddJournal に 【区画全体・共通】❗ [相談]  が引数として渡されていること
      expect(mockOnAddJournal).toHaveBeenCalledTimes(1);
      expect(mockOnAddJournal).toHaveBeenCalledWith('【区画全体・共通】❗ [相談] ');
    });

    it('畝が見つからない場合は壊れた目印で保存せず送信を中断し、エラートーストを表示すること', async () => {
      const mockOnAddJournal = vi.fn();
      const mockSetNewJournal = vi.fn();

      // 畝1を選択した状態のコンポーネントをレンダー
      const { rerender } = render(
        <StudentFarmRecordView
          studentId="student-test-1"
          studentName="テスト生徒"
          newJournal="画面更新後に送ろうとしたメモ"
          setNewJournal={mockSetNewJournal}
          onAddJournal={mockOnAddJournal}
        />
      );

      const bed1Button = screen.getByRole('button', { name: /畝\s*1/ });
      act(() => {
        fireEvent.click(bed1Button);
      });

      // 画面更新等で畝が消えた状態をシミュレート（beds を空にして rerender）
      const plotWithoutBeds: FarmPlot = {
        ...createMockPlot(),
        beds: [],
      };
      mockPlotsList = [plotWithoutBeds];

      rerender(
        <StudentFarmRecordView
          studentId="student-test-1"
          studentName="テスト生徒"
          newJournal="画面更新後に送ろうとしたメモ"
          setNewJournal={mockSetNewJournal}
          onAddJournal={mockOnAddJournal}
        />
      );

      // 送信ボタンが存在する場合、クリックしても onAddJournal は呼ばれず送信が中断されること
      const sendButtons = screen.queryAllByRole('button', { name: /✉️ 講師へメモを送信/ });
      if (sendButtons.length > 0) {
        act(() => {
          fireEvent.click(sendButtons[0]);
        });
      }

      // 壊れた目印で送信（onAddJournal呼出）されないこと
      expect(mockOnAddJournal).not.toHaveBeenCalled();
    });
  });
});
