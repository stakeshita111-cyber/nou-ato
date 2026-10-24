// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import TeacherSettingsView from '@/components/teacher/TeacherSettingsView';
import { useFarmStore } from '@/store/useFarmStore';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn(), auth: { getUser: vi.fn() } },
}));

const FARM_ID = '11111111-1111-4111-8111-111111111111';

// 「相談・質問機能（Talk）の表示」行の OFF ボタン (他の設定行にも同名のボタンがある)
function clickTalkTabOff() {
  const label = screen.getByText('💬 生徒画面: 相談・質問機能（Talk）の表示');
  const row = label.closest('div')?.parentElement;
  if (!row) throw new Error('Talk 設定行が見つかりません');
  fireEvent.click(within(row).getByText('非表示 (OFF)'));
}

type FetchCall = { url: string; method: string; body: unknown };

describe('TeacherSettingsView - 表示中の農園の設定を読み書きする', () => {
  let calls: FetchCall[] = [];
  let postOk = true;

  beforeEach(() => {
    calls = [];
    postOk = true;
    useFarmStore.setState({
      farms: [{ id: FARM_ID, name: '太陽農園' }],
      activeFarmId: FARM_ID,
      activeFarmName: '太陽農園',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
        calls.push({ url: input, method, body });
        if (method === 'POST') {
          return new Response(JSON.stringify({ success: postOk }), { status: postOk ? 200 : 403 });
        }
        return new Response(JSON.stringify({ showStudentTalkTab: true }), { status: 200 });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GET は表示中の農園の farm_id を指定する', async () => {
    render(<TeacherSettingsView />);

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0]).toMatchObject({
      url: `/api/settings?farm_id=${FARM_ID}`,
      method: 'GET',
    });
  });

  it('相談タブの表示切り替えは、表示中の農園の farmId を付けて保存する', async () => {
    render(<TeacherSettingsView />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));

    clickTalkTabOff();

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      showStudentTalkTab: false,
      farmId: FARM_ID,
    });
  });

  it('保存に失敗したらエラーのトーストを表示する', async () => {
    postOk = false;
    render(<TeacherSettingsView />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));

    clickTalkTabOff();

    await waitFor(() => {
      expect(screen.getByText('⚠️ 相談画面の表示設定の保存に失敗しました')).toBeDefined();
    });
  });
});
