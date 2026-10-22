'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';

/**
 * タブ状態とURLクエリパラメータ（?tab=...）を双方向同期するカスタムフック
 * @param validTabs 有効なタブIDの一覧
 * @param defaultTab 初期・フォールバックタブ
 * @param paramKey クエリパラメータのキー名（デフォルト: 'tab'）
 */
export function useUrlTabState<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
  paramKey: string = 'tab'
): [T, (nextTab: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const resolveTab = useCallback(
    (paramValue: string | null | undefined): T => {
      if (paramValue && validTabs.includes(paramValue as T)) {
        return paramValue as T;
      }
      return defaultTab;
    },
    [validTabs, defaultTab]
  );

  const initialTab = useMemo(() => {
    const currentParam = searchParams?.get(paramKey);
    return resolveTab(currentParam);
  }, [searchParams, paramKey, resolveTab]);

  const [activeTab, setActiveTabState] = useState<T>(initialTab);
  const prevSearchParamRef = useRef<string | null>(searchParams?.get(paramKey) ?? null);
  const pendingTabRef = useRef<T | null>(null);

  useEffect(() => {
    const currentParam = searchParams?.get(paramKey) ?? null;
    if (pendingTabRef.current !== null) {
      const expectedParam = pendingTabRef.current === defaultTab ? null : pendingTabRef.current;
      if (currentParam === expectedParam) {
        pendingTabRef.current = null;
      } else {
        return;
      }
    }

    if (currentParam !== prevSearchParamRef.current) {
      prevSearchParamRef.current = currentParam;
      setActiveTabState(resolveTab(currentParam));
    }
  }, [searchParams, paramKey, resolveTab, defaultTab]);

  const setTab = useCallback(
    (nextTab: T) => {
      pendingTabRef.current = nextTab;
      setActiveTabState(nextTab);
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (nextTab === defaultTab) {
        params.delete(paramKey);
      } else {
        params.set(paramKey, nextTab);
      }
      const queryString = params.toString();
      const nextUrl = queryString ? `${pathname || '/'}?${queryString}` : pathname || '/';
      router.replace(nextUrl, { scroll: false });
    },
    [searchParams, defaultTab, paramKey, pathname, router]
  );

  return [activeTab, setTab];
}
