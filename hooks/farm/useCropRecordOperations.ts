import type { Dispatch, SetStateAction } from 'react';
import { FarmPlot, CropRecord } from '@/types/farm';
import { supabase } from '@/lib/supabase';
import { insertCropRecordDb, updateCropRecordDb, deleteCropRecordDb } from '@/lib/farm/farmDb';

export interface UseCropRecordOperationsParams {
  records: CropRecord[];
  setRecords: Dispatch<SetStateAction<CropRecord[]>>;
  plots: FarmPlot[];
  setPlots: Dispatch<SetStateAction<FarmPlot[]>>;
  notifyBroadcast: () => void;
}

export function useCropRecordOperations({
  records,
  setRecords,
  plots,
  setPlots,
  notifyBroadcast,
}: UseCropRecordOperationsParams) {
  const addCropRecord = async (
    bedId: string | null | undefined,
    recordData: Omit<CropRecord, 'id' | 'created_at'> & { plot_id?: string | null }
  ) => {
    const newRecordId = `rec_${Date.now()}`;
    const todayStr = new Date().toISOString().split('T')[0];

    const safeBedId = bedId === 'shared' || !bedId ? null : bedId;

    const newRecord: CropRecord = {
      ...recordData,
      id: newRecordId,
      bed_id: safeBedId,
      plot_id: recordData.plot_id || null,
      created_at: new Date().toLocaleString('ja-JP'),
    };

    const nextRecords = [newRecord, ...records];
    setRecords(nextRecords);

    const imgToSave = recordData.image_url || recordData.photo_url;
    const finalNotes = (recordData.notes || '') + (imgToSave ? `\n[IMG:${imgToSave}]` : '');

    const extractedCropName =
      recordData.notes?.match(/【(.*?)】/)?.[1] || recordData.crop_name || '未設定';
    await insertCropRecordDb({
      id: newRecordId,
      bed_id: safeBedId,
      plot_id: recordData.plot_id || null,
      date: todayStr,
      crop_name: extractedCropName,
      growth_stage: recordData.growth_stage,
      notes: finalNotes,
      height_cm: recordData.height_cm,
      harvest_amount: recordData.harvest_amount,
      work_types: recordData.work_types,
    });

    notifyBroadcast();
    return newRecord;
  };

  const updateCropRecord = async (recordId: string, updatedData: Partial<CropRecord>) => {
    const nextRecords = records.map((r) => (r.id === recordId ? { ...r, ...updatedData } : r));
    setRecords(nextRecords);

    const imgToSave = updatedData.image_url || updatedData.photo_url;
    let baseNotes = updatedData.notes || '';
    baseNotes = baseNotes.replace(/\n?\[IMG:[\s\S]+?\]/, '').trim();
    const finalNotes = baseNotes + (imgToSave ? `\n[IMG:${imgToSave}]` : '');

    await updateCropRecordDb(recordId, {
      bed_id: updatedData.bed_id !== undefined ? updatedData.bed_id : undefined,
      plot_id: updatedData.plot_id !== undefined ? updatedData.plot_id : undefined,
      crop_name: updatedData.crop_name,
      notes: finalNotes,
      height_cm: updatedData.height_cm,
      growth_stage: updatedData.growth_stage,
      work_types: updatedData.work_types,
      harvest_amount: updatedData.harvest_amount,
    });

    notifyBroadcast();
  };

  const deleteCropRecord = async (recordId: string) => {
    const nextRecords = records.filter((r) => r.id !== recordId);
    setRecords(nextRecords);

    await deleteCropRecordDb(recordId);

    notifyBroadcast();
  };

  const updateBedCrop = async (bedId: string, cropName: string) => {
    const nextPlots = plots.map((plot) => {
      const isTarget = (plot.beds || []).some((b) => b.id === bedId || b.id?.endsWith(`_${bedId}`));
      if (isTarget) {
        return {
          ...plot,
          beds: (plot.beds || []).map((bed) => {
            if (bed.id === bedId || bed.id?.endsWith(`_${bedId}`)) {
              return { ...bed, crop_name: cropName };
            }
            return bed;
          }),
        };
      }
      return plot;
    });
    setPlots(nextPlots);

    try {
      await supabase.from('farm_beds').update({ crop_name: cropName }).eq('id', bedId);
    } catch (e) {
      console.error('updateBedCrop error:', e);
    }
    notifyBroadcast();
  };

  return {
    addCropRecord,
    updateCropRecord,
    deleteCropRecord,
    updateBedCrop,
  };
}
