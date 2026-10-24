// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFarmStore } from '@/store/useFarmStore';

const mockGetUser = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mockMaybeSingle,
        })),
      })),
    })),
  },
}));

import { resolveActiveFarmId, ACTIVE_FARM_STORAGE_KEY } from '@/lib/farm/activeFarm';

const FARM_STORE_UUID = '11111111-1111-4111-8111-111111111111';
const FARM_STORAGE_UUID = '22222222-2222-4222-8222-222222222222';
const FARM_USER_UUID = '33333333-3333-4333-8333-333333333333';
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('resolveActiveFarmId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useFarmStore.setState({ farms: [], activeFarmId: '', activeFarmName: '' });
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('store に有効な UUID があれば最優先で返し、localStorage や DB を見ない', async () => {
    useFarmStore.setState({ activeFarmId: FARM_STORE_UUID });
    localStorage.setItem(ACTIVE_FARM_STORAGE_KEY, FARM_STORAGE_UUID);
    mockMaybeSingle.mockResolvedValue({ data: { farm_id: FARM_USER_UUID }, error: null });

    const result = await resolveActiveFarmId();

    expect(result).toBe(FARM_STORE_UUID);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('store が空で localStorage に有効な UUID があればそれを返し、DB を見ない', async () => {
    useFarmStore.setState({ activeFarmId: '' });
    localStorage.setItem(ACTIVE_FARM_STORAGE_KEY, FARM_STORAGE_UUID);
    mockMaybeSingle.mockResolvedValue({ data: { farm_id: FARM_USER_UUID }, error: null });

    const result = await resolveActiveFarmId();

    expect(result).toBe(FARM_STORAGE_UUID);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('store も localStorage も空のときは users.farm_id の UUID を返す', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { farm_id: FARM_USER_UUID }, error: null });

    const result = await resolveActiveFarmId();

    expect(result).toBe(FARM_USER_UUID);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it('store・localStorage・users.farm_id のすべてが無いときは null を返す', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { farm_id: null }, error: null });

    const result = await resolveActiveFarmId();

    expect(result).toBeNull();
  });

  it('不正な値（UUID でない文字列）は飛ばして次の候補へ進む', async () => {
    useFarmStore.setState({ activeFarmId: 'not-a-uuid' });
    localStorage.setItem(ACTIVE_FARM_STORAGE_KEY, 'also-invalid-id');
    mockMaybeSingle.mockResolvedValue({ data: { farm_id: FARM_USER_UUID }, error: null });

    const result = await resolveActiveFarmId();

    expect(result).toBe(FARM_USER_UUID);

    // users.farm_id も不正な値なら null になる
    mockMaybeSingle.mockResolvedValueOnce({ data: { farm_id: 'invalid-db-farm-id' }, error: null });
    expect(await resolveActiveFarmId()).toBeNull();
  });
});
