import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/settings/route';

let mockUser: { id: string; email?: string } | null = null;
let mockUserData: { farm_id?: string | null; role?: string } | null = null;
let mockFarmsData: Array<{ id: string; show_student_talk_tab?: boolean | null }> = [];

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser } })),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: mockUserData })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        };
      }
      if (table === 'farms') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_field: string, value: string) => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: mockFarmsData.find((f) => f.id === value) || mockFarmsData[0] || null,
                })),
              })),
              maybeSingle: vi.fn(async () => ({
                data: mockFarmsData.find((f) => f.id === value) || null,
              })),
            })),
            or: vi.fn(async () => ({
              data: mockFarmsData,
            })),
            limit: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: mockFarmsData[0] || null,
              })),
            })),
          })),
          update: vi.fn(() => ({
            in: vi.fn(async () => ({ error: null })),
            eq: vi.fn(async () => ({ error: null })),
          })),
          upsert: vi.fn(async () => ({ error: null })),
        };
      }
      return {
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null })),
          })),
        })),
      };
    }),
  })),
}));

describe('/api/settings Route Handler', () => {
  beforeEach(() => {
    mockUser = null;
    mockUserData = null;
    mockFarmsData = [];
  });

  it('GET returns default settings with 200 status when no farm is found', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.settings).toMatchObject({ showStudentTalkTab: true });
    expect(body.showStudentTalkTab).toBe(true);
  });

  it('GET returns farm show_student_talk_tab setting when farm exists in DB', async () => {
    mockUser = { id: 'teacher-1' };
    mockUserData = { farm_id: 'farm-123', role: 'teacher' };
    mockFarmsData = [{ id: 'farm-123', show_student_talk_tab: false }];

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.showStudentTalkTab).toBe(false);
    expect(body.settings.showStudentTalkTab).toBe(false);
  });

  it('POST validates body and updates settings with 200 status for authenticated teacher', async () => {
    mockUser = { id: 'teacher-1' };
    mockUserData = { farm_id: 'farm-123', role: 'teacher' };
    mockFarmsData = [{ id: 'farm-123', show_student_talk_tab: true }];

    const request = new Request('http://localhost/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showStudentTalkTab: false, customOption: 'test' }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.showStudentTalkTab).toBe(false);
    expect(body.settings).toMatchObject({
      showStudentTalkTab: false,
      customOption: 'test',
    });
  });

  it('GET returns default presetFaqs when no custom faqs exist in farm', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.presetFaqs).toBeDefined();
    expect(Array.isArray(body.presetFaqs)).toBe(true);
    expect(body.presetFaqs.length).toBe(4);
    expect(body.presetFaqs[0].chipLabel).toBe('🌱 追肥のやり方');
  });

  it('GET returns farm-specific preset_faqs when configured in DB', async () => {
    const customFaqs = [
      {
        id: 'faq_c1',
        chipLabel: '🥦 収穫のサイン',
        question: 'ブロッコリーの収穫サインは？',
        answer: 'つぼみが固く締まったら収穫適期です。',
      },
    ];
    mockUser = { id: 'teacher-1' };
    mockUserData = { farm_id: 'farm-123', role: 'teacher' };
    mockFarmsData = [
      {
        id: 'farm-123',
        show_student_talk_tab: true,
        preset_faqs: customFaqs,
      } as unknown as { id: string; show_student_talk_tab?: boolean | null },
    ];

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.presetFaqs).toHaveLength(1);
    expect(body.presetFaqs[0].chipLabel).toBe('🥦 収穫のサイン');
  });

  it('POST updates presetFaqs in DB for authenticated teacher', async () => {
    mockUser = { id: 'teacher-1' };
    mockUserData = { farm_id: 'farm-123', role: 'teacher' };
    mockFarmsData = [{ id: 'farm-123', show_student_talk_tab: true }];

    const customFaqs = [
      {
        id: 'faq_new',
        chipLabel: '🍓 イチゴのランナー',
        question: 'ランナーの整理はどうすれば？',
        answer: '元気な子株を2株残して切り取ります。',
      },
    ];

    const request = new Request('http://localhost/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetFaqs: customFaqs }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.presetFaqs).toHaveLength(1);
    expect(body.presetFaqs[0].chipLabel).toBe('🍓 イチゴのランナー');
  });

  it('POST returns 400 Bad Request when presetFaqs contains invalid item structure', async () => {
    mockUser = { id: 'teacher-1' };
    mockUserData = { farm_id: 'farm-123', role: 'teacher' };

    const invalidFaqs = [
      {
        id: 'faq_bad',
        chipLabel: '', // 空ラベルでバリデーションエラー
        question: '質問',
        answer: '回答',
      },
    ];

    const request = new Request('http://localhost/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetFaqs: invalidFaqs }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.title).toBe('Bad Request');
  });

  it('POST returns 400 Bad Request when request body is an array or invalid JSON/non-object', async () => {
    const request = new Request('http://localhost/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([1, 2, 3]),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.title).toBe('Bad Request');
    expect(body.detail).toBe('リクエストボディが不正です');
  });
});
