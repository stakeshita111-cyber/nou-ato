import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getJstDateString,
  getTicketState,
  parseTicketStatus,
  addQuestionStock,
  getQuestionStock,
  clearQuestionStock,
  formatStockText,
  DEFAULT_DAILY_TICKETS,
} from '@/lib/ticketManager';

describe('ticketManager', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    for (const key in mockStorage) delete mockStorage[key];
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        for (const k in mockStorage) delete mockStorage[k];
      },
    });
  });

  it('returns JST date string in YYYY-MM-DD format', () => {
    expect(getJstDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns default limited state without persisting to localStorage', () => {
    const state = getTicketState();
    expect(state.count).toBe(DEFAULT_DAILY_TICKETS);
    expect(state.plan).toBe('limited');
    expect(state.isUnlimited).toBe(false);
    expect(Object.keys(mockStorage)).toHaveLength(0);
  });

  it('supports unlimited plan', () => {
    const state = getTicketState(3, 'unlimited');
    expect(state.count).toBe(999);
    expect(state.isUnlimited).toBe(true);
  });

  it('supports memo_only plan', () => {
    const state = getTicketState(3, 'memo_only');
    expect(state.count).toBe(0);
    expect(state.plan).toBe('memo_only');
  });

  it('parses get_ai_ticket_status RPC payload (3 + granted 1 = limit 4, used 3 -> remaining 1)', () => {
    const state = parseTicketStatus({
      date: '2026-10-10',
      daily_limit: 4,
      used: 3,
      remaining: 1,
    });
    expect(state).not.toBeNull();
    expect(state?.count).toBe(1);
    expect(state?.dailyLimit).toBe(4);
  });

  it('returns null for malformed RPC payloads instead of faking success', () => {
    expect(parseTicketStatus(null)).toBeNull();
    expect(parseTicketStatus([])).toBeNull();
    expect(parseTicketStatus({ date: '2026-10-10' })).toBeNull();
    expect(parseTicketStatus({ date: 1, daily_limit: 3, remaining: 3 })).toBeNull();
  });

  it('manages question stocks correctly (add, get, clear, format)', () => {
    addQuestionStock('user1', 'ナスに虫がついた');
    addQuestionStock('user1', '追肥はいつ？');

    const stocks = getQuestionStock('user1');
    expect(stocks).toHaveLength(2);
    expect(stocks[0]).toBe('ナスに虫がついた');

    const formatted = formatStockText(stocks);
    expect(formatted).toBe('・ナスに虫がついた\n・追肥はいつ？');

    clearQuestionStock('user1');
    expect(getQuestionStock('user1')).toHaveLength(0);
    expect(formatStockText([])).toBe('');
  });
});
