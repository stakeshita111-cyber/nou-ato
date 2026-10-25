// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import TeacherJournalsView from '../components/teacher/TeacherJournalsView';

const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: mockUpdateEq,
});
const mockInsert = vi.fn().mockResolvedValue({ error: null });

const sampleJournals = [
  {
    id: 'journal-approved-1',
    student_id: 'student-1',
    farm_id: 'farm-1',
    content: 'トマトの葉に白い斑点が出ています。どうすればいいですか？',
    reply: 'うどんこ病の可能性があります。重曹水を散布してみてください。',
    is_approved: true,
    is_private: false,
    created_at: '2026-10-25T10:00:00Z',
  },
  {
    id: 'journal-unapproved-2',
    student_id: 'student-1',
    farm_id: 'farm-1',
    content: 'ナスの支柱立てをしました。',
    reply: null,
    is_approved: false,
    is_private: false,
    created_at: '2026-10-25T11:00:00Z',
  },
];

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
              { id: 'student-1', display_name: 'テスト受講生', email: 'student1@example.com' },
            ],
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { farm_id: 'farm-1', role: 'teacher' },
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
  resolveActiveFarmId: vi.fn().mockResolvedValue('farm-1'),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="mock-img" />
  ),
}));

describe('TeacherJournalsView - AIナレッジ PII 保護セキュリティテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. 承認済み日誌の返信を再編集・送信した際、モーダルを通さない通常返信であれば is_approved が安全に false へリセットされること', async () => {
    await act(async () => {
      render(<TeacherJournalsView />);
    });

    // 「📜 すべて」タブに切り替え
    const allTabBtn = screen.getByText(/📜 すべて/);
    await act(async () => {
      fireEvent.click(allTabBtn);
    });

    // 承認済み日誌が表示されていること
    expect(await screen.findAllByText(/トマトの葉に白い斑点が出ています/)).toBeDefined();

    // 回答の再編集ボタンをクリック
    const editBtn = screen.getByText(/回答を編集する/);
    await act(async () => {
      fireEvent.click(editBtn);
    });

    // 返信テキストエリアに入力
    const textarea = screen.getByPlaceholderText('回答や個別アドバイスを入力してください...');
    await act(async () => {
      fireEvent.change(textarea, {
        target: { value: '佐藤さん、お電話でお伝えした通り重曹水を散布してください。' },
      });
    });

    // ナレッジ登録チェックボックスがオフのまま「回答を更新保存する」をクリック
    const sendBtn = screen.getByText('回答を更新保存する');
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    // supabase.from('journals').update に is_approved: false が含まれて呼ばれること
    expect(mockUpdate).toHaveBeenCalledWith({
      reply: '佐藤さん、お電話でお伝えした通り重曹水を散布してください。',
      is_approved: false,
    });

    // 承認取り消しのセキュリティ警告トーストが表示されること
    await waitFor(() => {
      expect(
        screen.getByText(/返信内容が変更されたため、安全のためAIナレッジ承認を取り消しました/)
      ).toBeDefined();
    });
  });

  it('2. 未承認日誌への初回通常返信では、is_approved を更新せずに返信のみが保存されること', async () => {
    await act(async () => {
      render(<TeacherJournalsView />);
    });

    // 「📜 すべて」タブに切り替え
    const allTabBtn = screen.getByText(/📜 すべて/);
    await act(async () => {
      fireEvent.click(allTabBtn);
    });

    // 2件目の日誌へページ送り（「次の日記 ▶」をクリック）
    const nextBtn = screen.getByText(/次の日記 ▶/);
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    expect(await screen.findAllByText(/ナスの支柱立てをしました/)).toBeDefined();

    // 未承認日誌の返信テキストエリアに入力
    const textarea = screen.getByPlaceholderText('回答や個別アドバイスを入力してください...');

    await act(async () => {
      fireEvent.change(textarea, {
        target: { value: '支柱立てお疲れ様でした！しっかり誘引できていますね。' },
      });
    });

    // 送信ボタン（初回は「回答を送信する」）をクリック
    const sendBtn = screen.getByText('回答を送信する');

    await act(async () => {
      fireEvent.click(sendBtn);
    });

    // is_approved は含まれず reply のみ更新されること
    expect(mockUpdate).toHaveBeenCalledWith({
      reply: '支柱立てお疲れ様でした！しっかり誘引できていますね。',
    });

    // 通常の保存完了トーストが表示されること
    await waitFor(() => {
      expect(screen.getByText('💬 生徒への回答メッセージを更新・保存しました！')).toBeDefined();
    });
  });
});
