import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

export interface FarmItem {
  id: string;
  name: string;
  invite_code?: string | null;
}

// list_my_farms (farm_members で講師として所属している農園) の戻り値
const myFarmsSchema = z.array(
  z.object({
    farm_id: z.string().uuid(),
    name: z.string(),
    invite_code: z.string().nullable(),
  })
);

// create_farm の戻り値
const createFarmResultSchema = z.object({
  success: z.literal(true),
  farm_id: z.string().uuid(),
  farm_name: z.string(),
});

export type CreateFarmResult = { ok: true; farmId: string } | { ok: false; message: string };

// 2つ目以降の農園の作成を画面から許可するか (create_farm RPC)
export function isMultiFarmEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MULTI_FARM_ENABLED === 'true';
}

interface FarmStoreState {
  farms: FarmItem[];
  activeFarmId: string;
  activeFarmName: string;
  isLoading: boolean;
  loadError: string | null;
  setFarms: (farms: FarmItem[]) => void;
  setActiveFarmId: (farmId: string) => void;
  fetchTeacherFarms: () => Promise<FarmItem[]>;
  createFarm: (farmName: string) => Promise<CreateFarmResult>;
}

export const useFarmStore = create<FarmStoreState>()(
  persist(
    (set, get) => ({
      farms: [],
      activeFarmId: '',
      activeFarmName: '',
      isLoading: true,
      loadError: null,

      setFarms: (farms) => set({ farms }),

      setActiveFarmId: (farmId: string) => {
        const farm = get().farms.find((f) => f.id === farmId);
        // 所属していない農園には切り替えない
        if (!farm) return;
        const farmName = farm.name || '農園';
        set({ activeFarmId: farmId, activeFarmName: farmName });

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('nouato_active_farm_id', farmId);
            localStorage.setItem('nouato_current_farm_name', farmName);
            window.dispatchEvent(
              new CustomEvent('nouato_active_farm_changed', { detail: { farmId, farmName } })
            );
            const bc = new BroadcastChannel('nouato_farm_sync_channel');
            bc.postMessage({ type: 'FARM_SWITCHED', farmId, farmName });
            bc.close();
          } catch {}
        }
      },

      fetchTeacherFarms: async () => {
        set({ isLoading: true, loadError: null });
        try {
          const { data, error } = await supabase.rpc('list_my_farms');
          if (error) {
            set({ isLoading: false, loadError: '農園一覧の取得に失敗しました' });
            return get().farms;
          }
          const parsed = myFarmsSchema.safeParse(data);
          if (!parsed.success) {
            set({ isLoading: false, loadError: '農園一覧の形式が不正です' });
            return get().farms;
          }
          const farmList: FarmItem[] = parsed.data.map((f) => ({
            id: f.farm_id,
            name: f.name,
            invite_code: f.invite_code,
          }));

          // 保持中の activeFarmId は、所属農園の一覧に含まれる場合だけ引き継ぐ
          const targetFarm = farmList.find((f) => f.id === get().activeFarmId) ?? farmList[0];

          set({
            farms: farmList,
            activeFarmId: targetFarm?.id ?? '',
            activeFarmName: targetFarm?.name ?? '',
            isLoading: false,
          });

          if (typeof window !== 'undefined') {
            try {
              if (targetFarm) {
                localStorage.setItem('nouato_active_farm_id', targetFarm.id);
                localStorage.setItem('nouato_current_farm_name', targetFarm.name);
              } else {
                localStorage.removeItem('nouato_active_farm_id');
                localStorage.removeItem('nouato_current_farm_name');
              }
            } catch {}
          }

          return farmList;
        } catch (err) {
          console.error('fetchTeacherFarms error:', err);
          set({ isLoading: false, loadError: '農園一覧の取得に失敗しました' });
          return get().farms;
        }
      },

      createFarm: async (farmName: string) => {
        const name = farmName.trim();
        if (!name) return { ok: false, message: '農園名を入力してください' };
        if (name.length > 255)
          return { ok: false, message: '農園名は255文字以内で入力してください' };

        const { data, error } = await supabase.rpc('create_farm', { p_farm_name: name });
        if (error) {
          return { ok: false, message: `農園の作成に失敗しました: ${error.message}` };
        }
        const parsed = createFarmResultSchema.safeParse(data);
        if (!parsed.success) {
          return { ok: false, message: '農園の作成結果の形式が不正です' };
        }

        await get().fetchTeacherFarms();
        get().setActiveFarmId(parsed.data.farm_id);
        return { ok: true, farmId: parsed.data.farm_id };
      },
    }),
    {
      name: 'nouato_farm_store',
      partialize: (state) => ({
        activeFarmId: state.activeFarmId,
        activeFarmName: state.activeFarmName,
      }),
    }
  )
);
