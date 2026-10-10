import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getJstDateString,
  getTicketState,
  consumeTicket,
  grantTicket,
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
    const d = getJstDateString();
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('initializes default ticket state with 3 tickets', () => {
    const state = getTicketState('user1');
    expect(state.count).toBe(DEFAULT_DAILY_TICKETS);
    expect(state.plan).toBe('limited');
    expect(state.isUnlimited).toBe(false);
  });

  it('supports unlimited plan', () => {
    const state = getTicketState('user1', 3, 'unlimited');
    expect(state.count).toBe(999);
    expect(state.isUnlimited).toBe(true);
  });

  it('supports memo_only plan', () => {
    const state = getTicketState('user1', 3, 'memo_only');
    expect(state.count).toBe(0);
    expect(state.plan).toBe('memo_only');
  });

  it('consumes ticket correctly', () => {
    const res1 = consumeTicket('user1');
    expect(res1.count).toBe(2);

    const res2 = consumeTicket('user1');
    expect(res2.count).toBe(1);

    const res3 = consumeTicket('user1');
    expect(res3.count).toBe(0);

    const res4 = consumeTicket('user1');
    expect(res4.count).toBe(0);
  });

  it('grants ticket correctly to a student', () => {
    consumeTicket('user1');
    consumeTicket('user1');
    consumeTicket('user1');
    expect(getTicketState('user1').count).toBe(0);

    const granted = grantTicket('user1', 1);
    expect(granted.count).toBe(1);

    const grantedAgain = grantTicket('user1', 2);
    expect(grantedAgain.count).toBe(3);
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
