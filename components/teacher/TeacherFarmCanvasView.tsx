'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { z } from 'zod';
import { useFarmManager } from '@/hooks/useFarmManager';
import { FarmBed, FarmPlot } from '@/types/farm';
import Toast from '@/components/ui/Toast';
import { formatHarvestAmount } from '@/lib/utils/formatHelper';
import BedApprovalNotificationBanner from '@/components/teacher/BedApprovalNotificationBanner';
import BedApprovalModal from '@/components/farm/BedApprovalModal';
import ArchivedCropsModal from '@/components/farm/ArchivedCropsModal';
import { SproutLoader } from '@/components/SproutLoader';
import ConfirmStudentSwapModal from '@/components/teacher/farm-canvas/ConfirmStudentSwapModal';
import FarmOwnerSettingsModal from '@/components/teacher/farm-canvas/FarmOwnerSettingsModal';
import FarmCanvasToolbar from '@/components/teacher/farm-canvas/FarmCanvasToolbar';
import UnassignedStudentsSidebar from '@/components/teacher/farm-canvas/UnassignedStudentsSidebar';
import { useStudentDrag, UnassignedStudent } from '@/hooks/farm/useStudentDrag';
import { useBedTimelineRecords } from '@/hooks/farm/useBedTimelineRecords';
import { supabase } from '@/lib/supabase';
import { swapFarmPlotsInDb } from '@/lib/farm/farmDb';
import { buildPlotId } from '@/lib/farm/farmCalculations';
import { useFarmStore } from '@/store/useFarmStore';

const FarmMetaDescriptionSchema = z.object({
  farm_meta: z
    .object({
      address: z.string().optional(),
    })
    .optional(),
});

const UnassignedStudentDropSchema = z.object({
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  grade: z.string(),
  colorBg: z.string(),
});

interface TeacherFarmCanvasViewProps {
  initialPlotCode?: string;
  initialFarmId?: string;
  initialApprovalBedId?: string;
}

export default function TeacherFarmCanvasView({
  initialPlotCode,
  initialFarmId,
}: TeacherFarmCanvasViewProps = {}) {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const hasWriteErrorRef = useRef(false);

  const notify = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  const {
    isLoading,
    farms,
    activeFarmId,
    setActiveFarmId,
    gridCols,
    setGridCols,
    gridRows,
    setGridRows,
    unassignedBedsCount,
    setUnassignedBedsCount,
    plots,
    setPlots,
    savePlotsGridIndicesToSupabase,
    currentFarmPlots,
    records,
    supabaseStudents,
    addBedToPlot,
    deleteBedFromPlot,
    updateAllUnassignedBedsCount,
    assignStudentToPlot,
    assignAllUnassignedStudents,
    unassignStudentFromPlot,
    updatePlotStatus,
    approveAndAddNewBed,
    rejectBedCompletion,
    unarchiveBed,
  } = useFarmManager({
    onWriteError: (msg) => {
      hasWriteErrorRef.current = true;
      notify(`⚠️ ${msg}`);
    },
  });

  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [archivedModalTargetPlotId, setArchivedModalTargetPlotId] = useState<string | null>(null);

  const [approvalModalPlot, setApprovalModalPlot] = useState<FarmPlot | null>(null);
  const [approvalModalBed, setApprovalModalBed] = useState<FarmBed | null>(null);
  const [isAddingBed, setIsAddingBed] = useState<boolean>(false);
  const isAddingBedRef = useRef<boolean>(false);
  const lastAddBedTimeRef = useRef<number>(0);

  const unassignedList = useMemo<UnassignedStudent[]>(() => {
    const assignedStudentIds = new Set(
      currentFarmPlots
        .filter((p) => !p.is_vacant)
        .map((p) => p.student_id)
        .filter(Boolean)
    );
    const assignedStudentNames = new Set(
      currentFarmPlots
        .filter((p) => !p.is_vacant)
        .map((p) => p.student_name)
        .filter(Boolean)
    );

    const colorBgs = ['bg-emerald-800', 'bg-[#e89980]', 'bg-[#0b548b]', 'bg-purple-800'];

    const baseStudents = [...(supabaseStudents || [])];

    return baseStudents
      .filter(
        (s) =>
          !assignedStudentIds.has(s.id) &&
          !assignedStudentNames.has(s.full_name) &&
          !Array.from(assignedStudentNames).some(
            (an) => an && (an.includes(s.full_name) || s.full_name.includes(an))
          )
      )
      .map((s, idx) => ({
        id: s.id,
        name: s.full_name,
        initials: s.full_name.slice(0, 2),
        grade: '受講生',
        colorBg: colorBgs[idx % colorBgs.length],
      }));
  }, [supabaseStudents, currentFarmPlots]);

  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // キャンバス参照
  const canvasRef = useRef<HTMLDivElement>(null);

  // 🧑‍🌾 生徒カードのドラッグ＆ドロップ管理
  const {
    draggingStudent,
    confirmChangeStudentModal,
    setConfirmChangeStudentModal,
    handleStudentDragStart,
    handleStudentDragEnd,
    handleDropStudentOnPlot,
    handleConfirmChangeStudent,
  } = useStudentDrag({
    assignStudentToPlot,
    notify,
  });

  // 農園・代表者設定 Modal State (農園名・講師名・メールアドレス・住所)
  const [showFarmSettingsModal, setShowFarmSettingsModal] = useState(false);
  const [farmSettingsName, setFarmSettingsName] = useState('');
  const [ownerNameInput, setOwnerNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [farmAddressInput, setFarmAddressInput] = useState('');

  // 🌟 Excelスタイル正方形グリッド（useFarmManagerでDB・localStorage・農園設定と完全自動同期） 🌟
  const [dragOverPlotCode, setDragOverPlotCode] = useState<string | null>(null);
  const [draggedPlotCode, setDraggedPlotCode] = useState<string | null>(null);

  // クリック時詳細確認・編集 Modal / Drawer State
  const [detailPlot, setDetailPlot] = useState<FarmPlot | null>(null);

  const {
    selectedBedForRecords,
    setSelectedBedForRecords,
    bedRecords,
    isLoadingRecords,
    fetchBedRecords,
  } = useBedTimelineRecords({
    detailPlot,
    records,
    plots,
  });

  const handledInitialPlotRef = useRef<string | null>(null);

  // 外部(日誌スライダー等)からの対象農場・区画ジャンプ連携
  useEffect(() => {
    if (initialFarmId && initialFarmId !== activeFarmId) {
      setActiveFarmId(initialFarmId);
    }
  }, [initialFarmId, activeFarmId, setActiveFarmId]);

  useEffect(() => {
    if (
      initialPlotCode &&
      initialPlotCode !== handledInitialPlotRef.current &&
      currentFarmPlots.length > 0
    ) {
      const cleanCode = initialPlotCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const target = currentFarmPlots.find(
        (p) =>
          p.code === initialPlotCode ||
          p.code === cleanCode ||
          p.name?.includes(initialPlotCode) ||
          (cleanCode && p.code?.includes(cleanCode))
      );
      if (target) {
        handledInitialPlotRef.current = initialPlotCode;
        queueMicrotask(() => {
          setDetailPlot(target);
        });
      }
    }
  }, [initialPlotCode, currentFarmPlots]);

  // 🌟 開いている区画詳細モーダルを最新の plots データとリアルタイム同期 (リロード不要) 🌟
  useEffect(() => {
    if (detailPlot) {
      const updated = plots.find((p) => p.id === detailPlot.id || p.code === detailPlot.code);
      if (
        updated &&
        (updated.name !== detailPlot.name ||
          updated.description !== detailPlot.description ||
          updated.beds?.length !== detailPlot.beds?.length)
      ) {
        queueMicrotask(() => {
          setDetailPlot(updated);
        });
      }
    }
  }, [plots, detailPlot]);

  // 🌟 区画詳細モーダル (detailPlot) の Escape キー閉鎖 🌟
  useEffect(() => {
    if (!detailPlot) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showArchivedModal) return;
        setDetailPlot(null);
        setSelectedBedForRecords(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailPlot, showArchivedModal, setSelectedBedForRecords]);

  // 🚚 D&D マス目への純粋スワップハンドラー (セルアドレス A1, B2 等の位置固定・中身データのみ1対1相互交換)
  const handleMovePlotToGridCell = async (
    fromInput: string | number | null,
    toInput: string | number
  ) => {
    if (fromInput === null || fromInput === undefined || fromInput === toInput) return;

    let fromAddr = '';
    let toAddr = '';

    if (typeof fromInput === 'number') {
      const colLetter = String.fromCharCode(65 + (fromInput % gridCols));
      const rowNum = Math.floor(fromInput / gridCols) + 1;
      fromAddr = `${colLetter}${rowNum}`;
    } else {
      fromAddr = String(fromInput);
    }

    if (typeof toInput === 'number') {
      const colLetter = String.fromCharCode(65 + (toInput % gridCols));
      const rowNum = Math.floor(toInput / gridCols) + 1;
      toAddr = `${colLetter}${rowNum}`;
    } else {
      toAddr = String(toInput);
    }

    if (fromAddr === toAddr) return;

    const fromPlot =
      plots.find((p) => p.code === fromAddr) || currentFarmPlots.find((p) => p.code === fromAddr);
    const toPlot =
      plots.find((p) => p.code === toAddr) || currentFarmPlots.find((p) => p.code === toAddr);

    if (!fromPlot || !toPlot) return;

    // 🌟【重要】区画番号(code)・マス目位置は絶対固定し、中身データセット(受講生・畝・作物・ステータス)を1対1で完全スワップ！ 🌟
    const fromBedsForTo = (fromPlot.beds || []).map((b, idx) => {
      const bedNum = b.bed_number || idx + 1;
      const newId =
        b.status === 'archived'
          ? b.id
            ? b.id
                .replace(new RegExp(`_${fromAddr}_`), `_${toAddr}_`)
                .replace(new RegExp(`${fromPlot.id}`), `${toPlot.id}`)
            : `archived_bed_${toAddr}_${bedNum}_${Date.now()}`
          : `${toPlot.id}_bed_${bedNum}`;
      return {
        ...b,
        id: newId,
        plot_id: toPlot.id,
        bed_number: bedNum,
      };
    });

    const toBedsForFrom = (toPlot.beds || []).map((b, idx) => {
      const bedNum = b.bed_number || idx + 1;
      const newId =
        b.status === 'archived'
          ? b.id
            ? b.id
                .replace(new RegExp(`_${toAddr}_`), `_${fromAddr}_`)
                .replace(new RegExp(`${toPlot.id}`), `${fromPlot.id}`)
            : `archived_bed_${fromAddr}_${bedNum}_${Date.now()}`
          : `${fromPlot.id}_bed_${bedNum}`;
      return {
        ...b,
        id: newId,
        plot_id: fromPlot.id,
        bed_number: bedNum,
      };
    });

    const updatedPlots = plots.map((p) => {
      if (p.code === fromAddr) {
        return {
          ...p,
          student_id: toPlot.student_id || undefined,
          student_name: toPlot.student_name || undefined,
          name: toPlot.student_name
            ? `区画 ${fromAddr} - ${toPlot.student_name}`
            : `区画 ${fromAddr}`,
          is_vacant: toPlot.is_vacant ?? false,
          beds: toBedsForFrom,
        };
      }
      if (p.code === toAddr) {
        return {
          ...p,
          student_id: fromPlot.student_id || undefined,
          student_name: fromPlot.student_name || undefined,
          name: fromPlot.student_name
            ? `区画 ${toAddr} - ${fromPlot.student_name}`
            : `区画 ${toAddr}`,
          is_vacant: fromPlot.is_vacant ?? false,
          beds: fromBedsForTo,
        };
      }
      return p;
    });

    const previousPlots = plots;
    setPlots(updatedPlots);

    // 🌟 DB関数 swap_farm_plots により 1トランザクションで区画・畝・観察記録をアトミックに入れ替え 🌟
    const swappedOk = await swapFarmPlotsInDb(fromPlot.id, toPlot.id);
    if (!swappedOk) {
      setPlots(previousPlots);
      notify('⚠️ 区画の入れ替え保存に失敗しました。通信環境をご確認ください。');
      setDraggedPlotCode(null);
      setDragOverPlotCode(null);
      return;
    }

    notify(`🚚 マス「${fromAddr}」と「${toAddr}」の区画データを入れ替えました！`);
    setDraggedPlotCode(null);
    setDragOverPlotCode(null);
  };

  // 🌟 列数変更に伴うプロット状態 ＆ 未割り当て受講生リスト自動連動ハンドラー 🌟
  const handleGridColsChange = async (newCols: number) => {
    const oldCols = gridCols;
    setGridCols(newCols);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'nouato_grid_dimensions',
          JSON.stringify({ cols: newCols, rows: gridRows })
        );
      } catch {}
    }

    const defaultBeds = unassignedBedsCount || 7;

    // 1. 表示範囲 (A..newCols × 1..gridRows) のセルを構築
    const updatedPlots: FarmPlot[] = [];
    for (let r = 0; r < gridRows; r++) {
      const rowNum = r + 1;
      for (let c = 0; c < newCols; c++) {
        const colLetter = String.fromCharCode(65 + c);
        const cellAddress = `${colLetter}${rowNum}`;
        const uniquePlotId = buildPlotId(activeFarmId, cellAddress);
        const existing = plots.find((p) => p.code === cellAddress);

        if (existing) {
          // 既存区画:
          // 🌟 再表示された区画は「未割り当て区画 (is_vacant: false)」に戻す！ 🌟
          const beds = existing.beds?.length
            ? existing.beds
            : Array.from({ length: defaultBeds }).map((_, bIdx) => ({
                id: `${existing.id || uniquePlotId}_bed_${bIdx + 1}`,
                plot_id: existing.id || uniquePlotId,
                bed_number: bIdx + 1,
                crop_name: '未確定 🌱',
                is_updated: false,
              }));

          updatedPlots.push({
            ...existing,
            is_vacant: existing.student_id
              ? false
              : newCols > oldCols && c >= oldCols
                ? false
                : (existing.is_vacant ?? false),
            beds,
          });
        } else {
          // 新規マスを未割り当て区画として生成
          const newBeds: FarmBed[] = Array.from({ length: defaultBeds }).map((_, bIdx) => ({
            id: `${uniquePlotId}_bed_${bIdx + 1}`,
            plot_id: uniquePlotId,
            bed_number: bIdx + 1,
            crop_name: '未確定 🌱',
            is_updated: false,
          }));

          updatedPlots.push({
            id: uniquePlotId,
            farm_id: activeFarmId,
            name: `区画 ${cellAddress}`,
            code: cellAddress,
            grid_index: r * newCols + c,
            is_vacant: false,
            position: { x: c * 120, y: r * 120 },
            beds: newBeds,
          });
        }
      }
    }

    // 2. 縮小によって表示範囲外（非表示）となった区画
    // 🌟 非表示になった列は「空き地 (is_vacant: true)」とし、受講生がいたら割り当て解除して未割り当て一覧に戻す！ 🌟
    let releasedStudentCount = 0;
    plots.forEach((p) => {
      if (!updatedPlots.some((up) => up.code === p.code)) {
        if (p.student_id || p.student_name) {
          releasedStudentCount++;
        }
        updatedPlots.push({
          ...p,
          is_vacant: true, // 🌟 非表示の区画は空き地とする
          student_id: undefined, // 🌟 未割り当て受講生一覧へ自動復帰
          student_name: undefined,
          name: `区画 ${p.code}`,
          beds: (p.beds || []).map((b) => ({
            ...b,
            student_id: undefined,
            student_name: undefined,
          })),
        });
      }
    });

    setPlots(updatedPlots);
    await savePlotsGridIndicesToSupabase(updatedPlots, {
      cols: newCols,
      rows: gridRows,
      unassigned_beds: defaultBeds,
    });

    if (releasedStudentCount > 0) {
      notify(
        `🎯 盤面を ${newCols} 列に変更し、非表示になった受講生（${releasedStudentCount}名）を未割り当て一覧に戻しました`
      );
    } else {
      notify(`🎯 盤面の列数を ${newCols} 列に変更しました！`);
    }
  };

  const handleGridRowsChange = async (newRows: number) => {
    const oldRows = gridRows;
    setGridRows(newRows);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'nouato_grid_dimensions',
          JSON.stringify({ cols: gridCols, rows: newRows })
        );
      } catch {}
    }

    const defaultBeds = unassignedBedsCount || 7;

    const updatedPlots: FarmPlot[] = [];
    for (let r = 0; r < newRows; r++) {
      const rowNum = r + 1;
      for (let c = 0; c < gridCols; c++) {
        const colLetter = String.fromCharCode(65 + c);
        const cellAddress = `${colLetter}${rowNum}`;
        const uniquePlotId = buildPlotId(activeFarmId, cellAddress);
        const existing = plots.find((p) => p.code === cellAddress);

        if (existing) {
          const beds = existing.beds?.length
            ? existing.beds
            : Array.from({ length: defaultBeds }).map((_, bIdx) => ({
                id: `${existing.id || uniquePlotId}_bed_${bIdx + 1}`,
                plot_id: existing.id || uniquePlotId,
                bed_number: bIdx + 1,
                crop_name: '未確定 🌱',
                is_updated: false,
              }));

          updatedPlots.push({
            ...existing,
            is_vacant: existing.student_id
              ? false
              : newRows > oldRows && r >= oldRows
                ? false
                : (existing.is_vacant ?? false),
            beds,
          });
        } else {
          const newBeds: FarmBed[] = Array.from({ length: defaultBeds }).map((_, bIdx) => ({
            id: `${uniquePlotId}_bed_${bIdx + 1}`,
            plot_id: uniquePlotId,
            bed_number: bIdx + 1,
            crop_name: '未確定 🌱',
            is_updated: false,
          }));

          updatedPlots.push({
            id: uniquePlotId,
            farm_id: activeFarmId,
            name: `区画 ${cellAddress}`,
            code: cellAddress,
            grid_index: r * gridCols + c,
            is_vacant: false,
            position: { x: c * 120, y: r * 120 },
            beds: newBeds,
          });
        }
      }
    }

    // 縮小によって表示範囲外（非表示）となった区画: 空き地化 & 生徒解除
    let releasedStudentCount = 0;
    plots.forEach((p) => {
      if (!updatedPlots.some((up) => up.code === p.code)) {
        if (p.student_id || p.student_name) {
          releasedStudentCount++;
        }
        updatedPlots.push({
          ...p,
          is_vacant: true,
          student_id: undefined,
          student_name: undefined,
          name: `区画 ${p.code}`,
          beds: (p.beds || []).map((b) => ({
            ...b,
            student_id: undefined,
            student_name: undefined,
          })),
        });
      }
    });

    setPlots(updatedPlots);
    await savePlotsGridIndicesToSupabase(updatedPlots, {
      cols: gridCols,
      rows: newRows,
      unassigned_beds: defaultBeds,
    });

    if (releasedStudentCount > 0) {
      notify(
        `🎯 盤面を ${newRows} 行に変更し、非表示になった受講生（${releasedStudentCount}名）を未割り当て一覧に戻しました`
      );
    } else {
      notify(`🎯 盤面の行数を ${newRows} 行に変更しました！`);
    }
  };

  useEffect(() => {
    const fetchUserAndFarm = async () => {
      await Promise.resolve();
      const savedOwner =
        typeof window !== 'undefined' ? localStorage.getItem('nouato_owner_name') || '' : '';
      const savedAddress =
        typeof window !== 'undefined' ? localStorage.getItem('nouato_farm_address') || '' : '';
      setOwnerNameInput(savedOwner);
      setFarmAddressInput(savedAddress);

      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          if (authData.user.email) setEmailInput(authData.user.email);

          const { data: uData } = await supabase
            .from('users')
            .select('display_name, email')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (uData?.display_name) setOwnerNameInput(uData.display_name);
          if (uData?.email) setEmailInput(uData.email);
        }

        // 🌟 DB plots の description から農園住所を完全復元 🌟
        if (plots && plots.length > 0) {
          for (const p of plots) {
            if (p.description) {
              try {
                const rawMeta =
                  typeof p.description === 'string'
                    ? (JSON.parse(p.description) as unknown)
                    : p.description;
                const parsed = FarmMetaDescriptionSchema.safeParse(rawMeta);
                if (parsed.success && parsed.data.farm_meta?.address) {
                  const addr = parsed.data.farm_meta.address;
                  setFarmAddressInput(addr);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('nouato_farm_address', addr);
                  }
                  break;
                }
              } catch {}
            }
          }
        }
      } catch (err) {
        console.error('fetchUserAndFarm error:', err);
      }
    };

    void fetchUserAndFarm();
  }, [plots]);

  const handleSaveFarmSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmSettingsName.trim() || !ownerNameInput.trim()) {
      notify('農園名と代表者氏名を入力してください');
      return;
    }

    try {
      const cleanOwner = ownerNameInput.trim();
      const cleanFarm = farmSettingsName.trim();
      const cleanAddress = farmAddressInput.trim();
      const cleanEmail = emailInput.trim();

      localStorage.setItem('nouato_owner_name', cleanOwner);
      localStorage.setItem('nouato_farm_address', cleanAddress);

      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { error: userErr } = await supabase
          .from('users')
          .update({ display_name: cleanOwner, email: cleanEmail })
          .eq('id', authData.user.id);
        if (userErr) throw new Error(`代表者情報の保存に失敗しました: ${userErr.message}`);

        // owner_id は作成者を表す不変列 (トリガーで保護)。共同講師も農園名だけを更新する
        const { error: farmErr } = await supabase
          .from('farms')
          .update({ name: cleanFarm })
          .eq('id', activeFarmId);
        if (farmErr) throw new Error(`農園名の保存に失敗しました: ${farmErr.message}`);
      }

      // 🌟 農園住所を Supabase DB (farm_plots の farm_meta) へ完全永続保存 🌟
      await savePlotsGridIndicesToSupabase(plots);

      setShowFarmSettingsModal(false);
      notify('✨ 農園設定（農園名・代表者氏名・メールアドレス・住所）を確定保存しました！');
    } catch (err: unknown) {
      console.error('handleSaveFarmSettings error:', err);
      notify(`⚠️ ${err instanceof Error ? err.message : '農園設定の保存に失敗しました'}`);
    }
  };

  // 未割り当て受講生の一括割り当て
  const handleAssignAllUnassigned = () => {
    if (
      !confirm(
        `未割り当ての受講生（${unassignedList.length}名）を空いている区画へ一括割り当てしますか？`
      )
    )
      return;
    void (async () => {
      const res = await assignAllUnassignedStudents(unassignedList);
      if (res && res.count > 0) {
        notify(`⚡ ${res.count}名の受講生を空き区画へ一括割り当てしました！`);
      } else {
        notify('⚠️ 割り当て可能な空き区画がありませんでした');
      }
    })();
  };

  // スクロールホイールでの拡大縮小 (画面表示倍率 scale: 15% 〜 200%)
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 5 : -5;
        setZoomLevel((prev) => Math.min(200, Math.max(15, prev + delta)));
      }
    };

    canvasEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvasEl.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // 🌟 農園設定モーダルオープン (DBから実際の講師農園名を取得) 🌟
  const openFarmSettingsModal = async () => {
    try {
      const currentStoreName = useFarmStore.getState().activeFarmName;
      if (currentStoreName) {
        setFarmSettingsName(currentStoreName);
      } else {
        const { data: teacherFarm } = await supabase
          .from('farms')
          .select('name')
          .eq('id', activeFarmId)
          .maybeSingle();

        if (teacherFarm?.name) {
          setFarmSettingsName(teacherFarm.name);
        } else {
          const currentFarm = farms.find((f) => f.id === activeFarmId);
          setFarmSettingsName(currentFarm?.name || '農園');
        }
      }
    } catch (e) {
      console.error(e);
      setFarmSettingsName('農園');
    }
    setShowFarmSettingsModal(true);
  };

  const cellDim = Math.round(92 * (zoomLevel / 100));

  if (isLoading || plots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[460px] py-20 animate-fade-in">
        <SproutLoader size={80} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-gray-800">
      <Toast message={toastMessage} isOpen={showToast} onClose={() => setShowToast(false)} />

      {/* 🌟 生徒からの収穫完了報告通知バナー 🌟 */}
      <BedApprovalNotificationBanner
        plots={plots}
        onOpenApproval={(plot, bed) => {
          setApprovalModalPlot(plot);
          setApprovalModalBed(bed);
        }}
      />

      {/* 📊 グリッド コントロールツールバー 📊 */}
      <FarmCanvasToolbar
        farmSwitch={{
          farms,
          activeFarmId,
          setActiveFarmId,
        }}
        grid={{
          gridCols,
          gridRows,
          onGridColsChange: handleGridColsChange,
          onGridRowsChange: handleGridRowsChange,
        }}
        unassignedBeds={{
          count: unassignedBedsCount,
          setCount: setUnassignedBedsCount,
          updateAllUnassignedBedsCount,
        }}
        zoom={{
          zoomLevel,
          setZoomLevel,
        }}
        notify={notify}
        openFarmSettingsModal={openFarmSettingsModal}
      />

      {/* 🧑‍🌾 未割り当て受講生一覧 (D&Dで畑に配置) 🧑‍🌾 */}
      <UnassignedStudentsSidebar
        unassignedList={unassignedList}
        draggingStudent={draggingStudent}
        onDragStart={handleStudentDragStart}
        onDragEnd={handleStudentDragEnd}
        onAssignAll={handleAssignAllUnassigned}
      />

      {/* 🌟 2. メインのグリッド描画エリア 🌟 */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm overflow-x-auto">
        <div
          className="grid gap-2 select-none"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            width: `${gridCols * (cellDim + 8)}px`,
          }}
        >
          {Array.from({ length: gridRows }).map((_, rIdx) =>
            Array.from({ length: gridCols }).map((_, cIdx) => {
              const cellAddress = `${String.fromCharCode(65 + cIdx)}${rIdx + 1}`;
              const plot = plots.find((p) => p.code === cellAddress);
              const isAssigned =
                plot && !plot.is_vacant && (!!plot.student_id || !!plot.student_name);
              const isVacant = plot?.is_vacant;
              const hasPendingApproval = (plot?.beds || []).some(
                (b) => b.status === 'completed_pending'
              );
              const isUpdated = (plot?.beds || []).some((b) => b.is_updated);
              const scaleRatio = Math.max(0.4, Math.min(1.0, zoomLevel / 100));

              return (
                <div
                  key={cellAddress}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/plot-code', cellAddress);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedPlotCode(cellAddress);
                  }}
                  onDragEnd={() => {
                    setDraggedPlotCode(null);
                    setDragOverPlotCode(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = draggedPlotCode ? 'move' : 'copy';
                  }}
                  onDragEnter={() => {
                    if (draggedPlotCode !== cellAddress) {
                      setDragOverPlotCode(cellAddress);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverPlotCode === cellAddress) {
                      setDragOverPlotCode(null);
                    }
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const fromPlotCode = e.dataTransfer.getData('application/plot-code');
                    setDragOverPlotCode(null);
                    setDraggedPlotCode(null);

                    // 1. 🌟 区画マス同士のスワップ移動（区画番号以外のデータセット一式を完全相互交換） 🌟
                    if (fromPlotCode && fromPlotCode !== cellAddress) {
                      await handleMovePlotToGridCell(fromPlotCode, cellAddress);
                      return;
                    }

                    // 2. 🌟 未割り当て受講生の割り当て 🌟
                    let droppedStudentData: UnassignedStudent | undefined = undefined;
                    try {
                      const dataStr = e.dataTransfer.getData('application/json');
                      if (dataStr) {
                        const parsed = UnassignedStudentDropSchema.safeParse(JSON.parse(dataStr));
                        if (parsed.success) {
                          droppedStudentData = parsed.data;
                        }
                      }
                    } catch {}
                    if (plot) {
                      handleDropStudentOnPlot(plot, droppedStudentData);
                    }
                  }}
                  onClick={() => {
                    if (plot) {
                      const pendingBed = (plot.beds || []).find(
                        (b) => b.status === 'completed_pending'
                      );
                      if (pendingBed) {
                        setApprovalModalPlot(plot);
                        setApprovalModalBed(pendingBed);
                      } else {
                        setDetailPlot(plot);
                      }
                    }
                  }}
                  style={{
                    width: `${cellDim}px`,
                    height: `${cellDim}px`,
                    padding: `${Math.max(2, Math.round(6 * scaleRatio))}px`,
                  }}
                  className={`relative rounded-2xl border-2 transition cursor-grab active:cursor-grabbing flex flex-col justify-between items-center overflow-hidden shadow-xs ${
                    draggedPlotCode === cellAddress
                      ? 'opacity-30 scale-95 border-dashed border-gray-400'
                      : dragOverPlotCode === cellAddress
                        ? draggedPlotCode
                          ? 'ring-4 ring-blue-500 bg-blue-50/90 scale-105 shadow-xl border-blue-500 z-10 animate-pulse'
                          : 'ring-4 ring-emerald-500 bg-emerald-100 scale-105 shadow-lg border-emerald-500 z-10'
                        : hasPendingApproval
                          ? 'bg-rose-50/95 border-red-500 ring-4 ring-red-400/80 shadow-xl animate-pulse'
                          : isUpdated
                            ? 'bg-emerald-100/80 border-emerald-500 ring-2 ring-emerald-400 shadow-md'
                            : isAssigned
                              ? 'bg-emerald-50/90 border-emerald-400 hover:border-emerald-600 hover:shadow-md'
                              : isVacant
                                ? 'bg-gray-100/60 border-dashed border-gray-300 opacity-60'
                                : 'bg-white border-dashed border-emerald-300 hover:border-emerald-500 hover:shadow-sm'
                  }`}
                >
                  {/* セルアドレス & 畝数 */}
                  <div className="w-full flex items-center justify-between pointer-events-none gap-0.5 overflow-hidden">
                    <span
                      style={{ fontSize: `${Math.max(7, Math.round(10 * scaleRatio))}px` }}
                      className="font-black text-emerald-950 bg-white/90 px-1 py-0.2 rounded border border-gray-200 truncate"
                    >
                      {cellAddress}
                    </span>
                    {!isVacant && (
                      <span
                        style={{ fontSize: `${Math.max(7, Math.round(9 * scaleRatio))}px` }}
                        className="font-black text-emerald-900 bg-emerald-100/90 px-1 py-0.2 rounded truncate whitespace-nowrap"
                      >
                        {(plot?.beds || []).filter((b) => b.status !== 'archived').length} 畝
                      </span>
                    )}
                  </div>

                  {/* 生徒名 ＆ 要承認バッジ (名前の真上で中央揃え) */}
                  <div className="text-center w-full pointer-events-none overflow-hidden px-0.5 flex flex-col items-center justify-center gap-0.5 my-auto">
                    {/* 🌟 要承認バッジ: 名前の真上で中央揃え 🌟 */}
                    {hasPendingApproval && (
                      <span
                        style={{ fontSize: `${Math.max(7, Math.round(9 * scaleRatio))}px` }}
                        className="bg-gradient-to-r from-red-600 to-rose-600 text-white font-black px-2 py-0.5 rounded-full shadow-xs animate-pulse border border-white/90 whitespace-nowrap inline-flex items-center gap-0.5 leading-none"
                      >
                        🏆 要承認
                      </span>
                    )}

                    {isAssigned ? (
                      <span
                        style={{ fontSize: `${Math.max(8, Math.round(12 * scaleRatio))}px` }}
                        className="font-black text-gray-900 truncate block leading-tight"
                      >
                        🧑‍🌾 {plot.student_name}
                      </span>
                    ) : isVacant ? (
                      <span
                        style={{ fontSize: `${Math.max(7, Math.round(10 * scaleRatio))}px` }}
                        className="text-gray-400 font-bold block truncate"
                      >
                        空き地
                      </span>
                    ) : (
                      <span
                        style={{ fontSize: `${Math.max(7, Math.round(10 * scaleRatio))}px` }}
                        className="text-emerald-600 font-bold block truncate"
                      >
                        未割当
                      </span>
                    )}
                  </div>

                  {/* フッター状態 (完了報告時は赤系強調) */}
                  <div className="w-full text-center pointer-events-none overflow-hidden">
                    {hasPendingApproval ? (
                      <span
                        style={{ fontSize: `${Math.max(6, Math.round(9 * scaleRatio))}px` }}
                        className="text-red-700 font-black bg-red-100 border border-red-300 px-1 py-0.2 rounded-full truncate block whitespace-nowrap"
                      >
                        収穫完了
                      </span>
                    ) : (
                      <span
                        style={{ fontSize: `${Math.max(6, Math.round(9 * scaleRatio))}px` }}
                        className="text-gray-400 block truncate"
                      >
                        {isAssigned ? '稼働中' : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 🌟 3. 区画詳細モーダル (畝の追加・観察記録の確認) 🌟 */}
      {detailPlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in text-gray-800"
          onClick={() => setDetailPlot(null)}
        >
          <div
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-lg text-emerald-950 flex items-center gap-2">
                  <span>区画 {detailPlot.code} の詳細管理</span>
                  {detailPlot.student_name && (
                    <span className="text-xs bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full font-bold">
                      🧑‍🌾 {detailPlot.student_name} さん
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 font-bold">
                  畝ごとの作物設定や観察記録の確認、新しい畝の追加ができます
                </p>
              </div>
              <button
                onClick={() => setDetailPlot(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-black transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 🌟 区画の利用状態管理 (空き地 ⇄ 未割当・空き区画 ⇄ ユーザー割り当て) 🌟 */}
            <div className="bg-gray-50/90 p-4 rounded-3xl border border-gray-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                  <span>⚙️</span>
                  <span>区画の利用状態:</span>
                </span>
                <span
                  className={`text-xs font-black px-3 py-1 rounded-full border shadow-2xs ${
                    detailPlot.is_vacant
                      ? 'bg-gray-200 text-gray-700 border-gray-300'
                      : detailPlot.student_id
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-teal-50 text-teal-800 border-teal-300'
                  }`}
                >
                  {detailPlot.is_vacant
                    ? '🚧 空き地 (管理外)'
                    : detailPlot.student_id
                      ? `🧑‍🌾 割当中 (${detailPlot.student_name})`
                      : '🌱 未割当 (空き区画)'}
                </span>
              </div>

              {/* 3つの状態トグルボタン */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. 空き地 */}
                <button
                  type="button"
                  onClick={async () => {
                    await updatePlotStatus(detailPlot.id, 'vacant');
                    setDetailPlot((prev) =>
                      prev
                        ? {
                            ...prev,
                            is_vacant: true,
                            student_id: undefined,
                            student_name: undefined,
                            name: `区画 ${prev.code}`,
                          }
                        : prev
                    );
                    notify(`🚧 区画 ${detailPlot.code} を「空き地（管理外）」に設定しました`);
                  }}
                  className={`py-2.5 px-3 rounded-2xl font-bold text-xs transition border cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    detailPlot.is_vacant
                      ? 'bg-gray-800 text-white border-gray-900 shadow-md ring-2 ring-gray-400'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-200'
                  }`}
                >
                  <span className="text-base">🚧</span>
                  <span className="font-black">空き地</span>
                  <span className="text-[10px] opacity-75">管理対象外（カウント除外）</span>
                </button>

                {/* 2. 未割当 (空き区画) */}
                <button
                  type="button"
                  onClick={async () => {
                    await updatePlotStatus(detailPlot.id, 'unassigned');
                    setDetailPlot((prev) =>
                      prev
                        ? {
                            ...prev,
                            is_vacant: false,
                            student_id: undefined,
                            student_name: undefined,
                            name: `区画 ${prev.code}`,
                          }
                        : prev
                    );
                    notify(`🌱 区画 ${detailPlot.code} を「未割当（空き区画）」に設定しました`);
                  }}
                  className={`py-2.5 px-3 rounded-2xl font-bold text-xs transition border cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    !detailPlot.is_vacant && !detailPlot.student_id
                      ? 'bg-teal-600 text-white border-teal-700 shadow-md ring-2 ring-teal-400'
                      : 'bg-white text-gray-600 hover:bg-teal-50 border-gray-200'
                  }`}
                >
                  <span className="text-base">🌱</span>
                  <span className="font-black">未割当 (空き区画)</span>
                  <span className="text-[10px] opacity-75">管理対象（受講生待ち）</span>
                </button>

                {/* 3. ユーザー割り当て */}
                <div
                  className={`p-2 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                    detailPlot.student_id
                      ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300 shadow-sm'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-black text-emerald-950 px-1">
                    <span className="flex items-center gap-1">
                      <span>🧑‍🌾</span>
                      <span>受講生割り当て</span>
                    </span>
                    {detailPlot.student_id && (
                      <button
                        type="button"
                        onClick={async () => {
                          await unassignStudentFromPlot(detailPlot.id);
                          setDetailPlot((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  is_vacant: false,
                                  student_id: undefined,
                                  student_name: undefined,
                                  name: `区画 ${prev.code}`,
                                }
                              : prev
                          );
                          notify(
                            `区画 ${detailPlot.code} の受講生割り当てを解除し、「空き区画」にしました`
                          );
                        }}
                        className="text-[10px] text-red-600 hover:underline cursor-pointer font-bold"
                      >
                        解除
                      </button>
                    )}
                  </div>
                  <select
                    value={detailPlot.student_id || ''}
                    onChange={async (e) => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      const selectedStudent = supabaseStudents.find((s) => s.id === selectedId);
                      if (selectedStudent) {
                        await assignStudentToPlot(
                          detailPlot.id,
                          selectedStudent.id,
                          selectedStudent.full_name
                        );
                        setDetailPlot((prev) =>
                          prev
                            ? {
                                ...prev,
                                is_vacant: false,
                                student_id: selectedStudent.id,
                                student_name: selectedStudent.full_name,
                                name: `区画 ${prev.code} - ${selectedStudent.full_name}`,
                              }
                            : prev
                        );
                        notify(
                          `🎯 区画 ${detailPlot.code} に ${selectedStudent.full_name} さんを割り当てました！`
                        );
                      }
                    }}
                    className="w-full bg-white border border-gray-300 rounded-xl px-2 py-1 text-xs font-bold text-gray-800 cursor-pointer"
                  >
                    <option value="" disabled>
                      受講生を選択して割当...
                    </option>
                    {supabaseStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} {detailPlot.student_id === s.id ? '(担当中)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 畝一覧 ＆ ＋畝を追加ボタン */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-gray-900">
                  🌿 稼働中の畝一覧 (
                  {(detailPlot.beds || []).filter((b) => b.status !== 'archived').length} 畝)
                </span>
                <button
                  type="button"
                  disabled={isAddingBed}
                  onClick={async () => {
                    const now = Date.now();
                    if (now - lastAddBedTimeRef.current < 1000) return;
                    if (isAddingBed || isAddingBedRef.current) return;
                    lastAddBedTimeRef.current = now;
                    isAddingBedRef.current = true;
                    setIsAddingBed(true);
                    try {
                      const newBed = await addBedToPlot(detailPlot.id);
                      if (newBed) {
                        setDetailPlot((prev) =>
                          prev
                            ? {
                                ...prev,
                                beds: [...(prev.beds || []), newBed],
                              }
                            : prev
                        );
                        notify('✨ 新しい畝を追加しました！');
                      }
                    } finally {
                      setTimeout(() => {
                        isAddingBedRef.current = false;
                        setIsAddingBed(false);
                      }, 800);
                    }
                  }}
                  className={`px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-xl shadow-md transition transform active:scale-95 flex items-center gap-1.5 ring-2 ring-emerald-400/40 ${
                    isAddingBed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <span>{isAddingBed ? '追加中...' : '＋ 畝を追加'}</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {(detailPlot.beds || [])
                  .filter((b) => b.status !== 'archived')
                  .map((bed, bIdx) => {
                    const displayNum = bed.bed_number || bIdx + 1;
                    const isSelected = selectedBedForRecords?.id === bed.id;

                    return (
                      <div
                        key={bed.id || bIdx}
                        className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/70 hover:bg-white hover:border-emerald-300 transition space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs bg-emerald-100 text-emerald-950 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                              畝 #{displayNum}
                            </span>
                            <span className="font-black text-xs text-gray-800">
                              品種: {bed.crop_name || '未確定 🌱'}
                            </span>
                            {bed.status === 'completed_pending' && (
                              <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                                🏆 収穫完了（要承認）
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedBedForRecords(null);
                                } else {
                                  setSelectedBedForRecords(bed);
                                  void fetchBedRecords(
                                    detailPlot.code,
                                    displayNum,
                                    bed.id,
                                    detailPlot.student_name,
                                    bed.latest_record,
                                    bed.crop_name
                                  );
                                }
                              }}
                              className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                            >
                              {isSelected ? '▲ 記録を閉じる' : '📖 観察記録を見る'}
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                if (
                                  window.confirm(
                                    `畝 #${displayNum} (${bed.crop_name || '未確定'}) を削除してもよろしいですか？\n※関連する観察記録も整理されます。`
                                  )
                                ) {
                                  await deleteBedFromPlot(detailPlot.id, bed.id);
                                  setDetailPlot((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          beds: (prev.beds || []).filter((b) => b.id !== bed.id),
                                        }
                                      : prev
                                  );
                                  notify(`🗑️ 畝 #${displayNum} を削除しました`);
                                }
                              }}
                              className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs flex items-center gap-1"
                              title="畝を削除"
                            >
                              <span>🗑️</span>
                              <span>削除</span>
                            </button>
                          </div>
                        </div>

                        {/* 観察記録タイムライン */}
                        {isSelected && (
                          <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2 animate-fade-in text-xs">
                            <span className="font-black text-emerald-950 block">
                              📖 畝 #{displayNum} の生徒観察記録タイムライン ({bedRecords.length}件)
                            </span>
                            {isLoadingRecords ? (
                              <p className="text-gray-400 py-2">読み込み中...</p>
                            ) : bedRecords.length === 0 ? (
                              <p className="text-gray-400 py-2">まだ記録はありません。</p>
                            ) : (
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {bedRecords.map((r, rIdx) => {
                                  const rawNotes = r.notes || r.content || '';
                                  let cleanNotes = rawNotes;
                                  let imgUrl = r.photo_url || r.image_url;
                                  const imgMatch = rawNotes.match(/\[IMG:([\s\S]+?)\]/);
                                  if (imgMatch) {
                                    imgUrl = imgMatch[1];
                                    cleanNotes = rawNotes.replace(/\[IMG:[\s\S]+?\]/g, '').trim();
                                  }

                                  return (
                                    <div
                                      key={`${r.id || 'rec'}_${rIdx}`}
                                      className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-2 hover:border-emerald-300 transition"
                                    >
                                      <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold border-b border-gray-100 pb-1.5">
                                        <span className="text-emerald-950 flex items-center gap-1 font-black">
                                          <span>📅</span>
                                          <span>{r.date}</span>
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          {r.harvest_amount && (
                                            <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-black">
                                              収穫: {formatHarvestAmount(r.harvest_amount)}
                                            </span>
                                          )}
                                          {r.growth_stage && (
                                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                                              {r.growth_stage}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex gap-3 items-start">
                                        {imgUrl && (
                                          <div
                                            onClick={() => window.open(imgUrl, '_blank')}
                                            className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-emerald-200 shadow-xs cursor-pointer hover:opacity-90 hover:scale-105 transition-transform bg-gray-100 flex items-center justify-center group relative"
                                            title="クリックして拡大表示"
                                          >
                                            <Image
                                              src={imgUrl}
                                              alt="観察記録写真"
                                              width={64}
                                              height={64}
                                              unoptimized
                                              className="w-full h-full object-cover"
                                            />
                                            <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[8px] px-1 rounded font-bold opacity-0 group-hover:opacity-100 transition">
                                              🔍
                                            </span>
                                          </div>
                                        )}

                                        <div className="flex-1 space-y-1">
                                          {r.work_types && (
                                            <div className="flex flex-wrap gap-1">
                                              {(Array.isArray(r.work_types)
                                                ? r.work_types
                                                : [r.work_types]
                                              ).map((wt: string, wIdx: number) => (
                                                <span
                                                  key={wIdx}
                                                  className="text-[9px] bg-emerald-100 text-emerald-900 font-bold px-1.5 py-0.2 rounded"
                                                >
                                                  {wt}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          <p className="font-bold text-gray-800 text-xs leading-relaxed whitespace-pre-wrap">
                                            {cleanNotes || '（写真のみ投稿）'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* フッター */}
            <div className="flex justify-between items-center pt-3 border-t">
              <button
                type="button"
                onClick={() => {
                  setArchivedModalTargetPlotId(detailPlot.id);
                  setShowArchivedModal(true);
                }}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-black rounded-xl text-xs cursor-pointer shadow-2xs"
              >
                📦 この区画の過去の作物を見る
              </button>

              <button
                type="button"
                onClick={() => setDetailPlot(null)}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black rounded-xl text-xs shadow-md cursor-pointer"
              >
                完了 (閉じる)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 過去の作物・アーカイブ閲覧モーダル 🌟 */}
      <ArchivedCropsModal
        isOpen={showArchivedModal}
        onClose={() => {
          setShowArchivedModal(false);
          setArchivedModalTargetPlotId(null);
        }}
        archivedBeds={
          archivedModalTargetPlotId
            ? (plots.find((p) => p.id === archivedModalTargetPlotId)?.beds || []).filter(
                (b) => b.status === 'archived'
              )
            : plots.flatMap((p) => (p.beds || []).filter((b) => b.status === 'archived'))
        }
        records={records}
        isTeacher={true}
        onUnarchive={(bedId) => {
          const targetPlot = plots.find((p) => (p.beds || []).some((b) => b.id === bedId));
          if (targetPlot) {
            void (async () => {
              hasWriteErrorRef.current = false;
              await unarchiveBed(targetPlot.id, bedId);
              if (!hasWriteErrorRef.current) {
                notify('↺ アーカイブから畝を通常状態に復帰しました');
              }
            })();
          }
        }}
      />

      {/* 🌟 収穫完了確認＆承認・差し戻しモーダル 🌟 */}
      <BedApprovalModal
        isOpen={!!approvalModalPlot && !!approvalModalBed}
        onClose={() => {
          setApprovalModalPlot(null);
          setApprovalModalBed(null);
        }}
        plot={approvalModalPlot}
        bed={approvalModalBed}
        onApprove={async (plotId, bedId) => {
          hasWriteErrorRef.current = false;
          await approveAndAddNewBed(plotId, bedId, '未確定 🌱', '2026年 秋冬');
          if (!hasWriteErrorRef.current) {
            notify('✅ 収穫完了を承認し、新しい畝を準備しました！');
          }
          setApprovalModalPlot(null);
          setApprovalModalBed(null);
          setDetailPlot(null);
        }}
        onReject={async (plotId, bedId, reason) => {
          hasWriteErrorRef.current = false;
          await rejectBedCompletion(plotId, bedId, reason);
          if (!hasWriteErrorRef.current) {
            notify('↩️ 収穫完了報告を差し戻しました。生徒画面に通知されます。');
          }
          setApprovalModalPlot(null);
          setApprovalModalBed(null);
        }}
      />

      {/* 🧑‍🌾 受講生交代の確認モーダル 🧑‍🌾 */}
      <ConfirmStudentSwapModal
        modalData={confirmChangeStudentModal}
        onClose={() => setConfirmChangeStudentModal(null)}
        onConfirm={handleConfirmChangeStudent}
      />

      {/* ⚙️ 農園・代表者設定 Modal ⚙️ */}
      <FarmOwnerSettingsModal
        isOpen={showFarmSettingsModal}
        onClose={() => setShowFarmSettingsModal(false)}
        farmName={farmSettingsName}
        onFarmNameChange={setFarmSettingsName}
        ownerName={ownerNameInput}
        onOwnerNameChange={setOwnerNameInput}
        email={emailInput}
        onEmailChange={setEmailInput}
        farmAddress={farmAddressInput}
        onFarmAddressChange={setFarmAddressInput}
        onSave={(e) => {
          void handleSaveFarmSettings(e);
        }}
      />
    </div>
  );
}
