import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

export interface FarmItem {
  id: string;
  name: string;
  owner_id?: string | null;
  created_at?: string;
}

interface FarmStoreState {
  farms: FarmItem[];
  activeFarmId: string;
  activeFarmName: string;
  isLoading: boolean;
  setFarms: (farms: FarmItem[]) => void;
  setActiveFarmId: (farmId: string) => void;
  fetchTeacherFarms: () => Promise<FarmItem[]>;
}

export const useFarmStore = create<FarmStoreState>()(
  persist(
    (set, get) => ({
      farms: [],
      activeFarmId: '',
      activeFarmName: '',
      isLoading: true,

      setFarms: (farms) => set({ farms }),

      setActiveFarmId: (farmId: string) => {
        const farm = get().farms.find((f) => f.id === farmId);
        const farmName = farm?.name || '農園';
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
        set({ isLoading: true });
        try {
          const { data: authData } = await supabase.auth.getUser();
          const currentUserId = authData?.user?.id;
          let teacherFarmId: string | null = null;

          if (currentUserId) {
            const { data: uData } = await supabase
              .from('users')
              .select('farm_id')
              .eq('id', currentUserId)
              .maybeSingle();

            if (uData?.farm_id) {
              teacherFarmId = uData.farm_id;
            }
          }

          let farmsQuery = supabase.from('farms').select('*');
          if (currentUserId) {
            if (teacherFarmId) {
              farmsQuery = farmsQuery.or(`owner_id.eq.${currentUserId},id.eq.${teacherFarmId}`);
            } else {
              farmsQuery = farmsQuery.eq('owner_id', currentUserId);
            }
          }

          const { data: dbFarms } = await farmsQuery.order('created_at', { ascending: true });
          const farmList: FarmItem[] = dbFarms && dbFarms.length > 0 ? dbFarms : [];

          // 保持中の activeFarmId が有効かチェック
          let targetFarmId = get().activeFarmId;
          let targetFarm = farmList.find((f) => f.id === targetFarmId);

          if (!targetFarm && farmList.length > 0) {
            targetFarm = farmList[0];
            targetFarmId = targetFarm.id;
          }

          set({
            farms: farmList,
            activeFarmId: targetFarmId || farmList[0]?.id || '',
            activeFarmName: targetFarm?.name || farmList[0]?.name || '農園',
            isLoading: false,
          });

          if (targetFarm) {
            try {
              localStorage.setItem('nouato_active_farm_id', targetFarm.id);
              localStorage.setItem('nouato_current_farm_name', targetFarm.name);
            } catch {}
          }

          return farmList;
        } catch (err) {
          console.error('fetchTeacherFarms error:', err);
          set({ isLoading: false });
          return [];
        }
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
