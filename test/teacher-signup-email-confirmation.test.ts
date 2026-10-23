import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/auth/callback/route';
import {
  buildPendingTeacherSignupMetadata,
  readPendingTeacherSignup,
} from '@/lib/auth/pendingTeacherSignup';

// -----------------------------------------------------------------------------
// 本物の /auth/callback ルートハンドラーを、Supabase サーバークライアントだけモックして検証する
// -----------------------------------------------------------------------------
type ExistingUserRow = { role: string; display_name: string | null; farm_id: string | null };

let existingUser: ExistingUserRow | null;
let userMetadata: Record<string, unknown>;
let registerTeacherResult: { data: unknown; error: { message: string } | null };
let inviteCookie: string | undefined;

const mockRpc = vi.fn(async (name: string) => {
  if (name === 'register_teacher') return registerTeacherResult;
  return { data: { success: true }, error: null };
});
const mockUpdateEq = vi.fn(async () => ({ error: null }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === 'nouato_invite_code' && inviteCookie ? { value: inviteCookie } : undefined,
    delete: vi.fn(),
  })),
}));

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: vi.fn(async () => ({ error: null })),
      getUser: vi.fn(async () => ({
        data: {
          user: { id: 'user-1', email: 'new-teacher@example.com', user_metadata: userMetadata },
        },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: existingUser, error: null })),
        })),
      })),
      update: mockUpdate,
    })),
    rpc: mockRpc,
  })),
}));

function callbackRequest(query: string) {
  return new Request(`https://nou-ato.vercel.app/auth/callback?${query}`);
}

function redirectPath(response: Response) {
  const location = response.headers.get('location') ?? '';
  const url = new URL(location);
  return `${url.pathname}${url.search}`;
}

describe('講師登録: メール確認後の /auth/callback で農園開設を完了する', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existingUser = { role: 'student', display_name: null, farm_id: null };
    userMetadata = { ...buildPendingTeacherSignupMetadata('太陽農園', '山田 講師') };
    registerTeacherResult = {
      data: { success: true, farm_id: 'farm-new', invite_code: 'abcdef123456' },
      error: null,
    };
    inviteCookie = undefined;
  });

  it('講師登録の意思がある未所属アカウントは register_teacher で農園を開設し、講師ダッシュボードへ移動する', async () => {
    const response = await GET(callbackRequest('code=abc&next=/teacher/dashboard'));

    expect(mockRpc).toHaveBeenCalledWith('register_teacher', { farm_name: '太陽農園' });
    expect(mockUpdate).toHaveBeenCalledWith({ display_name: '山田 講師' });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-1');
    expect(redirectPath(response)).toBe('/teacher/dashboard');
  });

  it('register_teacher が失敗した場合は、農園未所属画面 (/student?teacher_setup=failed) へ移動する', async () => {
    registerTeacherResult = {
      data: null,
      error: { message: 'Already belongs to a farm as student' },
    };

    const response = await GET(callbackRequest('code=abc&next=/teacher/dashboard'));

    expect(mockRpc).toHaveBeenCalledWith('register_teacher', { farm_name: '太陽農園' });
    expect(redirectPath(response)).toBe('/student?teacher_setup=failed');
  });

  it('講師登録の意思が無い生徒アカウントでは register_teacher を呼ばない', async () => {
    userMetadata = { email_verified: true };

    const response = await GET(callbackRequest('code=abc&next=/student'));

    expect(mockRpc).not.toHaveBeenCalledWith('register_teacher', expect.anything());
    expect(redirectPath(response)).toBe('/student');
  });

  it('すでに農園に所属している生徒は、講師登録の意思があっても register_teacher を呼ばない', async () => {
    existingUser = { role: 'student', display_name: '生徒A', farm_id: 'farm-a' };

    const response = await GET(callbackRequest('code=abc&next=/student'));

    expect(mockRpc).not.toHaveBeenCalled();
    expect(redirectPath(response)).toBe('/student');
  });

  it('講師登録の途中では招待コードによる join_farm を行わない', async () => {
    inviteCookie = 'test-invite-001';

    await GET(callbackRequest('code=abc&next=/teacher/dashboard'));

    expect(mockRpc).toHaveBeenCalledWith('register_teacher', { farm_name: '太陽農園' });
    expect(mockRpc).not.toHaveBeenCalledWith('join_farm', expect.anything());
  });

  it('既存の講師は register_teacher を呼ばずに講師ダッシュボードへ移動する', async () => {
    existingUser = { role: 'teacher', display_name: '講師', farm_id: 'farm-a' };

    const response = await GET(callbackRequest('code=abc'));

    expect(mockRpc).not.toHaveBeenCalled();
    expect(redirectPath(response)).toBe('/teacher/dashboard');
  });
});

describe('講師登録の意思 (user_metadata) の読み取り', () => {
  it('講師登録フォームで保存した内容を読み取れる', () => {
    expect(
      readPendingTeacherSignup(buildPendingTeacherSignupMetadata(' 太陽農園 ', '山田'))
    ).toEqual({
      signup_intent: 'teacher',
      pending_farm_name: '太陽農園',
      pending_display_name: '山田',
    });
  });

  it('意思が無い・農園名が空のメタデータは null を返す', () => {
    expect(readPendingTeacherSignup({ email_verified: true })).toBeNull();
    expect(
      readPendingTeacherSignup({ signup_intent: 'teacher', pending_farm_name: '  ' })
    ).toBeNull();
    expect(readPendingTeacherSignup(null)).toBeNull();
  });
});
