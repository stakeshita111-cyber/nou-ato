// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { saveLocationToDBAndStorage, useWeatherLive } from '@/components/ui/weather/useWeatherLive';
import { useFarmStore } from '@/store/useFarmStore';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

const FARM_1 = '11111111-1111-4111-8111-111111111111';
const FARM_2 = '22222222-2222-4222-8222-222222222222';
const TEACHER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STUDENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function WeatherHarness() {
  const { municipalityName } = useWeatherLive();
  return <div data-testid="municipality">{municipalityName}</div>;
}

describe('useWeatherLive - 複数農園での気象地点の保存・読込 (B-6)', () => {
  let updatedFarmIds: string[] = [];
  let queriedFarmIds: string[] = [];
  let userRow: { farm_id: string | null; role: string } | null = null;
  let farmsById: Record<string, { address: string; latitude: number; longitude: number }> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    updatedFarmIds = [];
    queriedFarmIds = [];
    userRow = { farm_id: FARM_1, role: 'teacher' };
    farmsById = {
      [FARM_1]: { address: '千葉県柏市', latitude: 35.86, longitude: 139.97 },
      [FARM_2]: { address: '長野県松本市', latitude: 36.23, longitude: 137.97 },
    };

    useFarmStore.setState({
      farms: [
        { id: FARM_1, name: '第1農園' },
        { id: FARM_2, name: '第2農園' },
      ],
      activeFarmId: FARM_2,
      activeFarmName: '第2農園',
    });

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: TEACHER_ID } },
      error: null,
    } as never);

    vi.mocked(supabase.from).mockImplementation(((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: userRow, error: null }),
            }),
          }),
        };
      }
      if (table === 'farms') {
        return {
          update: () => ({
            eq: async (_col: string, id: string) => {
              updatedFarmIds.push(id);
              return { error: null };
            },
          }),
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => {
                queriedFarmIds.push(id);
                return { data: farmsById[id] ?? null, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }) as never);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({}), { status: 500 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('講師が地点を保存するとき、users.farm_id ではなく表示中の activeFarmId の農園を更新する', async () => {
    await saveLocationToDBAndStorage('長野県松本市', 36.23, 137.97);

    expect(updatedFarmIds).toEqual([FARM_2]);
  });

  it('activeFarmId が未設定のときは講師の users.farm_id にフォールバックして更新する', async () => {
    useFarmStore.setState({ activeFarmId: '', activeFarmName: '' });

    await saveLocationToDBAndStorage('千葉県柏市', 35.86, 139.97);

    expect(updatedFarmIds).toEqual([FARM_1]);
  });

  it('講師が気象地点を読み込むとき activeFarmId の農園を参照し、農園切り替えイベントで再読込する', async () => {
    render(<WeatherHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('municipality').textContent).toBe('長野県松本市');
    });
    expect(queriedFarmIds).toEqual([FARM_2]);

    useFarmStore.setState({ activeFarmId: FARM_1, activeFarmName: '第1農園' });
    window.dispatchEvent(
      new CustomEvent('nouato_active_farm_changed', {
        detail: { farmId: FARM_1, farmName: '第1農園' },
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('municipality').textContent).toBe('千葉県柏市');
    });
    expect(queriedFarmIds).toEqual([FARM_2, FARM_1]);
  });

  it('生徒は activeFarmId に関わらず自分の users.farm_id の農園の地点を読み込む', async () => {
    userRow = { farm_id: FARM_1, role: 'student' };
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: STUDENT_ID } },
      error: null,
    } as never);

    render(<WeatherHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('municipality').textContent).toBe('千葉県柏市');
    });
    expect(queriedFarmIds).toEqual([FARM_1]);
  });
});
