// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFarmStore } from '@/store/useFarmStore';
import { supabase } from '@/lib/supabase';

type RpcResult = { data: unknown; error: unknown };
const rpcState = vi.hoisted(() => ({
  handlers: {} as Record<string, () => { data: unknown; error: unknown }>,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (name: string): Promise<RpcResult> => {
      const handler = rpcState.handlers[name];
      return handler ? handler() : { data: null, error: null };
    }),
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

const rpcMock = vi.mocked(supabase.rpc);

const FARM_A = '11111111-1111-4111-8111-111111111111';
const FARM_B = '22222222-2222-4222-8222-222222222222';
const FARM_NEW = '33333333-3333-4333-8333-333333333333';

function mockRpc(handlers: Record<string, () => RpcResult>) {
  rpcState.handlers = handlers;
}

describe('useFarmStore - 所属農園 (list_my_farms / create_farm)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcState.handlers = {};
    localStorage.clear();
    useFarmStore.setState({
      farms: [],
      activeFarmId: '',
      activeFarmName: '',
      isLoading: true,
      loadError: null,
    });
  });

  it('list_my_farms の所属農園を一覧にし、保持中の activeFarmId が所属農園なら引き継ぐ', async () => {
    useFarmStore.setState({ activeFarmId: FARM_B });
    mockRpc({
      list_my_farms: () => ({
        data: [
          { farm_id: FARM_A, name: '太陽農園', invite_code: 'aaa' },
          { farm_id: FARM_B, name: '月光農園', invite_code: 'bbb' },
        ],
        error: null,
      }),
    });

    const farms = await useFarmStore.getState().fetchTeacherFarms();

    expect(rpcMock).toHaveBeenCalledWith('list_my_farms');
    expect(supabase.from).not.toHaveBeenCalled();
    expect(farms.map((f) => f.id)).toEqual([FARM_A, FARM_B]);
    expect(useFarmStore.getState().activeFarmId).toBe(FARM_B);
    expect(useFarmStore.getState().activeFarmName).toBe('月光農園');
    expect(localStorage.getItem('nouato_active_farm_id')).toBe(FARM_B);
  });

  it('保持中の activeFarmId が所属農園に無ければ、先頭の所属農園に切り替える', async () => {
    useFarmStore.setState({ activeFarmId: 'not-my-farm' });
    mockRpc({
      list_my_farms: () => ({
        data: [{ farm_id: FARM_A, name: '太陽農園', invite_code: 'aaa' }],
        error: null,
      }),
    });

    await useFarmStore.getState().fetchTeacherFarms();

    expect(useFarmStore.getState().activeFarmId).toBe(FARM_A);
  });

  it('所属農園が無ければ activeFarmId を空にし、localStorage の農園IDも消す', async () => {
    localStorage.setItem('nouato_active_farm_id', 'stale');
    useFarmStore.setState({ activeFarmId: 'stale' });
    mockRpc({ list_my_farms: () => ({ data: [], error: null }) });

    await useFarmStore.getState().fetchTeacherFarms();

    expect(useFarmStore.getState().farms).toEqual([]);
    expect(useFarmStore.getState().activeFarmId).toBe('');
    expect(localStorage.getItem('nouato_active_farm_id')).toBeNull();
  });

  it('list_my_farms がエラーなら loadError を設定し、一覧を変更しない', async () => {
    useFarmStore.setState({ farms: [{ id: FARM_A, name: '太陽農園' }], activeFarmId: FARM_A });
    mockRpc({ list_my_farms: () => ({ data: null, error: { message: 'boom' } }) });

    await useFarmStore.getState().fetchTeacherFarms();

    expect(useFarmStore.getState().loadError).toBe('農園一覧の取得に失敗しました');
    expect(useFarmStore.getState().farms).toEqual([{ id: FARM_A, name: '太陽農園' }]);
    expect(useFarmStore.getState().activeFarmId).toBe(FARM_A);
  });

  it('list_my_farms の形式が不正 (farm_id が uuid でない) なら採用しない', async () => {
    mockRpc({
      list_my_farms: () => ({
        data: [{ farm_id: 'x', name: '不正', invite_code: null }],
        error: null,
      }),
    });

    await useFarmStore.getState().fetchTeacherFarms();

    expect(useFarmStore.getState().loadError).toBe('農園一覧の形式が不正です');
    expect(useFarmStore.getState().farms).toEqual([]);
  });

  it('setActiveFarmId は所属していない農園には切り替えない', () => {
    useFarmStore.setState({ farms: [{ id: FARM_A, name: '太陽農園' }], activeFarmId: FARM_A });

    useFarmStore.getState().setActiveFarmId(FARM_B);

    expect(useFarmStore.getState().activeFarmId).toBe(FARM_A);
  });

  it('createFarm は create_farm を呼び、一覧を取り直して新しい農園に切り替える', async () => {
    let created = false;
    mockRpc({
      create_farm: () => {
        created = true;
        return {
          data: { success: true, farm_id: FARM_NEW, farm_name: '新農園', invite_code: 'ccc' },
          error: null,
        };
      },
      list_my_farms: () => ({
        data: [
          { farm_id: FARM_A, name: '太陽農園', invite_code: 'aaa' },
          ...(created ? [{ farm_id: FARM_NEW, name: '新農園', invite_code: 'ccc' }] : []),
        ],
        error: null,
      }),
    });

    const result = await useFarmStore.getState().createFarm('  新農園  ');

    expect(result).toEqual({ ok: true, farmId: FARM_NEW });
    expect(rpcMock).toHaveBeenCalledWith('create_farm', { p_farm_name: '新農園' });
    expect(useFarmStore.getState().farms.map((f) => f.id)).toEqual([FARM_A, FARM_NEW]);
    expect(useFarmStore.getState().activeFarmId).toBe(FARM_NEW);
  });

  it('createFarm は空の農園名なら RPC を呼ばずにエラーを返す', async () => {
    const result = await useFarmStore.getState().createFarm('   ');

    expect(result).toEqual({ ok: false, message: '農園名を入力してください' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('createFarm は RPC エラーをメッセージとして返し、表示中の農園を変えない', async () => {
    useFarmStore.setState({ farms: [{ id: FARM_A, name: '太陽農園' }], activeFarmId: FARM_A });
    mockRpc({
      create_farm: () => ({ data: null, error: { message: 'Only teachers can create farms' } }),
    });

    const result = await useFarmStore.getState().createFarm('新農園');

    expect(result.ok).toBe(false);
    expect(useFarmStore.getState().activeFarmId).toBe(FARM_A);
  });
});
