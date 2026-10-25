'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils/formatHelper';
import { FarmBed, FarmPlot, CropRecord } from '@/types/farm';

export interface BedTimelineRecord {
  id?: string;
  date?: string;
  notes?: string;
  content?: string;
  photo_url?: string | null;
  image_url?: string | null;
  growth_stage?: string | null;
  height_cm?: number | null;
  work_types?: string[];
  harvest_amount?: string | number | null;
  created_at?: string | null;
}

export interface UseBedTimelineRecordsOptions {
  detailPlot: FarmPlot | null;
  records?: CropRecord[];
  plots?: FarmPlot[];
}

export function useBedTimelineRecords({
  detailPlot,
  records,
  plots,
}: UseBedTimelineRecordsOptions) {
  const [selectedBedForRecords, setSelectedBedForRecords] = useState<FarmBed | null>(null);
  const [bedRecords, setBedRecords] = useState<BedTimelineRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState<boolean>(false);

  const fetchBedRecords = useCallback(
    async (
      plotCode: string,
      bedNumber: number,
      bedId?: string,
      _studentName?: string,
      latestRec?: BedTimelineRecord | CropRecord | null,
      cropName?: string
    ) => {
      await Promise.resolve();
      setIsLoadingRecords(true);
      try {
        // 🌟 新しく追加された畝（未確定 🌱）で、新規記録がない場合は過去ログを完全除外 🌟
        if (cropName === '未確定 🌱' && !latestRec) {
          setBedRecords([]);
          return;
        }

        // 1. crop_records から取得 (bed_id または plot_id でDB側絞り込み & limit 50)
        let crQuery = supabase.from('crop_records').select('*');
        if (bedId && typeof crQuery.eq === 'function') {
          crQuery = crQuery.eq('bed_id', bedId);
        } else if (detailPlot?.id && typeof crQuery.eq === 'function') {
          crQuery = crQuery.eq('plot_id', detailPlot.id);
        }
        if (typeof crQuery.order === 'function') {
          crQuery = crQuery.order('created_at', { ascending: false });
        }
        if (typeof crQuery.limit === 'function') {
          crQuery = crQuery.limit(50);
        }
        const { data: cData } = await crQuery;

        // 2. journals から取得 (farm_id でDB側絞り込み & limit 50)
        let jq = supabase.from('journals').select('*');
        if (detailPlot?.farm_id && typeof jq.eq === 'function') {
          jq = jq.eq('farm_id', detailPlot.farm_id);
        }
        if (typeof jq.order === 'function') {
          jq = jq.order('created_at', { ascending: false });
        }
        if (typeof jq.limit === 'function') {
          jq = jq.limit(50);
        }
        const { data: jData } = await jq;

        const combined: BedTimelineRecord[] = [];

        if (cData && cData.length > 0) {
          cData.forEach((r) => {
            // bed_id の完全一致を最優先
            const isBedIdMatch = bedId && r.bed_id === bedId;
            const rRecord = r as Record<string, unknown>;
            const rPlotCode = (rRecord.plot_code as string | undefined) || '';
            const matchCodeAndBed =
              rPlotCode === plotCode &&
              (r.bed_id?.includes(`bed_${bedNumber}`) || r.bed_id?.endsWith(`_${bedNumber}`));

            if (isBedIdMatch || matchCodeAndBed) {
              combined.push({
                id: r.id,
                date: r.date
                  ? formatDate(r.date)
                  : r.created_at
                    ? formatDate(r.created_at)
                    : '記録日',
                notes: r.notes || '観察記録',
                photo_url: (rRecord.photo_url as string | undefined) || r.image_url,
                growth_stage: r.growth_stage || '作業記録',
                height_cm: r.height_cm,
                harvest_amount: r.harvest_amount != null ? String(r.harvest_amount) : undefined,
                work_types: Array.isArray(r.work_types) ? (r.work_types as string[]) : undefined,
                created_at: r.created_at,
              });
            }
          });
        }

        if (jData && jData.length > 0) {
          jData.forEach((j) => {
            const content = j.content || '';
            if (
              content &&
              !content.includes('を完了報告しました') &&
              content !== '（コメントなし）'
            ) {
              const hasBedHint =
                content.includes(`畝 ${bedNumber}`) || content.includes(`畝#${bedNumber}`);
              if (hasBedHint) {
                const jRecord = j as Record<string, unknown>;
                combined.push({
                  id: j.id,
                  date: j.created_at ? formatDate(j.created_at) : '最近',
                  notes: content,
                  photo_url:
                    (j.image_url as string | null) ||
                    (jRecord.photo_url as string | null) ||
                    undefined,
                  growth_stage:
                    typeof jRecord.task_title === 'string'
                      ? jRecord.task_title
                      : '💡 質問・相談日誌',
                  created_at: j.created_at,
                });
              }
            }
          });
        }

        // latestRec があれば追加
        if (latestRec && !combined.some((r) => r.notes === latestRec.notes)) {
          combined.unshift(latestRec);
        }

        setBedRecords(combined);
      } catch (e) {
        console.error('fetchBedRecords error:', e);
      } finally {
        setIsLoadingRecords(false);
      }
    },
    [detailPlot]
  );

  // 🌟 開いている観察記録タイムラインを最新データとリアルタイム同期 (リロード不要) 🌟
  useEffect(() => {
    if (selectedBedForRecords && detailPlot) {
      const displayNum = selectedBedForRecords.bed_number || 1;
      const load = async () => {
        await fetchBedRecords(
          detailPlot.code,
          displayNum,
          selectedBedForRecords.id,
          detailPlot.student_name,
          selectedBedForRecords.latest_record,
          selectedBedForRecords.crop_name
        );
      };
      void load();
    }
  }, [records, plots, detailPlot, selectedBedForRecords, fetchBedRecords]);

  return {
    selectedBedForRecords,
    setSelectedBedForRecords,
    bedRecords,
    setBedRecords,
    isLoadingRecords,
    fetchBedRecords,
  };
}
