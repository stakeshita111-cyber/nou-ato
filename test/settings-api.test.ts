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
    expect(body.settings).toEqual({ showStudentTalkTab: true });
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
    expect(body.settings).toEqual({
      showStudentTalkTab: false,
      customOption: 'test',
    });
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
