export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          role: 'teacher' | 'student';
          display_name: string | null;
          line_user_id: string | null;
          created_at: string;
          farm_id: string | null;
          updated_at: string | null;
          deleted_at: string | null;
          email: string | null;
        };
        Insert: {
          id: string;
          role?: 'teacher' | 'student';
          display_name?: string | null;
          line_user_id?: string | null;
          created_at?: string;
          farm_id?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
          email?: string | null;
        };
        Update: {
          id?: string;
          role?: 'teacher' | 'student';
          display_name?: string | null;
          line_user_id?: string | null;
          created_at?: string;
          farm_id?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
          email?: string | null;
        };
        Relationships: [];
      };
      farms: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
          owner_id: string | null;
          show_student_talk_tab: boolean | null;
          invite_code?: string | null;
          preset_faqs?:
            | Array<{ id: string; chipLabel: string; question: string; answer: string }>
            | Json
            | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
          owner_id?: string | null;
          show_student_talk_tab?: boolean | null;
          invite_code?: string | null;
          preset_faqs?:
            | Array<{ id: string; chipLabel: string; question: string; answer: string }>
            | Json
            | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
          owner_id?: string | null;
          show_student_talk_tab?: boolean | null;
          preset_faqs?:
            | Array<{ id: string; chipLabel: string; question: string; answer: string }>
            | Json
            | null;
        };
        Relationships: [];
      };
      farm_plots: {
        Row: {
          id: string;
          farm_id: string | null;
          name: string;
          code: string;
          description: string | null;
          position: Json | null;
          created_at: string;
          student_id: string | null;
        };
        Insert: {
          id: string;
          farm_id?: string | null;
          name: string;
          code: string;
          description?: string | null;
          position?: Json | null;
          created_at?: string;
          student_id?: string | null;
        };
        Update: {
          id?: string;
          farm_id?: string | null;
          name?: string;
          code?: string;
          description?: string | null;
          position?: Json | null;
          created_at?: string;
          student_id?: string | null;
        };
        Relationships: [];
      };
      farm_beds: {
        Row: {
          id: string;
          plot_id: string | null;
          bed_number: string;
          dimensions: string | null;
          student_id: string | null;
          student_name: string | null;
          crop_name: string | null;
          crop_icon: string | null;
          planted_date: string | null;
          progress_percent: number | null;
          created_at: string;
          status: string;
          season: string | null;
          harvested_at: string | null;
          completion_notes: string | null;
          total_harvest: string | null;
          completion_image_url: string | null;
        };
        Insert: {
          id: string;
          plot_id?: string | null;
          bed_number?: string;
          dimensions?: string | null;
          student_id?: string | null;
          student_name?: string | null;
          crop_name?: string | null;
          crop_icon?: string | null;
          planted_date?: string | null;
          progress_percent?: number | null;
          created_at?: string;
          status?: string;
          season?: string | null;
          harvested_at?: string | null;
          completion_notes?: string | null;
          total_harvest?: string | null;
          completion_image_url?: string | null;
        };
        Update: {
          id?: string;
          plot_id?: string | null;
          bed_number?: string;
          dimensions?: string | null;
          student_id?: string | null;
          student_name?: string | null;
          crop_name?: string | null;
          crop_icon?: string | null;
          planted_date?: string | null;
          progress_percent?: number | null;
          created_at?: string;
          status?: string;
          season?: string | null;
          harvested_at?: string | null;
          completion_notes?: string | null;
          total_harvest?: string | null;
          completion_image_url?: string | null;
        };
        Relationships: [];
      };
      crop_records: {
        Row: {
          id: string;
          bed_id: string | null;
          plot_id: string | null;
          date: string;
          crop_name: string | null;
          growth_stage: string | null;
          height_cm: number | null;
          work_types: Json | null;
          notes: string | null;
          harvest_amount: number | null;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          bed_id?: string | null;
          plot_id?: string | null;
          date: string;
          crop_name?: string | null;
          growth_stage?: string | null;
          height_cm?: number | null;
          work_types?: Json | null;
          notes?: string | null;
          harvest_amount?: number | null;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          bed_id?: string | null;
          plot_id?: string | null;
          date?: string;
          crop_name?: string | null;
          growth_stage?: string | null;
          height_cm?: number | null;
          work_types?: Json | null;
          notes?: string | null;
          harvest_amount?: number | null;
          image_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          category: string | null;
          status: string;
          tags: string[] | null;
          video_url: string | null;
          created_by: string | null;
          created_at: string;
          farm_id: string | null;
          is_template: boolean | null;
          updated_at: string | null;
          deleted_at: string | null;
          estimated_time: string | null;
          tools_needed: string | null;
          checklist: Json | null;
          reference_links: string | null;
          memo: string | null;
          target_crop: string | null;
          require_photo: boolean | null;
          exp: number | null;
          difficulty: number | null;
          badge_name?: string | null;
          badge_icon?: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          category?: string | null;
          status?: string;
          tags?: string[] | null;
          video_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          farm_id?: string | null;
          is_template?: boolean | null;
          updated_at?: string | null;
          deleted_at?: string | null;
          estimated_time?: string | null;
          tools_needed?: string | null;
          checklist?: Json | null;
          reference_links?: string | null;
          memo?: string | null;
          target_crop?: string | null;
          require_photo?: boolean | null;
          exp?: number | null;
          difficulty?: number | null;
          badge_name?: string | null;
          badge_icon?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          category?: string | null;
          status?: string;
          tags?: string[] | null;
          video_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          farm_id?: string | null;
          is_template?: boolean | null;
          updated_at?: string | null;
          deleted_at?: string | null;
          estimated_time?: string | null;
          tools_needed?: string | null;
          checklist?: Json | null;
          reference_links?: string | null;
          memo?: string | null;
          target_crop?: string | null;
          require_photo?: boolean | null;
          exp?: number | null;
          difficulty?: number | null;
          badge_name?: string | null;
          badge_icon?: string | null;
        };
        Relationships: [];
      };
      student_tasks: {
        Row: {
          id: string;
          student_id: string;
          base_task_id: string | null;
          title: string;
          description: string | null;
          category: string | null;
          status: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
          estimated_time: string | null;
          tools_needed: string | null;
          checklist: Json | null;
          reference_links: string | null;
          memo: string | null;
          target_crop: string | null;
          require_photo: boolean | null;
          exp: number | null;
          difficulty: number | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          base_task_id?: string | null;
          title: string;
          description?: string | null;
          category?: string | null;
          status?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
          estimated_time?: string | null;
          tools_needed?: string | null;
          checklist?: Json | null;
          reference_links?: string | null;
          memo?: string | null;
          target_crop?: string | null;
          require_photo?: boolean | null;
          exp?: number | null;
          difficulty?: number | null;
        };
        Update: {
          id?: string;
          student_id?: string;
          base_task_id?: string | null;
          title?: string;
          description?: string | null;
          category?: string | null;
          status?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
          estimated_time?: string | null;
          tools_needed?: string | null;
          checklist?: Json | null;
          reference_links?: string | null;
          memo?: string | null;
          target_crop?: string | null;
          require_photo?: boolean | null;
          exp?: number | null;
          difficulty?: number | null;
        };
        Relationships: [];
      };
      journals: {
        Row: {
          id: string;
          student_task_id: string | null;
          user_id: string | null;
          role: string | null;
          text: string | null;
          image_url: string | null;
          audio_url: string | null;
          is_approved: boolean | null;
          is_private: boolean;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
          farm_id: string | null;
          student_id: string | null;
          content: string | null;
          reply: string | null;
          task_title?: string | null;
          photo_url?: string | null;
          plot_code?: string | null;
        };
        Insert: {
          id?: string;
          student_task_id?: string | null;
          user_id?: string | null;
          role?: string | null;
          text?: string | null;
          image_url?: string | null;
          audio_url?: string | null;
          is_approved?: boolean | null;
          is_private?: boolean;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
          farm_id?: string | null;
          student_id?: string | null;
          content?: string | null;
          reply?: string | null;
          task_title?: string | null;
          photo_url?: string | null;
          plot_code?: string | null;
        };
        Update: {
          id?: string;
          student_task_id?: string | null;
          user_id?: string | null;
          role?: string | null;
          text?: string | null;
          image_url?: string | null;
          audio_url?: string | null;
          is_approved?: boolean | null;
          is_private?: boolean;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
          farm_id?: string | null;
          student_id?: string | null;
          content?: string | null;
          reply?: string | null;
          task_title?: string | null;
          photo_url?: string | null;
          plot_code?: string | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          student_id: string;
          amount: number;
          fee_type: string;
          status: string | null;
          due_date: string | null;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          amount: number;
          fee_type: string;
          status?: string | null;
          due_date?: string | null;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          amount?: number;
          fee_type?: string;
          status?: string | null;
          due_date?: string | null;
          paid_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_usage: {
        Row: {
          user_id: string;
          date: string;
          count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          date: string;
          count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          date?: string;
          count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      events: {
        Row: {
          id: string;
          title: string;
          date: string;
          date_display: string | null;
          time: string | null;
          location: string | null;
          farm_id?: string | null;
          capacity: number | null;
          reserved_count: number | null;
          fee: string | null;
          category: string | null;
          description: string | null;
          attendees: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          date: string;
          date_display?: string | null;
          time?: string | null;
          location?: string | null;
          farm_id?: string | null;
          capacity?: number | null;
          reserved_count?: number | null;
          fee?: string | null;
          category?: string | null;
          description?: string | null;
          attendees?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          date?: string;
          date_display?: string | null;
          time?: string | null;
          location?: string | null;
          farm_id?: string | null;
          capacity?: number | null;
          reserved_count?: number | null;
          fee?: string | null;
          category?: string | null;
          description?: string | null;
          attendees?: Json | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          event_id: string;
          student_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          student_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          student_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_tickets: {
        Row: {
          id: string;
          student_id: string;
          date: string;
          granted_count: number;
          count?: number | null;
          updated_at?: string | null;
          granted_by: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          date: string;
          granted_count?: number;
          granted_by?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          date?: string;
          granted_count?: number;
          granted_by?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      farm_beds_with_students: {
        Row: {
          id: string;
          plot_id: string | null;
          bed_number: string;
          dimensions: string | null;
          student_id: string | null;
          student_name: string | null;
          student_email: string | null;
          student_deleted_at: string | null;
          crop_name: string | null;
          crop_icon: string | null;
          planted_date: string | null;
          progress_percent: number | null;
          created_at: string;
          status: string;
          season: string | null;
          harvested_at: string | null;
          completion_notes: string | null;
          total_harvest: string | null;
          completion_image_url: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      grant_ai_tickets: {
        Args: {
          p_student_id: string;
          p_count: number;
        };
        Returns: Json;
      };
      check_and_increment_ai_usage: {
        Args: {
          p_user_id: string;
          p_date: string;
          p_limit?: number;
        };
        Returns: boolean;
      };
      publish_task_to_all_students: {
        Args: {
          p_task_id: string;
        };
        Returns: Json;
      };
      reorder_beds: {
        Args: {
          p_plot_id: string;
          p_bed_ids: string[];
        };
        Returns: void;
      };
      reorder_farm_beds: {
        Args: {
          p_plot_id: string;
          p_bed_ids: string[];
        };
        Returns: void;
      };
      batch_create_student_tasks: {
        Args: {
          p_tasks: Json;
        };
        Returns: Json;
      };
      register_teacher: {
        Args: {
          farm_name: string;
          display_name?: string;
        };
        Returns: Json;
      };
      join_farm: {
        Args: {
          invite_code: string;
          display_name?: string;
        };
        Returns: Json;
      };
      withdraw_student: {
        Args: {
          p_student_id: string;
        };
        Returns: Json;
      };
      get_farm_by_invite_code: {
        Args: {
          target_invite_code: string;
        };
        Returns: {
          farm_id: string;
          farm_name: string;
          teacher_name: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
