import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockGenerateRagAnswer = vi.fn();

const defaultUsersMock = {
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { role: 'student', farm_id: 'farm-123' },
        error: null,
      }),
    }),
  }),
};

const createChainableJournalsMock = (
  data = [{ content: '前回の質問', reply: '前回の回答', role: 'student' }]
) => {
  const chain = {
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn().mockResolvedValue({ data, error: null }),
  };
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  return {
    select: vi.fn().mockReturnValue(chain),
  };
};

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    rpc: mockRpc,
    from: (tableName: string) => {
      const res = mockFrom(tableName);
      if (tableName === 'users' && (!res || typeof res.select !== 'function')) {
        return defaultUsersMock;
      }
      if (tableName === 'journals' && (!res || typeof res.select !== 'function')) {
        return createChainableJournalsMock();
      }
      return res;
    },
  })),
}));

vi.mock('@supabase/supabase-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@supabase/supabase-js')>();
  return {
    ...actual,
    createClient: vi.fn(() => ({
      rpc: mockRpc,
      from: mockFrom,
    })),
  };
});

vi.mock('@/lib/rag/qaKnowledgeRetriever', () => ({
  generateRagAnswer: (...args: unknown[]) => mockGenerateRagAnswer(...args),
}));

import { POST } from '@/app/api/chat/rag/route';

describe('/api/chat/rag Route Handler (多層防御セキュリティ & 2フェーズ台帳)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    mockGenerateRagAnswer.mockResolvedValue({
      reply:
        '【相談トピック: 栽培について】\nご質問ありがとうございます！水やりは朝の時間帯がおすすめです🌱',
      referencedQa: [],
      status: 'ok',
    });
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return defaultUsersMock;
      }
      if (tableName === 'journals') {
        return createChainableJournalsMock();
      }
      return {};
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

    const journalsMock = createChainableJournalsMock();
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'journals') {
        return journalsMock;
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

    // studentFarmId が存在する場合に journals のクエリへ .eq('farm_id', <farm_id>) が渡ること
    expect(journalsMock.select().eq).toHaveBeenCalledWith('farm_id', 'farm-123');

    // finalize_ai_usage が commit: true で呼ばれたか検証
    expect(mockRpc).toHaveBeenCalledWith('finalize_ai_usage', {
      p_id: 'reserve-uuid-1',
      p_commit: true,
    });

    // 専用RPC save_ai_journal への保存で reply が保存され、is_private: false であること
    expect(mockRpc).toHaveBeenCalledWith('save_ai_journal', {
      p_student_id: 'user_test_123',
      p_content: 'キュウリのうどんこ病対策を教えて',
      p_reply: expect.stringContaining('水やりは朝の時間帯'),
      p_is_private: false,
      p_is_memo: false,
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

    const journalsMock = createChainableJournalsMock([]);
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'journals') {
        return journalsMock;
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
      p_student_id: 'user_test_123',
      p_content: '病気かもしれません',
      p_reply: undefined,
      p_is_private: true,
      p_is_memo: false,
    });
  });

  describe('Phase 2 Hardening Tests', () => {
    it('2-1-A. プロフィール取得エラー時は 503 を返し、reserve_ai_usage を呼ばないこと', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'user_test_123',
            email: 'student@example.com',
          },
        },
        error: null,
      });

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database connection error' },
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
        body: JSON.stringify({ message: 'トマトの育て方' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(503);
      expect(mockRpc).not.toHaveBeenCalledWith('reserve_ai_usage');
    });

    it('2-1-B. プロフィール行が存在しない場合は 403 を返し、reserve_ai_usage を呼ばないこと', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'user_test_123',
            email: 'student@example.com',
          },
        },
        error: null,
      });

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
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
        body: JSON.stringify({ message: 'トマトの育て方' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      expect(mockRpc).not.toHaveBeenCalledWith('reserve_ai_usage');
    });

    it('2-2. SUPABASE_SERVICE_ROLE_KEY が設定されていない場合は 503 を返し、reserve_ai_usage を呼ばないこと', async () => {
      const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      try {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        mockGetUser.mockResolvedValue({
          data: {
            user: {
              id: 'user_test_123',
              email: 'student@example.com',
            },
          },
          error: null,
        });

        mockFrom.mockImplementation((tableName: string) => {
          if (tableName === 'users') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { role: 'student', farm_id: 'farm-123' },
                    error: null,
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
          body: JSON.stringify({ message: 'トマトの育て方' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(503);
        expect(mockRpc).not.toHaveBeenCalledWith('reserve_ai_usage');
      } finally {
        if (origKey !== undefined) {
          process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
        }
      }
    });

    it('2-3. finalize_ai_usage がエラーを返しても 200 で回答を返し、logger.error が呼ばれること', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'user_test_123',
            email: 'student@example.com',
          },
        },
        error: null,
      });

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: 'student', farm_id: 'farm-123' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (tableName === 'journals') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'reserve_ai_usage') {
          return Promise.resolve({ data: 'reserve-uuid-fail', error: null });
        }
        if (rpcName === 'finalize_ai_usage') {
          return Promise.resolve({
            data: null,
            error: { message: 'Failed to finalize reservation' },
          });
        }
        if (rpcName === 'save_ai_journal') {
          return Promise.resolve({ data: { id: 'journal-1' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const req = new Request('http://localhost:3000/api/chat/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'トマトの育て方' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reply).toBeDefined();
    });

    it('2-4-A. 通常のAI相談では save_ai_journal に p_is_memo: false が渡ること', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'user_test_123',
            email: 'student@example.com',
          },
        },
        error: null,
      });

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: 'student', farm_id: 'farm-123' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (tableName === 'journals') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'reserve_ai_usage') {
          return Promise.resolve({ data: 'reserve-uuid-ok', error: null });
        }
        if (rpcName === 'finalize_ai_usage') {
          return Promise.resolve({ data: null, error: null });
        }
        if (rpcName === 'save_ai_journal') {
          return Promise.resolve({ data: { id: 'journal-1' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const req = new Request('http://localhost:3000/api/chat/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'トマトの育て方' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith(
        'save_ai_journal',
        expect.objectContaining({
          p_is_memo: false,
        })
      );
    });

    it('2-4-B. メモ専用モードでは save_ai_journal に p_is_memo: true が渡ること', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'user_test_123',
            email: 'student@example.com',
          },
        },
        error: null,
      });

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: 'student', farm_id: 'farm-123' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (tableName === 'journals') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  like: vi.fn().mockResolvedValue({ count: 5, error: null }),
                }),
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'save_ai_journal') {
          return Promise.resolve({ data: { id: 'journal-memo-1' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const req = new Request('http://localhost:3000/api/chat/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'メモ内容です', isMemoOnly: true }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith(
        'save_ai_journal',
        expect.objectContaining({
          p_is_memo: true,
        })
      );
    });

    it('2-4-C. メモ専用モードで save_ai_journal が P0429 エラーを返した場合は 429 Too Many Requests を返すこと', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'user_test_123',
            email: 'student@example.com',
          },
        },
        error: null,
      });

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: 'student', farm_id: 'farm-123' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (tableName === 'journals') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  like: vi.fn().mockResolvedValue({ count: 5, error: null }),
                }),
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockRpc.mockImplementation((rpcName: string) => {
        if (rpcName === 'save_ai_journal') {
          return Promise.resolve({
            data: null,
            error: { code: 'P0429', message: 'Daily memo limit exceeded' },
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const req = new Request('http://localhost:3000/api/chat/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'メモ内容です', isMemoOnly: true }),
      });

      const res = await POST(req);
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.detail).toContain('本日の質問メモ保存上限');
    });
  });
});
