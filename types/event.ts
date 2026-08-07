export type Attendee = {
  id: string;
  name: string;
  plot: string;
  status: "confirmed" | "pending";
};

export type EventItem = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD フォーマット
  dateDisplay: string; // 例: "2026年5月24日(日)"
  time: string;
  location: string;
  capacity: number;
  reservedCount: number;
  fee: string;
  description: string;
  category: "harvest" | "workshop" | "lecture";
  attendees: Attendee[];
};
