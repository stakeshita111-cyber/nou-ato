// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useFarmStore } from '@/store/useFarmStore';

type Recorded = { path: string; method: string; body: unknown };

// 実際の supabase-js クライアントの fetch だけを差し替え、発行された REST / RPC リクエストを記録する
const net = vi.hoisted(() => ({
  recorded: [] as { path: string; method: string; body: unknown }[],
  replies: {} as Record<string, { status: number; body: unknown }>,
}));

vi.mock('@/lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const path = url.pathname.replace('/rest/v1/', '');
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    net.recorded.push({ path, method: init?.method ?? 'GET', body });
    const reply = net.replies[path] ?? { status: 200, body: [] };
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return {
    supabase: createClient('http://localhost:54321', 'anon-key', {
      global: { fetch: fetchImpl },
      auth: { persistSession: false },
    }),
  };
});

import FarmMembersSection from '@/components/teacher/FarmMembersSection';

const FARM_ID = '11111111-1111-4111-8111-111111111111';
const ME = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000004';
const TOKEN = 'a'.repeat(48);

function setMembers(members: Array<{ id: string; name: string; self: boolean }>) {
  net.replies['rpc/list_farm_members'] = {
    status: 200,
    body: members.map((m) => ({
      user_id: m.id,
      display_name: m.name,
      joined_at: '2026-10-01T00:00:00Z',
      is_self: m.self,
    })),
  };
}

function rpcCalls(name: string): Recorded[] {
  return net.recorded.filter((r) => r.path === `rpc/${name}`);
}

describe('FarmMembersSection - 講師メンバー管理', () => {
  const fetchTeacherFarms = vi.fn(async () => []);

  beforeEach(() => {
    net.recorded = [];
    net.replies = {};
    fetchTeacherFarms.mockClear();
    useFarmStore.setState({
      farms: [{ id: FARM_ID, name: '太陽農園' }],
      activeFarmId: FARM_ID,
      activeFarmName: '太陽農園',
      fetchTeacherFarms,
    });
    setMembers([
      { id: ME, name: '講師A', self: true },
      { id: OTHER, name: '講師B', self: false },
    ]);
  });

  it('表示中の農園の講師一覧と未使用の招待を表示する', async () => {
    net.replies['farm_invitations'] = {
      status: 200,
      body: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          created_at: '2026-10-20T00:00:00Z',
          expires_at: '2026-10-27T00:00:00Z',
        },
      ],
    };
    render(<FarmMembersSection />);

    expect(await screen.findByText('講師B')).toBeDefined();
    expect(rpcCalls('list_farm_members')[0].body).toEqual({ p_farm_id: FARM_ID });
    expect(screen.getByText('未使用の招待リンク')).toBeDefined();
    expect(screen.getByText('この農園から抜ける')).toBeDefined();
  });

  it('招待リンクを発行すると、トークン付きのリンクを表示する', async () => {
    net.replies['rpc/create_farm_invitation'] = {
      status: 200,
      body: {
        invitation_id: '33333333-3333-4333-8333-333333333333',
        token: TOKEN,
        expires_at: '2026-10-31T00:00:00Z',
      },
    };
    render(<FarmMembersSection />);
    await screen.findByText('講師B');

    fireEvent.click(screen.getByText('＋ 講師を招待するリンクを発行'));

    const input = await screen.findByLabelText<HTMLInputElement>('招待リンク');
    expect(input.value).toBe(`${window.location.origin}/invite/teacher?token=${TOKEN}`);
    expect(rpcCalls('create_farm_invitation')[0].body).toEqual({ p_farm_id: FARM_ID });
  });

  it('招待の発行が拒否されたら日本語のエラーを表示する', async () => {
    net.replies['rpc/create_farm_invitation'] = {
      status: 403,
      body: { code: '42501', message: 'Forbidden: only teachers of this farm can invite' },
    };
    render(<FarmMembersSection />);
    await screen.findByText('講師B');

    fireEvent.click(screen.getByText('＋ 講師を招待するリンクを発行'));

    expect(await screen.findByText('⚠️ この農園の講師だけが操作できます')).toBeDefined();
  });

  it('確認のうえ他の講師を外し、一覧を取り直す', async () => {
    render(<FarmMembersSection />);
    await screen.findByText('講師B');

    fireEvent.click(screen.getByText('外す'));
    expect(screen.getByText('講師B さんを外しますか？')).toBeDefined();
    setMembers([{ id: ME, name: '講師A', self: true }]);
    fireEvent.click(screen.getAllByText('外す').at(-1) as HTMLElement);

    await waitFor(() => expect(screen.queryByText('講師B')).toBeNull());
    expect(rpcCalls('remove_farm_member')[0].body).toEqual({
      p_farm_id: FARM_ID,
      p_user_id: OTHER,
    });
    expect(rpcCalls('list_farm_members').length).toBe(2);
    expect(fetchTeacherFarms).not.toHaveBeenCalled();
  });

  it('自分が抜けたら所属農園の一覧を取り直す', async () => {
    render(<FarmMembersSection />);
    await screen.findByText('講師B');

    fireEvent.click(screen.getByText('この農園から抜ける'));
    fireEvent.click(screen.getByText('抜ける'));

    await waitFor(() => expect(fetchTeacherFarms).toHaveBeenCalled());
    expect(rpcCalls('remove_farm_member')[0].body).toEqual({ p_farm_id: FARM_ID, p_user_id: ME });
  });

  it('最後の講師を外す操作が拒否されたら理由を表示する', async () => {
    net.replies['rpc/remove_farm_member'] = {
      status: 403,
      body: { code: '42501', message: 'Cannot remove the last teacher of a farm' },
    };
    render(<FarmMembersSection />);
    await screen.findByText('講師B');

    fireEvent.click(screen.getByText('外す'));
    fireEvent.click(screen.getAllByText('外す').at(-1) as HTMLElement);

    expect(await screen.findByText('⚠️ 農園の最後の講師は外せません')).toBeDefined();
  });

  it('講師が 1 人だけなら抜けるボタンを無効にする', async () => {
    setMembers([{ id: ME, name: '講師A', self: true }]);
    render(<FarmMembersSection />);

    const button = await screen.findByText<HTMLButtonElement>('この農園から抜ける');
    expect(button.disabled).toBe(true);
  });

  it('招待を取り消すと revoke_farm_invitation を呼ぶ', async () => {
    const invitationId = '22222222-2222-4222-8222-222222222222';
    net.replies['farm_invitations'] = {
      status: 200,
      body: [
        {
          id: invitationId,
          created_at: '2026-10-20T00:00:00Z',
          expires_at: '2026-10-27T00:00:00Z',
        },
      ],
    };
    net.replies['rpc/revoke_farm_invitation'] = { status: 200, body: { success: true } };
    render(<FarmMembersSection />);

    fireEvent.click(await screen.findByText('取り消す'));

    await screen.findByText('🗑️ 招待を取り消しました');
    expect(rpcCalls('revoke_farm_invitation')[0].body).toEqual({ p_invitation_id: invitationId });
  });

  it('講師一覧の取得が拒否されたらエラーを表示する', async () => {
    net.replies['rpc/list_farm_members'] = {
      status: 403,
      body: { code: '42501', message: 'Forbidden: only teachers of this farm can list members' },
    };
    render(<FarmMembersSection />);

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByText('⚠️ この農園の講師だけが操作できます')).toBeDefined();
  });

  it('表示中の農園が無ければ何も表示しない', () => {
    useFarmStore.setState({ farms: [], activeFarmId: '' });
    const { container } = render(<FarmMembersSection />);

    expect(container.innerHTML).toBe('');
    expect(net.recorded).toEqual([]);
  });
});
