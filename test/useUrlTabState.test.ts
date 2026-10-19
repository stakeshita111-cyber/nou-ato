// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUrlTabState } from '../hooks/useUrlTabState';
import * as nextNavigation from 'next/navigation';

describe('useUrlTabState', () => {
  const mockReplace = vi.fn();
  let mockSearchParams = new URLSearchParams();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();

    vi.spyOn(nextNavigation, 'useRouter').mockReturnValue({
      push: vi.fn(),
      replace: mockReplace,
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      bfcacheId: 'test-bfcache-id',
    });

    vi.spyOn(nextNavigation, 'usePathname').mockReturnValue('/teacher/dashboard');
    vi.spyOn(nextNavigation, 'useSearchParams').mockImplementation(
      () => new nextNavigation.ReadonlyURLSearchParams(mockSearchParams)
    );
  });

  const validTabs = ['dashboard', 'farm', 'tasks'] as const;

  it('initializes with defaultTab when searchParams has no tab query', () => {
    const { result } = renderHook(() => useUrlTabState(validTabs, 'dashboard'));
    expect(result.current[0]).toBe('dashboard');
  });

  it('initializes with tab from searchParams if valid', () => {
    mockSearchParams.set('tab', 'farm');
    const { result } = renderHook(() => useUrlTabState(validTabs, 'dashboard'));
    expect(result.current[0]).toBe('farm');
  });

  it('falls back to defaultTab if searchParams has invalid tab', () => {
    mockSearchParams.set('tab', 'invalid_tab');
    const { result } = renderHook(() => useUrlTabState(validTabs, 'dashboard'));
    expect(result.current[0]).toBe('dashboard');
  });

  it('updates tab state and calls router.replace with new tab param', () => {
    const { result } = renderHook(() => useUrlTabState(validTabs, 'dashboard'));

    act(() => {
      result.current[1]('tasks');
    });

    expect(result.current[0]).toBe('tasks');
    expect(mockReplace).toHaveBeenCalledWith('/teacher/dashboard?tab=tasks', { scroll: false });
  });

  it('removes tab param when transitioning back to defaultTab', () => {
    mockSearchParams.set('tab', 'farm');
    const { result } = renderHook(() => useUrlTabState(validTabs, 'dashboard'));

    act(() => {
      result.current[1]('dashboard');
    });

    expect(result.current[0]).toBe('dashboard');
    expect(mockReplace).toHaveBeenCalledWith('/teacher/dashboard', { scroll: false });
  });

  it('handles null/undefined useSearchParams safely', () => {
    vi.spyOn(nextNavigation, 'useSearchParams').mockReturnValue(null!);
    const { result } = renderHook(() => useUrlTabState(validTabs, 'dashboard'));
    expect(result.current[0]).toBe('dashboard');

    act(() => {
      result.current[1]('farm');
    });
    expect(result.current[0]).toBe('farm');
    expect(mockReplace).toHaveBeenCalledWith('/teacher/dashboard?tab=farm', { scroll: false });
  });

  it('syncs active tab when searchParams change externally (browser back/forward)', () => {
    const { result, rerender } = renderHook(() => useUrlTabState(validTabs, 'dashboard'));
    expect(result.current[0]).toBe('dashboard');

    mockSearchParams.set('tab', 'tasks');
    rerender();
    expect(result.current[0]).toBe('tasks');

    mockSearchParams.delete('tab');
    rerender();
    expect(result.current[0]).toBe('dashboard');
  });
});
