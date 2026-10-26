// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TeacherJournalsView from '../components/teacher/TeacherJournalsView';

const sampleJournals = [
  {
    id: 'journal-test-1',
    student_id: '00000000-0000-0000-0000-000000000002',
    farm_id: '11111111-1111-1111-1111-111111111111',
    content: '【相談トピック: トマトの仕立て方】\n支柱の立て方を教えてください。',
    reply: '',
    is_approved: false,
    is_private: false,
    created_at: '2026-10-25T10:00:00Z',
  },
];

const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'teacher-1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'journals') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: sampleJournals,
            error: null,
          }),
          update: mockUpdate,
          insert: mockInsert,
        };
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: '00000000-0000-0000-0000-000000000002',
                display_name: 'テスト生徒A',
                email: 'studenta@example.com',
              },
            ],
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { farm_id: '11111111-1111-1111-1111-111111111111', role: 'teacher' },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  },
}));

vi.mock('@/lib/farm/activeFarm', () => ({
  resolveActiveFarmId: vi.fn().mockResolvedValue('11111111-1111-1111-1111-111111111111'),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="mock-img" />
  ),
}));

describe('TeacherJournalsView - 返信通知保存エラー時のユーザーフィードバック', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it('handleSaveReply: 返信通知の insert が DB エラー (resolve error) を返したとき、警告トーストが表示されること', async () => {
    mockInsert.mockResolvedValue({
      error: { message: 'rls denied' },
    });

    await act(async () => {
      render(<TeacherJournalsView />);
    });

    // 「📜 すべて」タブに切り替えて日誌を表示
    const allTabBtn = screen.getByText(/📜 すべて/);
    await act(async () => {
      fireEvent.click(allTabBtn);
    });

    expect(await screen.findAllByText(/トマトの仕立て方/)).toBeDefined();

    // 返信テキストを入力
    const textarea = screen.getByPlaceholderText('回答や個別アドバイスを入力してください...');
    fireEvent.change(textarea, { target: { value: '支柱は合掌式で立ててください。' } });

    // 送信ボタンを押下
    const submitBtn = screen.getByText('回答を送信する');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 警告トーストが表示されることを確認
    const warningToast = await screen.findByText(
      '⚠️ 返信は保存しましたが、生徒への通知の保存に失敗しました。時間をおいて再度お試しください。'
    );
    expect(warningToast).toBeDefined();

    // 通知の insert が呼ばれたことを確認
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        role: 'broadcast',
        student_id: '00000000-0000-0000-0000-000000000002',
        reply: '講師からの返信',
        is_private: true,
      }),
    ]);
  });

  it('handleSaveReply: 返信通知の insert が成功したとき、通常の成功トーストが表示され、警告トーストが出ないこと (回帰検証)', async () => {
    mockInsert.mockResolvedValue({ error: null });

    await act(async () => {
      render(<TeacherJournalsView />);
    });

    const allTabBtn = screen.getByText(/📜 すべて/);
    await act(async () => {
      fireEvent.click(allTabBtn);
    });

    expect(await screen.findAllByText(/トマトの仕立て方/)).toBeDefined();

    const textarea = screen.getByPlaceholderText('回答や個別アドバイスを入力してください...');
    fireEvent.change(textarea, { target: { value: '支柱は直立式でも大丈夫です。' } });

    const submitBtn = screen.getByText('回答を送信する');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 通常の成功トーストが表示されること
    const successToast = await screen.findByText('💬 生徒への回答メッセージを更新・保存しました！');
    expect(successToast).toBeDefined();

    // 警告トーストは表示されないこと
    expect(
      screen.queryByText(
        '⚠️ 返信は保存しましたが、生徒への通知の保存に失敗しました。時間をおいて再度お試しください。'
      )
    ).toBeNull();
  });

  it('ナレッジ承認モーダル経由: 返信通知の insert がエラーを返したとき、警告トーストが表示されること', async () => {
    mockInsert.mockResolvedValue({
      error: { message: 'rls denied' },
    });

    await act(async () => {
      render(<TeacherJournalsView />);
    });

    const allTabBtn = screen.getByText(/📜 すべて/);
    await act(async () => {
      fireEvent.click(allTabBtn);
    });

    expect(await screen.findAllByText(/トマトの仕立て方/)).toBeDefined();

    const textarea = screen.getByPlaceholderText('回答や個別アドバイスを入力してください...');
    fireEvent.change(textarea, { target: { value: '支柱は合掌式で立ててください。' } });

    // 「🌟 この回答を農園AIナレッジとしても登録（承認）する」チェックボックスをON
    const approveCheckbox = screen.getByRole('checkbox');
    fireEvent.click(approveCheckbox);

    // 「回答を送信する」を押すとナレッジモーダルが開く
    const submitBtn = screen.getByText('回答を送信する');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // モーダル内の「★ ナレッジとして登録・承認」ボタンを押下
    const modalApproveBtn = await screen.findByText('★ ナレッジとして登録・承認');
    await act(async () => {
      fireEvent.click(modalApproveBtn);
    });

    // 警告トーストが表示されることを確認
    const warningToast = await screen.findByText(
      '⚠️ 返信は保存しましたが、生徒への通知の保存に失敗しました。時間をおいて再度お試しください。'
    );
    expect(warningToast).toBeDefined();
  });
});
