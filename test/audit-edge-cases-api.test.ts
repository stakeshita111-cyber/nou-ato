/**
 * 網羅的エッジケース監査 (API ルートハンドラー)
 *
 * - 実際の Route Handler (app/api/**) を import して検証する (自作シミュレーション禁止)
 * - Supabase クライアントは境界 (utils/supabase/server) のみモックする
 * - `it.fails` = 「現時点で未対応と確認済みの不具合」の再現テスト。
 *   修正すると該当テストが「失敗」と報告されるので、`.fails` を外して通常テストへ昇格させること。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type QueryResult = { data?: unknown; error?: { message: string } | null };

const state = {
  sessionUser: { id: 'teacher-1', email: 't@example.com', user_metadata: {} } as {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  } | null,
  usersById: {} as Record<string, { role: string; farm_id: string | null } | null>,
  rpcImpl: (async () => ({ data: null, error: null })) as (
    name: string,
    args?: Record<string, unknown>
  ) => Promise<QueryResult>,
  farmUpdateResult: { error: null } as QueryResult,
  journalInserts: [] as unknown[],
};

const rpcSpy = vi.fn((name: string, args?: Record<string, unknown>) => {
  if (name === 'save_ai_journal' && args) {
    state.journalInserts.push({
      content: args.p_content,
      reply: args.p_reply,
      is_private: args.p_is_private,
    });
  }
  return state.rpcImpl(name, args);
});
const generateRagAnswerSpy = vi.fn();

vi.mock('@supabase/supabase-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@supabase/supabase-js')>();
  return {
    ...actual,
    createClient: vi.fn(() => ({
      rpc: rpcSpy,
    })),
  };
});

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.sessionUser },
        error: state.sessionUser ? null : new Error('not logged in'),
      }),
    },
    rpc: rpcSpy,
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: state.usersById[id] ?? null, error: null }),
              single: async () => ({ data: state.usersById[id] ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === 'farm_members') {
        // 講師 teacher-1 は farm-A にだけ所属している
        return {
          select: () => ({
            eq: (_userCol: string, userId: string) => ({
              eq: (_farmCol: string, farmId: string) => ({
                maybeSingle: async () => ({
                  data: userId === 'teacher-1' && farmId === 'farm-A' ? { farm_id: farmId } : null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'farms') {
        return {
          select: () => ({
            or: async () => ({ data: [{ id: 'farm-A' }], error: null }),
          }),
          update: () => ({
            eq: async () => state.farmUpdateResult,
            in: async () => state.farmUpdateResult,
          }),
        };
      }
      if (table === 'journals') {
        const queryChain = {
          eq: () => queryChain,
          order: () => queryChain,
          limit: async () => ({ data: [], error: null }),
        };
        return {
          select: () => queryChain,
          insert: async (rows: unknown[]) => {
            state.journalInserts.push(...rows);
            return { error: null };
          },
        };
      }
      return {};
    },
  })),
}));

vi.mock('@/lib/rag/qaKnowledgeRetriever', () => ({
  generateRagAnswer: (...args: unknown[]) => generateRagAnswerSpy(...args),
}));

import { POST as grantPOST } from '@/app/api/tickets/grant/route';
import { POST as ragPOST } from '@/app/api/chat/rag/route';
import { POST as settingsPOST } from '@/app/api/settings/route';

const STUDENT_UUID = '11111111-1111-4111-8111-111111111111';

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  state.sessionUser = { id: 'teacher-1', email: 't@example.com', user_metadata: {} };
  state.usersById = {
    'teacher-1': { role: 'teacher', farm_id: 'farm-A' },
    [STUDENT_UUID]: { role: 'student', farm_id: 'farm-A' },
    'student-B': { role: 'student', farm_id: 'farm-B' },
  };
  state.farmUpdateResult = { error: null };
  state.journalInserts = [];
  generateRagAnswerSpy.mockResolvedValue({ reply: 'ok', referencedQa: [], status: 'ok' });
  state.rpcImpl = async (name, args) => {
    if (name === 'grant_ai_tickets') {
      const count = Number(args?.p_count);
      // DB 側 (20261010060000_ai_usage_atomic_and_ticket_hardening.sql:78-80) と同じ境界
      if (!Number.isInteger(count) || count < 1 || count > 10) {
        return { data: null, error: { message: 'p_count must be between 1 and 10' } };
      }
      return { data: { count: 3 + count }, error: null };
    }
    if (name === 'reserve_ai_usage') return { data: 'reservation-1', error: null };
    return { data: null, error: null };
  };
});

// ---------------------------------------------------------------------------
// 1. 境界値・異常入力: /api/tickets/grant (app/api/tickets/grant/route.ts:6-18)
// ---------------------------------------------------------------------------
describe('[境界値] POST /api/tickets/grant の amount バリデーション', () => {
  it.each([
    ['ゼロ', 0],
    ['マイナス', -1],
    ['小数', 1.5],
    ['文字列', '3'],
    ['null', null],
  ])('amount=%s は 400 で拒否し RPC を呼ばない', async (_label, amount) => {
    const res = await grantPOST(
      jsonRequest('http://localhost/api/tickets/grant', { studentId: STUDENT_UUID, amount })
    );
    expect(res.status).toBe(400);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  for (const [label, amount] of [
    ['DB上限(10)超過', 11],
    ['int4 オーバーフロー相当', 10_000_000_000],
  ] as const) {
    it(`amount=${label} は Zod 層で 400 とし、DB エラー文言を 500 で漏らさない`, async () => {
      const res = await grantPOST(
        jsonRequest('http://localhost/api/tickets/grant', { studentId: STUDENT_UUID, amount })
      );
      expect(res.status).toBe(400);
    });
  }

  it('他農園の受講生には 403 (越境防止)', async () => {
    state.usersById['22222222-2222-4222-8222-222222222222'] = {
      role: 'student',
      farm_id: 'farm-B',
    };
    const res = await grantPOST(
      jsonRequest('http://localhost/api/tickets/grant', {
        studentId: '22222222-2222-4222-8222-222222222222',
        amount: 1,
      })
    );
    expect(res.status).toBe(403);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('生徒権限のユーザーが呼び出すと 403 (講師専用 API)', async () => {
    state.sessionUser = { id: 'student-A', email: 's@example.com', user_metadata: {} };
    state.usersById['student-A'] = { role: 'student', farm_id: 'farm-A' };
    const res = await grantPOST(
      jsonRequest('http://localhost/api/tickets/grant', { studentId: STUDENT_UUID, amount: 1 })
    );
    expect(res.status).toBe(403);
    expect(rpcSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 1. 境界値・異常入力: /api/chat/rag (app/api/chat/rag/route.ts:7-16)
// ---------------------------------------------------------------------------
describe('[境界値] POST /api/chat/rag のメッセージ検証', () => {
  beforeEach(() => {
    state.sessionUser = { id: 'student-A', email: 's@example.com', user_metadata: {} };
    state.usersById['student-A'] = { role: 'student', farm_id: 'farm-A' };
    state.journalInserts = [];
  });

  it.each([
    ['空文字', ''],
    ['空白のみ', '   \n\t  '],
    ['1001文字', 'あ'.repeat(1001)],
  ])('%s は 400 で拒否しチケットを消費しない', async (_label, message) => {
    const res = await ragPOST(jsonRequest('http://localhost/api/chat/rag', { message }));
    expect(res.status).toBe(400);
    expect(rpcSpy).not.toHaveBeenCalledWith('reserve_ai_usage');
  });

  it('SQLインジェクション/XSS 文字列はパラメータとして無加工で保存され、200 を返す', async () => {
    const payload = `'; DROP TABLE journals; -- <script>alert(1)</script>`;
    const res = await ragPOST(jsonRequest('http://localhost/api/chat/rag', { message: payload }));
    expect(res.status).toBe(200);
    expect(state.journalInserts).toHaveLength(1);
    expect((state.journalInserts[0] as { content: string }).content).toBe(payload);
  });

  it('NULL文字 (\\u0000) を含むメッセージは 400 とし、チケット予約前に拒否する', async () => {
    const res = await ragPOST(
      jsonRequest('http://localhost/api/chat/rag', { message: '質問\u0000です' })
    );
    expect(res.status).toBe(400);
    expect(rpcSpy).not.toHaveBeenCalledWith('reserve_ai_usage');
  });

  it('絵文字600文字 (UTF-16で1200単位) は「1000文字以内」の仕様どおり受理する (Zod v4 はコードポイント数で判定)', async () => {
    const res = await ragPOST(
      jsonRequest('http://localhost/api/chat/rag', { message: '😀'.repeat(600) })
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 3. 通信障害: /api/settings (app/api/settings/route.ts:144-248)
// ---------------------------------------------------------------------------
describe('[障害/境界] POST /api/settings', () => {
  it('生徒は 403 (講師専用設定)', async () => {
    state.sessionUser = { id: 'student-A', email: 's@example.com', user_metadata: {} };
    state.usersById['student-A'] = { role: 'student', farm_id: 'farm-A' };
    const res = await settingsPOST(
      jsonRequest('http://localhost/api/settings', { showStudentTalkTab: false })
    );
    expect(res.status).toBe(403);
  });

  it('farms UPDATE が RLS/DB エラーで失敗したら 2xx を返さない', async () => {
    state.farmUpdateResult = { error: { message: 'new row violates row-level security' } };
    const res = await settingsPOST(
      jsonRequest('http://localhost/api/settings', { showStudentTalkTab: false })
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('presetFaqs の極端に長い文字列は 400', async () => {
    const res = await settingsPOST(
      jsonRequest('http://localhost/api/settings', {
        presetFaqs: [{ id: '1', chipLabel: 'a'.repeat(100_000), question: 'q', answer: 'a' }],
      })
    );
    expect(res.status).toBe(400);
  });

  it('presetFaqs の要素数上限 (例: 50件超) は 400', async () => {
    const presetFaqs = Array.from({ length: 5000 }, (_, i) => ({
      id: String(i),
      chipLabel: 'l',
      question: 'q',
      answer: 'a',
    }));
    const res = await settingsPOST(jsonRequest('http://localhost/api/settings', { presetFaqs }));
    expect(res.status).toBe(400);
  });
});
