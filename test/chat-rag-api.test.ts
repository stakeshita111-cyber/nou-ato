import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockGenerateRagAnswer = vi.fn();

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

vi.mock('@/lib/rag/qaKnowledgeRetriever', () => ({
  generateRagAnswer: (...args: unknown[]) => mockGenerateRagAnswer(...args),
}));

import { POST } from '@/app/api/chat/rag/route';

describe('/api/chat/rag Route Handler (多層防御セキュリティ & 2フェーズ台帳)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateRagAnswer.mockResolvedValue({
      reply:
        '【相談トピック: 栽培について】\nご質問ありがとうございます！水やりは朝の時間帯がおすすめです🌱',
      referencedQa: [],
      status: 'ok',
    });
  });

  it('1. 未ログイン(認証なし)の場合は 401 Unauthorized を返却すること', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    const req = new Request('http://localhost:3000/api/chat/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'トマトの育て方を教えて' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.title).toBe('Unauthorized');
    expect(body.detail).toContain('ログインが必要です');
  });

  it('2. メッセージが空または不完全な入力の場合は 400 Bad Request を返却すること', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user_test_123',
          email: 'student@example.com',
          user_metadata: { full_name: 'テスト受講生' },
        },
      },
      error: null,
    });

    const req = new Request('http://localhost:3000/api/chat/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.title).toBe('Bad Request');
    expect(body.detail).toContain('メッセージが空です');
  });

  it('3. 1日の回数制限(3回)を超過した場合は 429 Too Many Requests を返却すること', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user_test_123',
          email: 'student@example.com',
          user_metadata: { full_name: 'テスト受講生' },
        },
      },
      error: null,
    });

    // RPC reserve_ai_usage が null (上限到達) を返却
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'reserve_ai_usage') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = new Request('http://localhost:3000/api/chat/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'ナスに追肥する時期はいつですか？' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.title).toBe('Too Many Requests');
    expect(body.detail).toContain('上限に達しました');
  });

  it('4. 認証済み＆回数制限内の場合は 200 OK と AI回答を返却し、チケットをコミットすること', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user_test_123',
          email: 'student@example.com',
          user_metadata: { full_name: 'テスト受講生' },
        },
      },
      error: null,
    });

    // RPC reserve_ai_usage が予約UUIDを返却
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'reserve_ai_usage') {
        return Promise.resolve({ data: 'reserve-uuid-1', error: null });
      }
      if (rpcName === 'finalize_ai_usage') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // journals DB クエリのモック
    const mockJournalsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ content: '前回の質問', reply: '前回の回答', role: 'student' }],
            error: null,
          }),
        }),
      }),
    });

    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'journals') {
        return {
          select: mockJournalsSelect,
        };
      }
      return {};
    });

    const req = new Request('http://localhost:3000/api/chat/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'キュウリのうどんこ病対策を教えて' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.reply).toContain('【相談トピック');
    expect(body.timestamp).toBeDefined();

    // finalize_ai_usage が commit: true で呼ばれたか検証
    expect(mockRpc).toHaveBeenCalledWith('finalize_ai_usage', {
      p_id: 'reserve-uuid-1',
      p_commit: true,
    });

    // 専用RPC save_ai_journal への保存で reply が保存され、is_private: false であること
    expect(mockRpc).toHaveBeenCalledWith('save_ai_journal', {
      p_content: 'キュウリのうどんこ病対策を教えて',
      p_reply: expect.stringContaining('水やりは朝の時間帯'),
      p_is_private: false,
    });
  });

  it('5. AI生成がdegraded(フォールバック)時はチケットを解放し、DBのreplyをnullとして保存すること', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user_test_123',
          email: 'student@example.com',
          user_metadata: { full_name: 'テスト受講生' },
        },
      },
      error: null,
    });

    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === 'reserve_ai_usage') {
        return Promise.resolve({ data: 'reserve-uuid-2', error: null });
      }
      if (rpcName === 'finalize_ai_usage') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockGenerateRagAnswer.mockResolvedValue({
      reply: '【AI相棒（しるべぇ）よりお知らせ】混雑しております',
      referencedQa: [],
      status: 'degraded',
    });

    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'journals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const req = new Request('http://localhost:3000/api/chat/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '病気かもしれません', isPrivate: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // finalize_ai_usage は commit: false で解放されること
    expect(mockRpc).toHaveBeenCalledWith('finalize_ai_usage', {
      p_id: 'reserve-uuid-2',
      p_commit: false,
    });

    // 専用RPC save_ai_journal には reply: undefined (フォールバック時) & is_private: true で保存されること
    expect(mockRpc).toHaveBeenCalledWith('save_ai_journal', {
      p_content: '病気かもしれません',
      p_reply: undefined,
      p_is_private: true,
    });
  });
});
