import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/tickets/grant/route';

const mockSessionUser = { id: 'teacher-user-123', email: 'teacher@example.com' };
const mockDbUser = { role: 'teacher' };

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockSessionUser }, error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: mockDbUser, error: null })),
            })),
          })),
        };
      }
      if (table === 'ai_tickets') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { count: 3, granted_count: 0 }, error: null })),
              })),
            })),
          })),
          upsert: vi.fn(async () => ({ data: null, error: null })),
        };
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({})) })),
      };
    }),
    rpc: vi.fn(async (_fn: string, _args: any) => ({
      data: [{ count: 4 }],
      error: null,
    })),
  })),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockSessionUser }, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({})) })),
    })),
    rpc: vi.fn(async () => ({
      data: [{ count: 4 }],
      error: null,
    })),
  },
}));

describe('/api/tickets/grant Route Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST validates studentId and returns 400 when missing', async () => {
    const request = new Request('http://localhost/api/tickets/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1 }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.title).toBe('Bad Request');
    expect(body.detail).toBe('受講生ID (studentId) は必須です');
  });

  it('POST validates amount and returns 400 when invalid', async () => {
    const request = new Request('http://localhost/api/tickets/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: '00000000-0000-0000-0000-000000000001', amount: -1 }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.title).toBe('Bad Request');
    expect(body.detail).toBe('付与枚数 (amount) は1以上の数値を指定してください');
  });

  it('POST grants ticket successfully with 200 status', async () => {
    const studentId = '00000000-0000-0000-0000-000000000001';
    const request = new Request('http://localhost/api/tickets/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, amount: 1 }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.studentId).toBe(studentId);
    expect(body.amount).toBe(1);
    expect(typeof body.newCount).toBe('number');
  });
});
