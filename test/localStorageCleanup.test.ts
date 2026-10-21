// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { clearNouatoSessionStorage } from '../lib/localStorageCleanup';

describe('clearNouatoSessionStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears all localStorage items with nouato_ prefix and preserves other keys', () => {
    // Set up test keys in localStorage
    localStorage.setItem('nouato_active_farm_id', 'farm_123');
    localStorage.setItem('nouato_owner_name', '山田太郎');
    localStorage.setItem('nouato_read_broadcast_ids', JSON.stringify(['id_1', 'id_2']));
    localStorage.setItem('nouato_show_student_talk_tab', 'true');
    localStorage.setItem('other_app_key', 'should_remain');

    expect(localStorage.getItem('nouato_active_farm_id')).toBe('farm_123');
    expect(localStorage.getItem('nouato_owner_name')).toBe('山田太郎');
    expect(localStorage.getItem('nouato_read_broadcast_ids')).toBe(
      JSON.stringify(['id_1', 'id_2'])
    );
    expect(localStorage.getItem('other_app_key')).toBe('should_remain');

    // Execute cleanup
    clearNouatoSessionStorage();

    // Verify nouato_ prefixed items are removed
    expect(localStorage.getItem('nouato_active_farm_id')).toBeNull();
    expect(localStorage.getItem('nouato_owner_name')).toBeNull();
    expect(localStorage.getItem('nouato_read_broadcast_ids')).toBeNull();
    expect(localStorage.getItem('nouato_show_student_talk_tab')).toBeNull();

    // Verify non-nouato_ key remains intact
    expect(localStorage.getItem('other_app_key')).toBe('should_remain');
  });

  it('handles empty localStorage gracefully without errors', () => {
    expect(() => clearNouatoSessionStorage()).not.toThrow();
  });
});
