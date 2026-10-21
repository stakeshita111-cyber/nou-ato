/**
 * LocalStorage Nouato Farm Session Cleanup Utility
 * Clears all localStorage cache entries with the 'nouato_' prefix upon logout or new login
 * to prevent farm session data pollution between different accounts or farms.
 */
export function clearNouatoSessionStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const keysToRemove: string[] = [];
    const storageLength = window.localStorage.length;

    for (let i = 0; i < storageLength; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('nouato_')) {
        keysToRemove.push(key);
      }
    }

    // Direct removal using keys array to avoid index shifting during iteration
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch (err) {
    console.error('Failed to clear nouato localStorage session cache:', err);
  }
}
