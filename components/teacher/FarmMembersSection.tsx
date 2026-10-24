'use client';

import { useCallback, useEffect, useState } from 'react';
import Toast from '@/components/ui/Toast';
import { useFarmStore } from '@/store/useFarmStore';
import { formatDate } from '@/lib/utils/formatHelper';
import {
  buildTeacherInviteUrl,
  createFarmInvitation,
  listFarmMembers,
  listPendingInvitations,
  removeFarmMember,
  revokeFarmInvitation,
  type FarmMember,
  type PendingInvitation,
} from '@/lib/farm/farmMembersApi';

// 表示中の農園の講師メンバー管理 (招待リンクの発行・取り消し、講師を外す)
// 講師は全員同じ権限で、誰でも招待・他の講師を外せる (最後の 1 人は外せない)
export default function FarmMembersSection() {
  const { activeFarmId, activeFarmName, fetchTeacherFarms } = useFarmStore();

  const [members, setMembers] = useState<FarmMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<FarmMember | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const notify = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  const reload = useCallback(async () => {
    if (!activeFarmId) return;
    try {
      const [memberResult, invitationResult] = await Promise.all([
        listFarmMembers(activeFarmId),
        listPendingInvitations(activeFarmId),
      ]);
      if (!memberResult.ok) {
        setLoadError(memberResult.message);
        return;
      }
      setLoadError(invitationResult.ok ? null : invitationResult.message);
      setMembers(memberResult.data);
      setInvitations(invitationResult.ok ? invitationResult.data : []);
    } catch (err) {
      console.error('FarmMembersSection reload error:', err);
      setLoadError('講師一覧の取得に失敗しました');
    }
  }, [activeFarmId]);

  useEffect(() => {
    const load = async () => {
      await reload();
    };
    load().catch((err: unknown) => {
      console.error('FarmMembersSection load error:', err);
    });
  }, [reload]);

  const handleCreateInvitation = async () => {
    if (!activeFarmId) return;
    setIsBusy(true);
    try {
      const result = await createFarmInvitation(activeFarmId);
      if (!result.ok) {
        notify(`⚠️ ${result.message}`);
        return;
      }
      setInviteUrl(buildTeacherInviteUrl(window.location.origin, result.data.token));
      await reload();
    } catch (err) {
      console.error('createFarmInvitation error:', err);
      notify('⚠️ 招待リンクの発行に失敗しました');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyInviteUrl = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      notify('📋 招待リンクをコピーしました');
    } catch {
      notify('⚠️ コピーできませんでした。リンクを選択してコピーしてください');
    }
  };

  const handleRevoke = async (invitationId: string) => {
    setIsBusy(true);
    try {
      const result = await revokeFarmInvitation(invitationId);
      if (!result.ok) {
        notify(`⚠️ ${result.message}`);
        return;
      }
      notify('🗑️ 招待を取り消しました');
      await reload();
    } catch (err) {
      console.error('revokeFarmInvitation error:', err);
      notify('⚠️ 招待の取り消しに失敗しました');
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmRemoval = async () => {
    if (!activeFarmId || !pendingRemoval) return;
    const target = pendingRemoval;
    setIsBusy(true);
    try {
      const result = await removeFarmMember(activeFarmId, target.user_id);
      if (!result.ok) {
        notify(`⚠️ ${result.message}`);
        return;
      }
      setPendingRemoval(null);
      if (target.is_self) {
        // 自分が抜けた農園は操作できなくなるため、所属農園の一覧を取り直す
        notify(`🚪 「${activeFarmName || '農園'}」から抜けました`);
        await fetchTeacherFarms();
        return;
      }
      notify(`👋 ${target.display_name} さんを農園から外しました`);
      await reload();
    } catch (err) {
      console.error('removeFarmMember error:', err);
      notify('⚠️ 講師を外せませんでした');
    } finally {
      setIsBusy(false);
    }
  };

  if (!activeFarmId) return null;

  return (
    <section
      aria-labelledby="farm-members-title"
      className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden"
    >
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
        <h3 id="farm-members-title" className="font-black text-sm text-gray-900">
          👥 講師メンバー（{activeFarmName || '農園'}）
        </h3>
        <button
          type="button"
          onClick={() => void handleCreateInvitation()}
          disabled={isBusy}
          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
        >
          ＋ 講師を招待するリンクを発行
        </button>
      </div>

      <div className="p-4 space-y-4 text-xs">
        <p className="text-gray-500 font-medium">
          講師は全員同じ権限で、この農園のすべての操作ができます。招待リンクは 1 回だけ使え、7
          日で期限が切れます。
        </p>

        {loadError && (
          <p role="alert" className="text-red-600 font-bold">
            ⚠️ {loadError}
          </p>
        )}

        {inviteUrl && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3 space-y-2">
            <p className="font-black text-emerald-900">
              招待リンクを発行しました。このリンクは今だけ表示されます。
            </p>
            <input
              readOnly
              value={inviteUrl}
              aria-label="招待リンク"
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 font-mono text-[11px]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleCopyInviteUrl()}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-black cursor-pointer"
              >
                コピー
              </button>
              <button
                type="button"
                onClick={() => setInviteUrl(null)}
                className="px-3 py-1.5 rounded-xl border border-gray-200 font-bold text-gray-700 cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-2 p-3">
              <div>
                <span className="font-black text-gray-900">
                  {m.display_name}
                  {m.is_self && <span className="ml-1 text-emerald-700">（あなた）</span>}
                </span>
                <span className="block text-[11px] text-gray-500">
                  {formatDate(m.joined_at)} から所属
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPendingRemoval(m)}
                disabled={isBusy || members.length <= 1}
                title={members.length <= 1 ? '最後の講師は外せません' : undefined}
                className="px-3 py-1.5 rounded-xl border border-red-200 text-red-700 font-bold hover:bg-red-50 disabled:opacity-40 cursor-pointer"
              >
                {m.is_self ? 'この農園から抜ける' : '外す'}
              </button>
            </li>
          ))}
        </ul>

        {invitations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-black text-gray-700">未使用の招待リンク</h4>
            <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 p-3">
                  <span className="text-gray-600">
                    {formatDate(inv.created_at)} 発行・{formatDate(inv.expires_at)} まで有効
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleRevoke(inv.id)}
                    disabled={isBusy}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 cursor-pointer"
                  >
                    取り消す
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {pendingRemoval && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-member-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl space-y-4 text-xs">
            <h4 id="remove-member-title" className="text-sm font-black text-gray-900">
              {pendingRemoval.is_self
                ? `「${activeFarmName || '農園'}」から抜けますか？`
                : `${pendingRemoval.display_name} さんを外しますか？`}
            </h4>
            <p className="text-gray-600">
              {pendingRemoval.is_self
                ? '抜けると、この農園の画面やデータを操作できなくなります。戻るには、他の講師から再度招待を受けてください。'
                : '外すと、この講師はこの農園の画面やデータを操作できなくなります。'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                disabled={isBusy}
                className="px-3 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRemoval()}
                disabled={isBusy}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black cursor-pointer"
              >
                {pendingRemoval.is_self ? '抜ける' : '外す'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
