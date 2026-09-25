export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          role: 'teacher' | 'student'
          display_name: string | null
          line_user_id: string | null
          created_at: string
          farm_id: string | null
          updated_at: string | null
          deleted_at: string | null
          email: string | null
        }
        Insert: {
          id: string
          role?: 'teacher' | 'student'
          display_name?: string | null
          line_user_id?: string | null
          created_at?: string
          farm_id?: string | null
          updated_at?: string | null
          deleted_at?: string | null
          email?: string | null
        }
        Update: {
          id?: string
          role?: 'teacher' | 'student'
          display_name?: string | null
          line_user_id?: string | null
          created_at?: string
          farm_id?: string | null
          updated_at?: string | null
          deleted_at?: string | null
          email?: string | null
        }
      }
      farms: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string | null
          deleted_at: string | null
          owner_id: string | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string | null
          deleted_at?: string | null
          owner_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string | null
          deleted_at?: string | null
          owner_id?: string | null
        }
      }
      farm_plots: {
        Row: {
          id: string
          name: string
          code: string
          description: string | null
          created_at: string
          student_id: string | null
        }
        Insert: {
          id?: string
          name: string
          code: string
          description?: string | null
          created_at?: string
          student_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string | null
          created_at?: string
          student_id?: string | null
        }
      }
      farm_beds: {
        Row: {
          id: string
          plot_id: string
          bed_number: string
          dimensions: string | null
          student_id: string | null
          student_name: string | null
          crop_name: string | null
          crop_icon: string | null
          planted_date: string | null
          progress_percent: number | null
          created_at: string
          status: string
          season: string | null
          harvested_at: string | null
          completion_notes: string | null
          total_harvest: string | null
          completion_image_url: string | null
        }
        Insert: {
          id?: string
          plot_id: string
          bed_number: string
          dimensions?: string | null
          student_id?: string | null
          student_name?: string | null
          crop_name?: string | null
          crop_icon?: string | null
          planted_date?: string | null
          progress_percent?: number | null
          created_at?: string
          status?: string
          season?: string | null
          harvested_at?: string | null
          completion_notes?: string | null
          total_harvest?: string | null
          completion_image_url?: string | null
        }
        Update: {
          id?: string
          plot_id?: string
          bed_number?: string
          dimensions?: string | null
          student_id?: string | null
          student_name?: string | null
          crop_name?: string | null
          crop_icon?: string | null
          planted_date?: string | null
          progress_percent?: number | null
          created_at?: string
          status?: string
          season?: string | null
          harvested_at?: string | null
          completion_notes?: string | null
          total_harvest?: string | null
          completion_image_url?: string | null
        }
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          category: string | null
          status: string
          tags: string[] | null
          video_url: string | null
          created_by: string | null
          created_at: string
          farm_id: string | null
          is_template: boolean | null
          updated_at: string | null
          deleted_at: string | null
          estimated_time: string | null
          tools_needed: string | null
          checklist: Json | null
          reference_links: string | null
          memo: string | null
          target_crop: string | null
          require_photo: boolean | null
          exp: number | null
          difficulty: number | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          category?: string | null
          status?: string
          tags?: string[] | null
          video_url?: string | null
          created_by?: string | null
          created_at?: string
          farm_id?: string | null
          is_template?: boolean | null
          updated_at?: string | null
          deleted_at?: string | null
          estimated_time?: string | null
          tools_needed?: string | null
          checklist?: Json | null
          reference_links?: string | null
          memo?: string | null
          target_crop?: string | null
          require_photo?: boolean | null
          exp?: number | null
          difficulty?: number | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          category?: string | null
          status?: string
          tags?: string[] | null
          video_url?: string | null
          created_by?: string | null
          created_at?: string
          farm_id?: string | null
          is_template?: boolean | null
          updated_at?: string | null
          deleted_at?: string | null
          estimated_time?: string | null
          tools_needed?: string | null
          checklist?: Json | null
          reference_links?: string | null
          memo?: string | null
          target_crop?: string | null
          require_photo?: boolean | null
          exp?: number | null
          difficulty?: number | null
        }
      }
      student_tasks: {
        Row: {
          id: string
          student_id: string
          base_task_id: string | null
          title: string
          category: string | null
          status: string
          completed_at: string | null
          created_at: string
          updated_at: string | null
          deleted_at: string | null
          estimated_time: string | null
          tools_needed: string | null
          checklist: Json | null
          reference_links: string | null
          memo: string | null
          target_crop: string | null
          require_photo: boolean | null
          exp: number | null
          difficulty: number | null
        }
        Insert: {
          id?: string
          student_id: string
          base_task_id?: string | null
          title: string
          category?: string | null
          status?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string | null
          deleted_at?: string | null
          estimated_time?: string | null
          tools_needed?: string | null
          checklist?: Json | null
          reference_links?: string | null
          memo?: string | null
          target_crop?: string | null
          require_photo?: boolean | null
          exp?: number | null
          difficulty?: number | null
        }
        Update: {
          id?: string
          student_id?: string
          base_task_id?: string | null
          title?: string
          category?: string | null
          status?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string | null
          deleted_at?: string | null
          estimated_time?: string | null
          tools_needed?: string | null
          checklist?: Json | null
          reference_links?: string | null
          memo?: string | null
          target_crop?: string | null
          require_photo?: boolean | null
          exp?: number | null
          difficulty?: number | null
        }
      }
      journals: {
        Row: {
          id: string
          student_task_id: string | null
          user_id: string | null
          role: string | null
          text: string | null
          image_url: string | null
          audio_url: string | null
          is_approved: boolean | null
          created_at: string
          updated_at: string | null
          deleted_at: string | null
          farm_id: string | null
          student_id: string | null
          content: string | null
          reply: string | null
        }
        Insert: {
          id?: string
          student_task_id?: string | null
          user_id?: string | null
          role?: string | null
          text?: string | null
          image_url?: string | null
          audio_url?: string | null
          is_approved?: boolean | null
          created_at?: string
          updated_at?: string | null
          deleted_at?: string | null
          farm_id?: string | null
          student_id?: string | null
          content?: string | null
          reply?: string | null
        }
        Update: {
          id?: string
          student_task_id?: string | null
          user_id?: string | null
          role?: string | null
          text?: string | null
          image_url?: string | null
          audio_url?: string | null
          is_approved?: boolean | null
          created_at?: string
          updated_at?: string | null
          deleted_at?: string | null
          farm_id?: string | null
          student_id?: string | null
          content?: string | null
          reply?: string | null
        }
      }
      events: {
        Row: {
          id: string
          title: string
          date: string
          date_display: string | null
          time: string | null
          location: string | null
          capacity: number | null
          reserved_count: number | null
          fee: string | null
          category: string | null
          description: string | null
          attendees: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          title: string
          date: string
          date_display?: string | null
          time?: string | null
          location?: string | null
          capacity?: number | null
          reserved_count?: number | null
          fee?: string | null
          category?: string | null
          description?: string | null
          attendees?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          date?: string
          date_display?: string | null
          time?: string | null
          location?: string | null
          capacity?: number | null
          reserved_count?: number | null
          fee?: string | null
          category?: string | null
          description?: string | null
          attendees?: Json | null
          created_at?: string | null
        }
      }
    }
    Views: {
      farm_beds_with_students: {
        Row: {
          id: string
          plot_id: string
          bed_number: string
          dimensions: string | null
          student_id: string | null
          student_name: string | null
          student_email: string | null
          student_deleted_at: string | null
          crop_name: string | null
          crop_icon: string | null
          planted_date: string | null
          progress_percent: number | null
          created_at: string
          status: string
          season: string | null
          harvested_at: string | null
          completion_notes: string | null
          total_harvest: string | null
          completion_image_url: string | null
        }
      }
    }
  }
}
