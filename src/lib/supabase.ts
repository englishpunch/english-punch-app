import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      cards: {
        Row: {
          id: string
          question: string
          answer: string
          hint?: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          question: string
          answer: string
          hint?: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          question?: string
          answer?: string
          hint?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
      }
      reviews: {
        Row: {
          id: string
          card_id: string
          user_id: string
          grade: number
          elapsed_days: number
          scheduled_days: number
          reps: number
          lapses: number
          state: number
          last_review: string
          due: string
          stability: number
          difficulty: number
          retrievability: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          card_id: string
          user_id: string
          grade: number
          elapsed_days: number
          scheduled_days: number
          reps: number
          lapses: number
          state: number
          last_review: string
          due: string
          stability: number
          difficulty: number
          retrievability: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          card_id?: string
          user_id?: string
          grade?: number
          elapsed_days?: number
          scheduled_days?: number
          reps?: number
          lapses?: number
          state?: number
          last_review?: string
          due?: string
          stability?: number
          difficulty?: number
          retrievability?: number
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          display_name?: string
          avatar_url?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string
          avatar_url?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}