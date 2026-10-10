import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface BroadcastItem {
  id: string;
  title: string;
  content: string;
  sender?: string;
  created_at?: string;
}

export interface StudentTaskItem {
  id: string;
  task_id?: string;
  status: string;
  title?: string;
  tasks?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StudentUserItem {
  id: string;
  name?: string;
  email?: string | null;
  farm_id?: string | null;
  [key: string]: unknown;
}

export function useStudentDashboard() {
  const [tasks, setTasks] = useState<StudentTaskItem[]>([]);
  const [, setMyBeds] = useState<Record<string, unknown>[]>([]);
  const [journals, setJournals] = useState<Record<string, unknown>[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [newJournal, setNewJournal] = useState('');
  const [user, setUser] = useState<StudentUserItem | null>(null);
  const [selectedTask, setSelectedTask] = useState<StudentTaskItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeactivated, setIsDeactivated] = useState(false);

  useEffect(() => {
    let isInitial = true;
    const fetchData = async () => {
      const startTime = Date.now();
      const minDisplayTime = isInitial ? 600 : 0; // 初回ロード時のみ芽が出るアニメーションを心地よく見せる
      try {
        // 0. 一括配信 (broadcasts) を LocalStorage & DB からロード
        const savedBcStr =
          typeof window !== 'undefined'
            ? localStorage.getItem('nouato_broadcast_announcements')
            : null;
        if (savedBcStr) {
          try {
            JSON.parse(savedBcStr);
          } catch {}
        }

        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        let studentUserObj: StudentUserItem | null = null;

        if (!authUser) {
          // 未認証の場合、架空のゲストやモックへフォールバックせず未認証状態とする
          setUser(null);
          setIsDeactivated(true);
        } else {
          const oauthName =
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.user_metadata?.preferred_username ||
            (authUser.email ? authUser.email.split('@')[0] : '');

          const displayName = oauthName || '受講生';
          const storedFarmId =
            typeof window !== 'undefined' ? localStorage.getItem('nouato_invite_farm_id') : null;

          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          if (userData) {
            studentUserObj = {
              ...userData,
              name: userData.display_name || displayName,
              email: userData.email ?? undefined,
            };
            setUser(studentUserObj);
            // 🌟 退会済み（deleted_at あり）または農園未所属の場合を検知 🌟
            if (userData.deleted_at || (!userData.farm_id && !storedFarmId)) {
              setIsDeactivated(true);
            }
          } else {
            studentUserObj = {
              id: authUser.id,
              name: displayName,
              email: authUser.email,
              farm_id: storedFarmId,
            };
            setUser(studentUserObj);
            if (!storedFarmId) {
              setIsDeactivated(true);
            }
          }
        }

        // アプリ起動時に古い localStorage キャッシュを完全自動破棄
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('nouato_student_task_statuses');
            localStorage.removeItem('nouato_student_all_completed_status');
          } catch {}
        }

        const currentStudentId = studentUserObj?.id || null;
        const studentFarmId =
          studentUserObj?.farm_id ||
          (typeof window !== 'undefined' ? localStorage.getItem('nouato_invite_farm_id') : null);

        if (!currentStudentId) {
          setMyBeds([]);
          setTasks([]);
          setJournals([]);
          setIsLoading(false);
          return;
        }

        // 1. 講師が割り当てた畝 (farm_beds) を取得 (ログイン中の生徒のみ厳密抽出)
        let bedData: Record<string, unknown>[] = [];
        const { data } = await supabase
          .from('farm_beds')
          .select('*, farm_plots(*)')
          .eq('student_id', currentStudentId);
        bedData = (data as Record<string, unknown>[]) || [];
        setMyBeds(bedData);

        // 2. 講師が公開中のタスク (tasks: status = "todo", deleted_at is null) 及び 個別割当 (student_tasks) のみ取得
        const { data: stData } = await supabase
          .from('student_tasks')
          .select('*')
          .eq('student_id', currentStudentId);

        // 🌟 講師がカンバンで「生徒へ公開中 (status = 'todo')」に配置した教材タスクを取得 (自農園または共通教材) 🌟
        let ptQuery = supabase
          .from('tasks')
          .select('*')
          .eq('status', 'todo')
          .is('deleted_at', null);

        if (studentFarmId) {
          ptQuery = ptQuery.or(`farm_id.eq.${studentFarmId},farm_id.is.null`);
        }

        const { data: publicTasks } = await ptQuery.order('created_at', { ascending: false });

        const taskList: StudentTaskItem[] = [];
        const seenTaskIds = new Set<string>();

        // ① 講師が新規作成して「生徒へ公開中 (status = 'todo')」にした教材タスクを追加
        if (publicTasks && publicTasks.length > 0) {
          publicTasks.forEach((pt: Record<string, unknown>) => {
            const ptId = String(pt.id || '');
            if (ptId && !seenTaskIds.has(ptId)) {
              seenTaskIds.add(ptId);
              // base_task_id で厳密照合 (旧データ救済として base_task_id が null の場合はタイトル完全一致も許可)
              const stMatch = stData?.find((st: Record<string, unknown>) => {
                const baseId = String(st.base_task_id || st.task_id || '');
                if (baseId === ptId || String(st.id) === ptId) return true;
                if (
                  !baseId &&
                  st.title &&
                  pt.title &&
                  String(st.title).trim() === String(pt.title).trim()
                ) {
                  return true;
                }
                return false;
              });
              const stMatchTyped = stMatch as
                { id?: string; status?: string; base_task_id?: string | null } | undefined;
              const isDone = stMatchTyped ? stMatchTyped.status === 'completed' : false;

              // 旧データで base_task_id が欠落していた場合はバックグラウンドで自己修復
              const targetStId = stMatchTyped?.id;
              if (targetStId && !stMatchTyped.base_task_id) {
                void (async () => {
                  try {
                    await supabase
                      .from('student_tasks')
                      .update({ base_task_id: ptId })
                      .eq('id', targetStId);
                  } catch {}
                })();
              }

              const cl = (pt.checklist as Record<string, unknown>) || {};
              const resolvedBadgeName =
                (pt.badge_name as string) || (cl.badge_name as string) || '';
              const resolvedBadgeIcon =
                (pt.badge_icon as string) || (cl.badge_icon as string) || '🏆';

              taskList.push({
                id: stMatchTyped?.id ? stMatchTyped.id : `task_${pt.id}`,
                task_id: ptId,
                status: isDone ? 'completed' : 'not_started',
                tasks: {
                  id: pt.id,
                  title: pt.title,
                  description: pt.description || '',
                  target_crop: pt.target_crop || '野菜全般',
                  variety: pt.variety || '',
                  category: pt.category || '共通',
                  season: pt.season || '',
                  phase: pt.phase || '',
                  timing: pt.timing || '',
                  estimated_time: pt.estimated_time || '30分',
                  tools_needed: pt.tools_needed || '',
                  memo: pt.memo || '',
                  difficulty: pt.difficulty || 2,
                  badge_name: resolvedBadgeName,
                  badge_icon: resolvedBadgeIcon,
                  require_photo: pt.require_photo ?? true,
                  reference_links: pt.reference_links || '',
                  source: pt.source || '',
                  exp: pt.exp || 50,
                },
              });
            }
          });
        }

        // ② 生徒の個別割当タスク (student_tasks) に直接存在するタスクも合流
        // ※ ただし、base_task_id がある場合は publicTasks に実在するもののみ許可 (講師完全削除タスクの排除)
        // ※ すでに ① で照合済みの同名タスクは重複合流を防止
        if (stData && stData.length > 0) {
          stData.forEach((st: Record<string, unknown>) => {
            const baseTaskId = String(st.base_task_id || st.task_id || '');
            const stId = String(st.id || '');

            // base_task_id が指定されている場合、publicTasks に存在しない (削除/非公開) なら表示しない
            if (baseTaskId && baseTaskId !== stId) {
              const inPublic = publicTasks?.some(
                (pt: Record<string, unknown>) => String(pt.id) === baseTaskId
              );
              if (!inPublic) {
                // 削除されたゾンビタスクを完全にスキップ
                return;
              }
            }

            // すでに ① で処理済みのタスク（またはタイトルが一致する教材タスク）は二重追加しない
            const alreadyProcessedAsPublic =
              (baseTaskId && seenTaskIds.has(baseTaskId)) ||
              publicTasks?.some(
                (pt: Record<string, unknown>) => String(pt.title).trim() === String(st.title).trim()
              );

            const effectiveKey = baseTaskId || stId;
            if (effectiveKey && !seenTaskIds.has(effectiveKey) && !alreadyProcessedAsPublic) {
              seenTaskIds.add(effectiveKey);
              const isDone = st.status === 'completed';

              const cl = (st.checklist as Record<string, unknown>) || {};
              const resolvedBadgeName =
                (st.badge_name as string) || (cl.badge_name as string) || '';
              const resolvedBadgeIcon =
                (st.badge_icon as string) || (cl.badge_icon as string) || '🏆';

              taskList.push({
                id: stId,
                task_id: effectiveKey,
                status: isDone ? 'completed' : 'not_started',
                tasks: {
                  id: effectiveKey,
                  title: st.title,
                  description: st.description || '',
                  target_crop: st.target_crop || '野菜全般',
                  variety: st.variety || '',
                  category: st.category || '共通',
                  season: st.season || '',
                  phase: st.phase || '',
                  timing: st.timing || '',
                  estimated_time: st.estimated_time || '30分',
                  tools_needed: st.tools_needed || '',
                  memo: st.memo || '',
                  difficulty: st.difficulty || 2,
                  badge_name: resolvedBadgeName,
                  badge_icon: resolvedBadgeIcon,
                  require_photo: st.require_photo ?? true,
                  reference_links: st.reference_links || '',
                  source: st.source || '',
                  exp: st.exp || 50,
                },
              });
            }
          });
        }

        // 🌟 新着・講師作成タスクがスライダーの先頭に最初に来るように整列 🌟
        taskList.sort((a, b) => {
          const aDone = a.status === 'completed';
          const bDone = b.status === 'completed';
          if (!aDone && bDone) return -1;
          if (aDone && !bDone) return 1;

          // 未完了同士の並び順: 講師作成タスク (task_ で始まるもの) を最優先で先頭に配置
          const aIsDynamic = a.id?.startsWith('task_');
          const bIsDynamic = b.id?.startsWith('task_');
          if (aIsDynamic && !bIsDynamic) return -1;
          if (!aIsDynamic && bIsDynamic) return 1;

          return 0;
        });

        setTasks(taskList);

        // 3. journals 取得 (ログイン中の生徒自身の記録のみ厳密に取得)
        let jData: Record<string, unknown>[] = [];
        if (currentStudentId) {
          const { data } = await supabase
            .from('journals')
            .select('*')
            .eq('student_id', currentStudentId)
            .order('created_at', { ascending: false });
          jData = (data as Record<string, unknown>[]) || [];
        }

        setJournals(jData);

        // 全体お知らせ ＆ 生徒宛てお知らせ (broadcasts) を Supabase DB ＆ LocalStorage から確実・網羅的に取得
        let bcData: Record<string, unknown>[] = [];
        try {
          const isUuid = (str?: string | null) =>
            !!str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

          // 1. 対象範囲のOR条件を構築:
          //    - ログイン生徒自身宛て (student_id.eq.currentStudentId)
          //    - 自農園宛て (farm_id.eq.studentFarmId)
          //    - 全農園・全体宛て (farm_id.is.null)
          //    - 全生徒宛て (student_id.is.null)
          const scopeConditions: string[] = ['farm_id.is.null', 'student_id.is.null'];
          if (currentStudentId && isUuid(currentStudentId)) {
            scopeConditions.push(`student_id.eq.${currentStudentId}`);
          }
          if (studentFarmId && isUuid(studentFarmId)) {
            scopeConditions.push(`farm_id.eq.${studentFarmId}`);
          }

          // .in("role", ["broadcast", "announcement"]) を使い、.or() は scopeConditions のみで単一呼び出しにする
          const { data, error } = await supabase
            .from('journals')
            .select('*')
            .in('role', ['broadcast', 'announcement'])
            .or(scopeConditions.join(','))
            .order('created_at', { ascending: false })
            .limit(30);

          if (data && data.length > 0) {
            bcData = data as Record<string, unknown>[];
          } else {
            // フォールバック: テスト環境や農園ID未紐付け時でも配信を逃さないよう、直近の全体お知らせを確実に取得
            const { data: fallbackData } = await supabase
              .from('journals')
              .select('*')
              .in('role', ['broadcast', 'announcement'])
              .order('created_at', { ascending: false })
              .limit(10);
            if (fallbackData && fallbackData.length > 0) {
              bcData = fallbackData as Record<string, unknown>[];
            }
          }
          if (error) {
            console.warn('useStudentDashboard bcQuery error:', error);
          }
        } catch (e) {
          console.warn('useStudentDashboard bcQuery exception:', e);
        }

        // LocalStorage からのアナウンスキャッシュ取得 (自農園キー ＆ 共通キー)
        const bcFarmKey = studentFarmId
          ? `nouato_broadcast_announcements_${studentFarmId}`
          : 'nouato_broadcast_announcements';
        const savedBcAnnouncementsStr =
          typeof window !== 'undefined'
            ? localStorage.getItem(bcFarmKey) ||
              localStorage.getItem('nouato_broadcast_announcements')
            : null;
        let localBcArr: BroadcastItem[] = [];
        if (savedBcAnnouncementsStr) {
          try {
            localBcArr = JSON.parse(savedBcAnnouncementsStr);
          } catch {}
        }

        const combinedBroadcasts: BroadcastItem[] = [];

        // DB データを変換してアペンド
        if (bcData && bcData.length > 0) {
          bcData.forEach((j: Record<string, unknown>) => {
            const rawTitle = String(j.text || j.content || '講師からのお知らせ');
            const cleanTitle =
              rawTitle.replace('📢 【全体お知らせ】', '').replace('📢', '').trim() ||
              '講師からのお知らせ';
            const bodyContent = String(j.content || j.text || '');
            const senderName = String(j.reply || '講師');
            combinedBroadcasts.push({
              id: String(j.id || ''),
              title: cleanTitle,
              content: bodyContent,
              sender: senderName.startsWith('講師配信:')
                ? senderName.replace('講師配信:', '').trim()
                : senderName,
              created_at: j.created_at ? String(j.created_at) : undefined,
            });
          });
        }

        // LocalStorage キャッシュをアペンド
        if (localBcArr && localBcArr.length > 0) {
          localBcArr.forEach((item: BroadcastItem) => {
            combinedBroadcasts.push({
              id: item.id || `local_${item.created_at}`,
              title:
                item.title?.replace('📢 【全体お知らせ】', '')?.replace('📢', '')?.trim() ||
                '講師からのお知らせ',
              content: item.content || '',
              sender: item.sender || '講師',
              created_at: item.created_at || new Date().toISOString(),
            });
          });
        }

        // 重複除去 (title + content サマリー)
        const seenBcKeys = new Set<string>();
        const uniqueBroadcasts: BroadcastItem[] = [];

        combinedBroadcasts.forEach((bc) => {
          const contentSnippet = (bc.content || '').slice(0, 30).trim();
          const bcKey = `${bc.title}_${contentSnippet}`;
          if (!seenBcKeys.has(bcKey)) {
            seenBcKeys.add(bcKey);
            uniqueBroadcasts.push(bc);
          }
        });

        // 作成日時 (created_at) 降順ソート
        uniqueBroadcasts.sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA;
        });

        setBroadcasts(uniqueBroadcasts);
      } catch (e) {
        console.error('useStudentDashboard fetchData error:', e);
        setTasks([]);
      } finally {
        if (minDisplayTime > 0) {
          const elapsed = Date.now() - startTime;
          if (elapsed < minDisplayTime) {
            await new Promise((res) => setTimeout(res, minDisplayTime - elapsed));
          }
        }
        setIsLoading(false);
        isInitial = false;
      }
    };

    fetchData();

    // 🌟 1. BroadcastChannel 経由の 0.01秒超高速同一ブラウザ同期 🌟
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('nouato_farm_sync_channel');
      bc.onmessage = () => {
        fetchData();
      };
    }

    // 🌟 2. カスタム DOM イベント同期 (同一タブ内) 🌟
    const handleCustomSync = () => {
      fetchData();
    };
    window.addEventListener('nouato_sync_event', handleCustomSync);

    // 🌟 3. localStorage 同期 (別ウィンドウ・タブ間) 🌟
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'nouato_farm_plots' || e.key === 'nouato_sync_event') {
        fetchData();
      }
    };
    window.addEventListener('storage', handleStorage);

    // 🌟 4. タブ切り替え/復帰時の自動再同期 🌟
    const handleFocus = () => {
      fetchData();
    };
    window.addEventListener('focus', handleFocus);

    // 🌟 5. Supabase Realtime (別端末・スマホ実機間 WebSocket 同期) 🌟
    const channelName = `student_sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const realtimeChannel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_beds' }, () =>
        fetchData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_plots' }, () =>
        fetchData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_tasks' }, () =>
        fetchData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journals' }, () =>
        fetchData()
      )
      .subscribe();

    return () => {
      if (bc) bc.close();
      window.removeEventListener('nouato_sync_event', handleCustomSync);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(realtimeChannel);
    };
  }, []);

  const completeTask = async (taskId: string) => {
    const targetTask = tasks.find(
      (t) => t.id === taskId || t.task_id === taskId || (t.tasks as { id?: string })?.id === taskId
    );
    if (!targetTask) return;

    const taskTitle =
      (targetTask.tasks as { title?: string })?.title || targetTask.title || '完了タスク';
    const baseTaskId = String(
      (targetTask.tasks as { id?: string })?.id || targetTask.task_id || targetTask.id || ''
    ).replace(/^task_/, '');
    const currentStudentId = user?.id || 'student_default';

    // 1. ローカル UI ステートを即時完了に変更 (IDで厳密一致)
    setTasks((prev) =>
      prev.map((t) => {
        const tBaseId = String((t.tasks as { id?: string })?.id || t.task_id || t.id || '').replace(
          /^task_/,
          ''
        );
        if (t.id === targetTask.id || (tBaseId && tBaseId === baseTaskId)) {
          return { ...t, status: 'completed' };
        }
        return t;
      })
    );

    // 2. Supabase DB (student_tasks) の status を 'completed' に更新 (base_task_id で厳密更新)
    try {
      const { data: userSts } = await supabase
        .from('student_tasks')
        .select('id, base_task_id')
        .eq('student_id', currentStudentId);

      let updated = false;
      if (userSts && userSts.length > 0) {
        for (const st of userSts) {
          if (
            st.base_task_id === baseTaskId ||
            st.id === targetTask.id ||
            (!st.base_task_id && st.id && targetTask.title && st.id === targetTask.id) ||
            (!st.base_task_id && targetTask.title)
          ) {
            // 対象タスクの特定: base_task_id一致、ID一致、または未紐付け同名
            const isMatch = st.base_task_id === baseTaskId || st.id === targetTask.id;
            if (isMatch) {
              updated = true;
              await supabase
                .from('student_tasks')
                .update({
                  base_task_id: baseTaskId,
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                })
                .eq('id', st.id);
            }
          }
        }
      }

      if (!updated && currentStudentId && currentStudentId !== 'student_default') {
        await supabase.from('student_tasks').upsert(
          {
            student_id: currentStudentId,
            base_task_id: baseTaskId,
            title: taskTitle,
            status: 'completed',
            completed_at: new Date().toISOString(),
          },
          { onConflict: 'student_id,base_task_id' }
        );
      }
    } catch (e) {
      console.warn('completeTask DB update error:', e);
    }

    // 3. リアルタイム同調イベントを発火
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nouato_sync_event'));
      try {
        const bc = new BroadcastChannel('nouato_farm_sync_channel');
        bc.postMessage({ type: 'FARMS_UPDATED', timestamp: Date.now() });
        bc.close();
      } catch {}
    }
  };

  const uncompleteTask = async (taskId: string) => {
    const targetTask = tasks.find(
      (t) => t.id === taskId || t.task_id === taskId || (t.tasks as { id?: string })?.id === taskId
    );
    if (!targetTask) return;

    const taskTitle =
      (targetTask.tasks as { title?: string })?.title || targetTask.title || '完了タスク';
    const baseTaskId = String(
      (targetTask.tasks as { id?: string })?.id || targetTask.task_id || targetTask.id || ''
    ).replace(/^task_/, '');
    const currentStudentId = user?.id || 'student_default';

    // 1. ローカル UI ステートを即時未完了に変更 (IDで厳密一致)
    setTasks((prev) =>
      prev.map((t) => {
        const tBaseId = String((t.tasks as { id?: string })?.id || t.task_id || t.id || '').replace(
          /^task_/,
          ''
        );
        if (t.id === targetTask.id || (tBaseId && tBaseId === baseTaskId)) {
          return { ...t, status: 'not_started' };
        }
        return t;
      })
    );

    // 2. Supabase DB (student_tasks) の status を 'pending' に更新 (base_task_id で厳密更新)
    try {
      const { data: userSts } = await supabase
        .from('student_tasks')
        .select('id, base_task_id')
        .eq('student_id', currentStudentId);

      let updated = false;
      if (userSts && userSts.length > 0) {
        for (const st of userSts) {
          if (st.base_task_id === baseTaskId || st.id === targetTask.id) {
            updated = true;
            await supabase
              .from('student_tasks')
              .update({
                base_task_id: baseTaskId,
                status: 'pending',
                completed_at: null,
              })
              .eq('id', st.id);
          }
        }
      }

      if (!updated && currentStudentId && currentStudentId !== 'student_default') {
        await supabase.from('student_tasks').upsert(
          {
            student_id: currentStudentId,
            base_task_id: baseTaskId,
            title: taskTitle,
            status: 'pending',
            completed_at: null,
          },
          { onConflict: 'student_id,base_task_id' }
        );
      }
    } catch (e) {
      console.warn('uncompleteTask DB update error:', e);
    }

    // 3. リアルタイム同調イベントを発火
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nouato_sync_event'));
      try {
        const bc = new BroadcastChannel('nouato_farm_sync_channel');
        bc.postMessage({ type: 'FARMS_UPDATED', timestamp: Date.now() });
        bc.close();
      } catch {}
    }
  };

  const addJournal = async () => {
    if (!newJournal.trim()) return;

    const studentId = user?.id || null;
    const contentToSave = newJournal.trim();

    try {
      const { data } = await supabase
        .from('journals')
        .insert([
          {
            student_id: studentId,
            content: contentToSave,
            role: 'student',
          },
        ])
        .select();

      if (data && data.length > 0) {
        setJournals((prev) => [data[0], ...prev]);
      } else {
        setJournals((prev) => [
          {
            id: `j_${Date.now()}`,
            content: contentToSave,
            student_id: studentId,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (e) {
      console.error('addJournal error:', e);
    }

    // リアルタイム同期イベント
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nouato_sync_event'));
      try {
        const bc = new BroadcastChannel('nouato_farm_sync_channel');
        bc.postMessage({ type: 'JOURNALS_UPDATED', timestamp: Date.now() });
        bc.close();
      } catch {}
    }

    setNewJournal('');
  };

  return {
    user,
    tasks,
    journals,
    broadcasts,
    newJournal,
    setNewJournal,
    selectedTask,
    setSelectedTask,
    completeTask,
    uncompleteTask,
    addJournal,
    isLoading,
    isDeactivated,
  };
}
