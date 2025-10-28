export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      ai_questions: {
        Row: {
          answer: string | null
          created_at: string | null
          id: string
          question: string | null
          session_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string | null
          id?: string
          question?: string | null
          session_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string | null
          id?: string
          question?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "patent_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ai_questions_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "patent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      application_payments: {
        Row: {
          amount: number
          application_id: string | null
          created_at: string | null
          currency: string
          id: string
          status: string
          stripe_payment_id: string | null
          stripe_session_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          application_id?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          status?: string
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          application_id?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          status?: string
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_payments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "patent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_iterations: {
        Row: {
          content: string | null
          created_at: string
          critique: string | null
          id: string
          iteration_number: number
          quality_score: number | null
          section_type: string
          session_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          critique?: string | null
          id?: string
          iteration_number: number
          quality_score?: number | null
          section_type: string
          session_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          critique?: string | null
          id?: string
          iteration_number?: number
          quality_score?: number | null
          section_type?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_iterations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "patent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notifications: {
        Row: {
          content: string | null
          created_at: string
          email_type: string
          id: string
          metadata: Json | null
          recipient_email: string
          sent_at: string | null
          status: string | null
          subject: string
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          email_type: string
          id?: string
          metadata?: Json | null
          recipient_email: string
          sent_at?: string | null
          status?: string | null
          subject: string
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          email_type?: string
          id?: string
          metadata?: Json | null
          recipient_email?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      infringement_alerts: {
        Row: {
          alert_type: string
          confidence_score: number | null
          created_at: string
          description: string | null
          id: string
          is_read: boolean | null
          metadata: Json | null
          patent_idea_id: string | null
          patent_session_id: string | null
          severity: string | null
          source_url: string | null
          title: string
        }
        Insert: {
          alert_type: string
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          patent_idea_id?: string | null
          patent_session_id?: string | null
          severity?: string | null
          source_url?: string | null
          title: string
        }
        Update: {
          alert_type?: string
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          patent_idea_id?: string | null
          patent_session_id?: string | null
          severity?: string | null
          source_url?: string | null
          title?: string
        }
        Relationships: []
      }
      patent_documents: {
        Row: {
          ai_analysis: string | null
          created_at: string
          document_type: string
          extraction_data: Json | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          patent_idea_id: string | null
          patent_session_id: string | null
        }
        Insert: {
          ai_analysis?: string | null
          created_at?: string
          document_type: string
          extraction_data?: Json | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          patent_idea_id?: string | null
          patent_session_id?: string | null
        }
        Update: {
          ai_analysis?: string | null
          created_at?: string
          document_type?: string
          extraction_data?: Json | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          patent_idea_id?: string | null
          patent_session_id?: string | null
        }
        Relationships: []
      }
      patent_ideas: {
        Row: {
          created_at: string
          data_source: Json | null
          description: string | null
          id: string
          last_monitored_at: string | null
          patent_type: string
          prior_art_monitoring: boolean | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_source?: Json | null
          description?: string | null
          id?: string
          last_monitored_at?: string | null
          patent_type: string
          prior_art_monitoring?: boolean | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_source?: Json | null
          description?: string | null
          id?: string
          last_monitored_at?: string | null
          patent_type?: string
          prior_art_monitoring?: boolean | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patent_sections: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_user_edited: boolean | null
          section_type: string | null
          session_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_user_edited?: boolean | null
          section_type?: string | null
          session_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_user_edited?: boolean | null
          section_type?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_patent_sections_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "patent_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patent_sections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "patent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      patent_sessions: {
        Row: {
          ai_analysis_complete: boolean | null
          created_at: string | null
          data_source: Json | null
          download_url: string | null
          id: string
          idea_prompt: string | null
          patent_type: string | null
          patentability_score: number | null
          status: string | null
          technical_analysis: string | null
          user_id: string
          visual_analysis: Json | null
        }
        Insert: {
          ai_analysis_complete?: boolean | null
          created_at?: string | null
          data_source?: Json | null
          download_url?: string | null
          id?: string
          idea_prompt?: string | null
          patent_type?: string | null
          patentability_score?: number | null
          status?: string | null
          technical_analysis?: string | null
          user_id: string
          visual_analysis?: Json | null
        }
        Update: {
          ai_analysis_complete?: boolean | null
          created_at?: string | null
          data_source?: Json | null
          download_url?: string | null
          id?: string
          idea_prompt?: string | null
          patent_type?: string | null
          patentability_score?: number | null
          status?: string | null
          technical_analysis?: string | null
          user_id?: string
          visual_analysis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "patent_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          application_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          metadata: Json | null
          payment_type: string
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          application_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_type: string
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          application_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_type?: string
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      prior_art_monitoring: {
        Row: {
          created_at: string
          highest_similarity_score: number | null
          id: string
          is_active: boolean | null
          last_search_at: string
          monitoring_data: Json | null
          new_results_count: number | null
          next_search_at: string | null
          patent_idea_id: string | null
          patent_session_id: string | null
          results_found: number | null
          search_query: string
        }
        Insert: {
          created_at?: string
          highest_similarity_score?: number | null
          id?: string
          is_active?: boolean | null
          last_search_at?: string
          monitoring_data?: Json | null
          new_results_count?: number | null
          next_search_at?: string | null
          patent_idea_id?: string | null
          patent_session_id?: string | null
          results_found?: number | null
          search_query: string
        }
        Update: {
          created_at?: string
          highest_similarity_score?: number | null
          id?: string
          is_active?: boolean | null
          last_search_at?: string
          monitoring_data?: Json | null
          new_results_count?: number | null
          next_search_at?: string | null
          patent_idea_id?: string | null
          patent_session_id?: string | null
          results_found?: number | null
          search_query?: string
        }
        Relationships: []
      }
      prior_art_results: {
        Row: {
          assignee: string | null
          created_at: string | null
          difference_claims: string[] | null
          embedding: string | null
          id: string
          overlap_claims: string[] | null
          patent_date: string | null
          publication_number: string | null
          session_id: string
          similarity_score: number | null
          source: string | null
          summary: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          assignee?: string | null
          created_at?: string | null
          difference_claims?: string[] | null
          embedding?: string | null
          id?: string
          overlap_claims?: string[] | null
          patent_date?: string | null
          publication_number?: string | null
          session_id: string
          similarity_score?: number | null
          source?: string | null
          summary?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          assignee?: string | null
          created_at?: string | null
          difference_claims?: string[] | null
          embedding?: string | null
          id?: string
          overlap_claims?: string[] | null
          patent_date?: string | null
          publication_number?: string | null
          session_id?: string
          similarity_score?: number | null
          source?: string | null
          summary?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_prior_art_results_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "patent_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prior_art_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "patent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      supabase_connections: {
        Row: {
          access_token: string
          connection_metadata: Json | null
          connection_status: string | null
          created_at: string
          id: string
          is_active: boolean | null
          organization_id: string
          project_name: string | null
          project_ref: string | null
          project_region: string | null
          refresh_token: string | null
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connection_metadata?: Json | null
          connection_status?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id: string
          project_name?: string | null
          project_ref?: string | null
          project_region?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connection_metadata?: Json | null
          connection_status?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          project_name?: string | null
          project_ref?: string | null
          project_region?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_search_credits: {
        Row: {
          created_at: string
          free_searches_remaining: number
          id: string
          last_search_at: string | null
          searches_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          free_searches_remaining?: number
          id?: string
          last_search_at?: string | null
          searches_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          free_searches_remaining?: number
          id?: string
          last_search_at?: string | null
          searches_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          email_preferences: Json | null
          id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          email_preferences?: Json | null
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          email_preferences?: Json | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_paid_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
