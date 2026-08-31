export type GrowthStage = "播種・苗植え" | "発芽・活着" | "本葉展開・つる伸び" | "開花・受粉" | "果実肥大" | "収穫期";

export type WorkType = "水やり" | "追肥" | "わき芽かき・仕立て" | "除草・土寄せ" | "病害虫対策" | "収穫";

export type CropRecord = {
  id: string;
  bed_id: string;
  date: string;
  growth_stage: GrowthStage;
  height_cm?: number;
  work_types: WorkType[];
  notes: string;
  harvest_amount?: string;
  image_url?: string;
  photo_url?: string;
  is_question?: boolean;
  question_text?: string;
  created_at: string;
};

export type BedStatus = "active" | "completed_pending" | "rejected" | "archived";

export type FarmBed = {
  id: string;
  plot_id: string;
  bed_number: number;
  crop_name?: string;
  crop_icon?: string;
  progress_percent?: number;
  student_id?: string;
  student_name?: string;
  is_updated: boolean;
  updated_at?: string;
  latest_record?: CropRecord;
  status?: BedStatus;
  season?: string;
  harvested_at?: string;
  completion_notes?: string;
  total_harvest?: string;
  completion_image_url?: string;
  reject_reason?: string;
};

export type FarmPlot = {
  id: string;
  farm_id: string;
  name: string;
  code: string;
  student_id?: string;
  student_name?: string;
  grid_index?: number;
  is_vacant?: boolean;
  position: { x: number; y: number };
  beds: FarmBed[];
};

export type Farm = {
  id: string;
  name: string;
  created_at?: string;
};
