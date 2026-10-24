import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/tickets/grant/route';

let mockSessionUser: { id: string; email: string } | null = {
  id: 'teacher-user-123',
  email: 'teacher@example.com',
};
let mockDbUser: { role: string; farm_id?: string | null } | null = {
  role: 'teacher',
  farm_id: 'farm-123',
};
let mockTargetStudent: { role: string; farm_id?: string | null } | null = {
  role: 'student',
  farm_id: 'farm-123',
};
let mockRpcData: unknown = [{ count: 4 }];
let mockRpcError: unknown = null;
// ログイン中の講師が farm_members で所属している農園
let mockTeacherFarmIds: string[] = ['farm-123'];

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockSessionUser },
        error: mockSessionUser ? null : new Error('Not logged in'),
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => ({
              single: vi.fn(async () => {
                if (val === 'teacher-user-123') return { data: mockDbUser, error: null };
                return { data: mockTargetStudent, error: null };
              }),
              maybeSingle: vi.fn(async () => {
                if (val === 'teacher-user-123') return { data: mockDbUser, error: null };
                return { data: mockTargetStudent, error: null };
              }),
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
                maybeSingle: vi.fn(async () => ({
                  data: { count: 3, granted_count: 0 },
                  error: null,
                })),
              })),
            })),
          })),
          upsert: vi.fn(async () => ({ data: null, error: null })),
        };
      }
      if (table === 'farm_members') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn((_col: string, farmId: string) => ({
                maybeSingle: vi.fn(async () => ({
                  data: mockTeacherFarmIds.includes(farmId) ? { farm_id: farmId } : null,
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({})) })),
      };
    }),
    rpc: vi.fn(async () => ({
      data: mockRpcData,
      error: mockRpcError,
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
      data: mockRpcData,
      error: mockRpcError,
    })),
  },
}));

describe('/api/tickets/grant Route Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser = { id: 'teacher-user-123', email: 'teacher@example.com' };
    mockDbUser = { role: 'teacher', farm_id: 'farm-123' };
    mockTargetStudent = { role: 'student', farm_id: 'farm-123' };
    mockRpcData = [{ count: 4 }];
    mockRpcError = null;
    mockTeacherFarmIds = ['farm-123'];
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

  it('POST returns 401 Unauthorized when not logged in', async () => {
    mockSessionUser = null;

    const request = new Request('http://localhost/api/tickets/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: '00000000-0000-0000-0000-000000000001', amount: 1 }),
    });

    const res = await POST(request);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.title).toBe('Unauthorized');
  });

  it('POST returns 403 Forbidden when caller is student role', async () => {
    mockDbUser = { role: 'student', farm_id: 'farm-123' };

    const request = new Request('http://localhost/api/tickets/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: '00000000-0000-0000-0000-000000000001', amount: 1 }),
    });

    const res = await POST(request);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.title).toBe('Forbidden');
  });

  it('POST returns 403 Forbidden when target student is from another farm', async () => {
    mockTargetStudent = { role: 'student', farm_id: 'different-farm-999' };

    const request = new Request('http://localhost/api/tickets/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: '00000000-0000-0000-0000-000000000001', amount: 1 }),
    });

    const res = await POST(request);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.title).toBe('Forbidden');
    expect(body.detail).toContain('他農園');
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

  it('POST returns 500 when RPC returns invalid schema without count', async () => {
    mockRpcData = { invalid: 'payload' };
    const studentId = '00000000-0000-0000-0000-000000000001';
    const request = new Request('http://localhost/api/tickets/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, amount: 1 }),
    });

    const res = await POST(request);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.title).toBe('Internal Server Error');
    expect(body.detail).toContain('チケット付与結果の取得に失敗しました');
  });

  it('POST grants tickets to a student in another farm the teacher belongs to (co-teacher)', async () => {
    mockTargetStudent = { role: 'student', farm_id: 'farm-456' };
    mockTeacherFarmIds = ['farm-123', 'farm-456'];
    const request = new Request('http://localhost/api/tickets/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: '00000000-0000-0000-0000-000000000001', amount: 1 }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
  });

  it('POST returns 403 when the student has no farm', async () => {
    mockTargetStudent = { role: 'student', farm_id: null };
    const request = new Request('http://localhost/api/tickets/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: '00000000-0000-0000-0000-000000000001', amount: 1 }),
    });

    const res = await POST(request);
    expect(res.status).toBe(403);
  });
});
