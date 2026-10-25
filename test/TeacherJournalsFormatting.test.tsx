// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TeacherJournalsView from '../components/teacher/TeacherJournalsView';

const sampleJournals = [
  {
    id: 'journal-ai-markdown-1',
    student_id: 'student-1',
    farm_id: 'farm-1',
    content:
      '【相談トピック: レタスの虫食い対策】\n大切なレタスです。\n🥦 **簡単！お酢スプレー**\n・水: 500ml',
    reply: '【しるべぇ】それは**うどんこ病**の可能性があります。早めに**重曹水**を散布しましょう。',
    is_approved: false,
    is_private: false,
    created_at: '2026-10-25T10:00:00Z',
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
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          insert: vi.fn().mockResolvedValue({ error: null }),
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

describe('TeacherJournalsView - 提出ノートおよびAI回答のMarkdown整形表示', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('提出ノート(content)とAI回答(reply)内の太字記法(**太字**)が両方ともstrong要素として整形されること', async () => {
    await act(async () => {
      render(<TeacherJournalsView />);
    });

    // 「📜 すべて」タブに切り替えて日誌を表示
    const allTabBtn = screen.getByText(/📜 すべて/);
    await act(async () => {
      fireEvent.click(allTabBtn);
    });

    // 質問トピックが表示されること
    expect(await screen.findAllByText(/レタスの虫食い対策/)).toBeDefined();

    // strong タグとしてレンダリングされているテキストを検証
    const strongElements = screen.getAllByRole('strong');
    const boldTexts = strongElements.map((el) => el.textContent);

    // 1. 生徒提出ノート (content) 内の **簡単！お酢スプレー** が strong 化されていること
    expect(boldTexts).toContain('簡単！お酢スプレー');
    expect(screen.queryByText('**簡単！お酢スプレー**')).toBeNull();

    // 2. 回答 (reply) 内の **うどんこ病** や **重曹水** が strong 化されていること
    expect(boldTexts).toContain('うどんこ病');
    expect(boldTexts).toContain('重曹水');
    expect(screen.queryByText('**うどんこ病**')).toBeNull();
  });
});
