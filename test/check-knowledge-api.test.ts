import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/chat/check-knowledge/route';

let mockUser: { id: string; email?: string } | null = null;
let mockAuthError: Error | null = null;
let shouldThrowInCreateClient = false;

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => {
    if (shouldThrowInCreateClient) {
      throw new Error('Supabase client creation error');
    }
    return {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: mockUser },
          error: mockAuthError,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      })),
      rpc: vi.fn(async () => ({ data: [], error: null })),
    };
  }),
}));

vi.mock('@/lib/rag/qaKnowledgeRetriever', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rag/qaKnowledgeRetriever')>();
  return {
    ...actual,
    searchSimilarKnowledge: vi.fn(async () => []),
  };
});

describe('/api/chat/check-knowledge Route Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-1' };
    mockAuthError = null;
    shouldThrowInCreateClient = false;
  });

  it('1. Returns 401 Unauthorized when unauthenticated', async () => {
    mockUser = null;
    mockAuthError = new Error('Auth error');

    const req = new Request('http://localhost:3000/api/chat/check-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '追肥について' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.title).toBe('Unauthorized');
    expect(body.detail).toContain('ログインが必要です');
  });

  it('2. Returns 200 OK with empty matches for empty question', async () => {
    const req = new Request('http://localhost:3000/api/chat/check-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '   ' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ matches: [] });
  });

  it('3. Returns 200 OK with empty matches for greetings or non-question reports', async () => {
    const req = new Request('http://localhost:3000/api/chat/check-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'こんにちは！収穫した！' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ matches: [] });
  });

  it('4. Returns 200 OK with matched preset FAQs when keyword matches', async () => {
    const req = new Request('http://localhost:3000/api/chat/check-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '追肥のタイミングや肥料について教えてください' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.matches).toBeDefined();
    expect(body.matches.length).toBeGreaterThan(0);
    expect(body.matches[0].id).toBe('faq_fertilizer');
    expect(body.matches[0].matchedKeywords).toContain('追肥');
  });

  it('5. Returns 500 RFC 7807 Internal Server Error when processing throws an exception', async () => {
    shouldThrowInCreateClient = true;

    const req = new Request('http://localhost:3000/api/chat/check-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '追肥のタイミング' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.status).toBe(500);
    expect(body.title).toBe('Internal Server Error');
    expect(body.detail).toBe('ナレッジ検索中にエラーが発生しました');
  });
});
