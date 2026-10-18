export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_tickets: {
        Row: {
          count: number;
          created_at: string;
          date: string;
          granted_count: number;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          count?: number;
          created_at?: string;
          date?: string;
          granted_count?: number;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          date?: string;
          granted_count?: number;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_tickets_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_usage_events: {
        Row: {
          finalized_at: string | null;
          id: string;
          reserved_at: string;
          status: string;
          usage_date: string;
          user_id: string;
        };
        Insert: {
          finalized_at?: string | null;
          id?: string;
          reserved_at?: string;
          status: string;
          usage_date: string;
          user_id: string;
        };
        Update: {
          finalized_at?: string | null;
          id?: string;
          reserved_at?: string;
          status?: string;
          usage_date?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_usage_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      announcements: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          farm_id: string;
          id: string;
          target_student_id: string | null;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          farm_id: string;
          id?: string;
          target_student_id?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          farm_id?: string;
          id?: string;
          target_student_id?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'announcements_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'announcements_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'announcements_target_student_id_fkey';
            columns: ['target_student_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      crop_records: {
        Row: {
          bed_id: string | null;
          created_at: string;
          crop_name: string | null;
          date: string;
          growth_stage: string | null;
          harvest_amount: number | null;
          height_cm: number | null;
          id: string;
          image_url: string | null;
          notes: string | null;
          photo_url: string | null;
          plot_id: string | null;
          work_types: string[] | null;
        };
        Insert: {
          bed_id?: string | null;
          created_at?: string;
          crop_name?: string | null;
          date?: string;
          growth_stage?: string | null;
          harvest_amount?: number | null;
          height_cm?: number | null;
          id: string;
          image_url?: string | null;
          notes?: string | null;
          photo_url?: string | null;
          plot_id?: string | null;
          work_types?: string[] | null;
        };
        Update: {
          bed_id?: string | null;
          created_at?: string;
          crop_name?: string | null;
          date?: string;
          growth_stage?: string | null;
          harvest_amount?: number | null;
          height_cm?: number | null;
          id?: string;
          image_url?: string | null;
          notes?: string | null;
          photo_url?: string | null;
          plot_id?: string | null;
          work_types?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'crop_records_bed_id_fkey';
            columns: ['bed_id'];
            isOneToOne: false;
            referencedRelation: 'farm_beds';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'crop_records_plot_id_fkey';
            columns: ['plot_id'];
            isOneToOne: false;
            referencedRelation: 'farm_plots';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          attendees: Json | null;
          capacity: number | null;
          category: string | null;
          created_at: string;
          date: string;
          date_display: string | null;
          description: string | null;
          farm_id: string | null;
          fee: string | null;
          id: string;
          location: string | null;
          reserved_count: number | null;
          time: string | null;
          title: string;
        };
        Insert: {
          attendees?: Json | null;
          capacity?: number | null;
          category?: string | null;
          created_at?: string;
          date: string;
          date_display?: string | null;
          description?: string | null;
          farm_id?: string | null;
          fee?: string | null;
          id: string;
          location?: string | null;
          reserved_count?: number | null;
          time?: string | null;
          title: string;
        };
        Update: {
          attendees?: Json | null;
          capacity?: number | null;
          category?: string | null;
          created_at?: string;
          date?: string;
          date_display?: string | null;
          description?: string | null;
          farm_id?: string | null;
          fee?: string | null;
          id?: string;
          location?: string | null;
          reserved_count?: number | null;
          time?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      farm_beds: {
        Row: {
          bed_number: string;
          completion_image_url: string | null;
          completion_notes: string | null;
          created_at: string;
          crop_icon: string | null;
          crop_name: string | null;
          dimensions: string | null;
          harvested_at: string | null;
          id: string;
          planted_date: string | null;
          plot_id: string;
          progress_percent: number | null;
          season: string | null;
          status: string;
          student_id: string | null;
          student_name: string | null;
          total_harvest: string | null;
          updated_at: string | null;
        };
        Insert: {
          bed_number: string;
          completion_image_url?: string | null;
          completion_notes?: string | null;
          created_at?: string;
          crop_icon?: string | null;
          crop_name?: string | null;
          dimensions?: string | null;
          harvested_at?: string | null;
          id: string;
          planted_date?: string | null;
          plot_id: string;
          progress_percent?: number | null;
          season?: string | null;
          status?: string;
          student_id?: string | null;
          student_name?: string | null;
          total_harvest?: string | null;
          updated_at?: string | null;
        };
        Update: {
          bed_number?: string;
          completion_image_url?: string | null;
          completion_notes?: string | null;
          created_at?: string;
          crop_icon?: string | null;
          crop_name?: string | null;
          dimensions?: string | null;
          harvested_at?: string | null;
          id?: string;
          planted_date?: string | null;
          plot_id?: string;
          progress_percent?: number | null;
          season?: string | null;
          status?: string;
          student_id?: string | null;
          student_name?: string | null;
          total_harvest?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'farm_beds_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_farm_beds_plot_id';
            columns: ['plot_id'];
            isOneToOne: false;
            referencedRelation: 'farm_plots';
            referencedColumns: ['id'];
          },
        ];
      };
      farm_plots: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          farm_id: string | null;
          id: string;
          is_vacant: boolean | null;
          name: string;
          student_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          farm_id?: string | null;
          id: string;
          is_vacant?: boolean | null;
          name: string;
          student_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          farm_id?: string | null;
          id?: string;
          is_vacant?: boolean | null;
          name?: string;
          student_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'farm_plots_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'farm_plots_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      farms: {
        Row: {
          address: string | null;
          created_at: string;
          deleted_at: string | null;
          grid_cols: number;
          grid_rows: number;
          id: string;
          invite_code: string | null;
          latitude: number | null;
          longitude: number | null;
          name: string;
          owner_id: string | null;
          preset_faqs: Json | null;
          show_student_talk_tab: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          grid_cols?: number;
          grid_rows?: number;
          id?: string;
          invite_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          owner_id?: string | null;
          preset_faqs?: Json | null;
          show_student_talk_tab?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          grid_cols?: number;
          grid_rows?: number;
          id?: string;
          invite_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          owner_id?: string | null;
          preset_faqs?: Json | null;
          show_student_talk_tab?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_farms_owner';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      journals: {
        Row: {
          audio_url: string | null;
          content: string | null;
          created_at: string;
          deleted_at: string | null;
          farm_id: string | null;
          id: string;
          image_url: string | null;
          is_approved: boolean | null;
          is_private: boolean;
          reply: string | null;
          role: string | null;
          student_id: string | null;
          student_task_id: string | null;
          text: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          audio_url?: string | null;
          content?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          farm_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_approved?: boolean | null;
          is_private?: boolean;
          reply?: string | null;
          role?: string | null;
          student_id?: string | null;
          student_task_id?: string | null;
          text?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          audio_url?: string | null;
          content?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          farm_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_approved?: boolean | null;
          is_private?: boolean;
          reply?: string | null;
          role?: string | null;
          student_id?: string | null;
          student_task_id?: string | null;
          text?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'journals_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'journals_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'journals_student_task_id_fkey';
            columns: ['student_task_id'];
            isOneToOne: false;
            referencedRelation: 'student_tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'journals_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          due_date: string | null;
          fee_type: string;
          id: string;
          paid_at: string | null;
          status: string | null;
          student_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          due_date?: string | null;
          fee_type: string;
          id?: string;
          paid_at?: string | null;
          status?: string | null;
          student_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          due_date?: string | null;
          fee_type?: string;
          id?: string;
          paid_at?: string | null;
          status?: string | null;
          student_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      reservations: {
        Row: {
          created_at: string;
          event_id: string | null;
          id: string;
          student_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_id?: string | null;
          id?: string;
          student_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_id?: string | null;
          id?: string;
          student_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reservations_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservations_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      student_tasks: {
        Row: {
          base_task_id: string | null;
          category: string | null;
          checklist: Json | null;
          completed_at: string | null;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          difficulty: number | null;
          estimated_time: string | null;
          exp: number | null;
          id: string;
          memo: string | null;
          reference_links: string | null;
          require_photo: boolean | null;
          status: string;
          student_id: string;
          target_crop: string | null;
          title: string;
          tools_needed: string | null;
          updated_at: string | null;
        };
        Insert: {
          base_task_id?: string | null;
          category?: string | null;
          checklist?: Json | null;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          difficulty?: number | null;
          estimated_time?: string | null;
          exp?: number | null;
          id?: string;
          memo?: string | null;
          reference_links?: string | null;
          require_photo?: boolean | null;
          status?: string;
          student_id: string;
          target_crop?: string | null;
          title: string;
          tools_needed?: string | null;
          updated_at?: string | null;
        };
        Update: {
          base_task_id?: string | null;
          category?: string | null;
          checklist?: Json | null;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          difficulty?: number | null;
          estimated_time?: string | null;
          exp?: number | null;
          id?: string;
          memo?: string | null;
          reference_links?: string | null;
          require_photo?: boolean | null;
          status?: string;
          student_id?: string;
          target_crop?: string | null;
          title?: string;
          tools_needed?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'student_tasks_base_task_id_fkey';
            columns: ['base_task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'student_tasks_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          category: string | null;
          checklist: Json | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          difficulty: number | null;
          estimated_time: string | null;
          exp: number | null;
          farm_id: string | null;
          id: string;
          is_template: boolean | null;
          memo: string | null;
          reference_links: string | null;
          require_photo: boolean | null;
          status: string;
          tags: string[] | null;
          target_crop: string | null;
          title: string;
          tools_needed: string | null;
          updated_at: string | null;
          video_url: string | null;
        };
        Insert: {
          category?: string | null;
          checklist?: Json | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          difficulty?: number | null;
          estimated_time?: string | null;
          exp?: number | null;
          farm_id?: string | null;
          id?: string;
          is_template?: boolean | null;
          memo?: string | null;
          reference_links?: string | null;
          require_photo?: boolean | null;
          status?: string;
          tags?: string[] | null;
          target_crop?: string | null;
          title?: string;
          tools_needed?: string | null;
          updated_at?: string | null;
          video_url?: string | null;
        };
        Update: {
          category?: string | null;
          checklist?: Json | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          difficulty?: number | null;
          estimated_time?: string | null;
          exp?: number | null;
          farm_id?: string | null;
          id?: string;
          is_template?: boolean | null;
          memo?: string | null;
          reference_links?: string | null;
          require_photo?: boolean | null;
          status?: string;
          tags?: string[] | null;
          target_crop?: string | null;
          title?: string;
          tools_needed?: string | null;
          updated_at?: string | null;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          display_name: string | null;
          email: string | null;
          farm_id: string | null;
          id: string;
          line_user_id: string | null;
          role: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string | null;
          email?: string | null;
          farm_id?: string | null;
          id: string;
          line_user_id?: string | null;
          role?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string | null;
          email?: string | null;
          farm_id?: string | null;
          id?: string;
          line_user_id?: string | null;
          role?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'users_farm_id_fkey';
            columns: ['farm_id'];
            isOneToOne: false;
            referencedRelation: 'farms';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      farm_beds_with_students: {
        Row: {
          bed_number: string | null;
          completion_image_url: string | null;
          completion_notes: string | null;
          created_at: string | null;
          crop_icon: string | null;
          crop_name: string | null;
          dimensions: string | null;
          harvested_at: string | null;
          id: string | null;
          planted_date: string | null;
          plot_id: string | null;
          progress_percent: number | null;
          season: string | null;
          status: string | null;
          student_deleted_at: string | null;
          student_email: string | null;
          student_id: string | null;
          student_name: string | null;
          total_harvest: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_farm_beds_plot_id';
            columns: ['plot_id'];
            isOneToOne: false;
            referencedRelation: 'farm_plots';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      add_farm_bed: {
        Args: { p_crop_name?: string; p_plot_id: string; p_season?: string };
        Returns: Json;
      };
      complete_student_task: {
        Args: { p_base_task_id: string; p_task_title?: string };
        Returns: Json;
      };
      current_user_farm_id: { Args: never; Returns: string };
      current_user_role: { Args: never; Returns: string };
      delete_farm_bed: {
        Args: { p_bed_id: string; p_plot_id: string };
        Returns: Json;
      };
      finalize_ai_usage: {
        Args: { p_commit: boolean; p_id: string };
        Returns: undefined;
      };
      get_ai_ticket_status: { Args: never; Returns: Json };
      get_farm_by_invite_code: {
        Args: { target_invite_code: string };
        Returns: {
          farm_id: string;
          farm_name: string;
          teacher_name: string;
        }[];
      };
      grant_ai_tickets: {
        Args: { p_count?: number; p_student_id: string };
        Returns: Json;
      };
      join_farm: { Args: { invite_code: string }; Returns: Json };
      list_farm_member_names: {
        Args: never;
        Returns: {
          display_name: string;
        }[];
      };
      publish_task_to_all_students: {
        Args: { p_task_id: string };
        Returns: undefined;
      };
      register_teacher: { Args: { farm_name: string }; Returns: Json };
      reorder_beds: {
        Args: { p_bed_ids: string[]; p_plot_id: string };
        Returns: undefined;
      };
      reserve_ai_usage: { Args: never; Returns: string };
      save_ai_journal: {
        Args: {
          p_content: string;
          p_is_private?: boolean;
          p_reply?: string;
          p_student_id: string;
        };
        Returns: Json;
      };
      search_knowledge_candidates: {
        Args: { p_limit?: number };
        Returns: {
          created_at: string;
          id: string;
          reply: string;
        }[];
      };
      swap_farm_plots: {
        Args: { p_from_plot_id: string; p_to_plot_id: string };
        Returns: Json;
      };
      sync_student_published_tasks: { Args: never; Returns: Json };
      uncomplete_student_task: {
        Args: { p_base_task_id: string };
        Returns: Json;
      };
      withdraw_student: { Args: { p_student_id: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
