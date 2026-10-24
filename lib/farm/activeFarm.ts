import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useFarmStore } from '@/store/useFarmStore';

export const ACTIVE_FARM_STORAGE_KEY = 'nouato_active_farm_id';

const uuidSchema = z.string().uuid();

function parseUuid(value: unknown): string | null {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * 講師画面の「表示中の農園ID」を解決する。
 * 優先順位: useFarmStore.activeFarmId -> localStorage('nouato_active_farm_id') -> users.farm_id
 * 各候補は UUID 形式を zod で検証し、不正なら次の候補へ進む。
 */
export async function resolveActiveFarmId(): Promise<string | null> {
  const fromStore = parseUuid(useFarmStore.getState().activeFarmId);
  if (fromStore) {
    return fromStore;
  }

  if (typeof window !== 'undefined') {
    try {
      const fromStorage = parseUuid(localStorage.getItem(ACTIVE_FARM_STORAGE_KEY));
      if (fromStorage) {
        return fromStorage;
      }
    } catch {
      // localStorage が利用不可の環境では次の候補へ進む
    }
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('farm_id')
      .eq('id', user.id)
      .maybeSingle();

    return parseUuid(userRow?.farm_id);
  } catch {
    return null;
  }
}
