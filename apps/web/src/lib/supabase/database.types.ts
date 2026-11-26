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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          bank_name: string | null
          created_at: string
          credit_limit_minor: number
          currency: string
          deleted_at: string | null
          id: string
          initial_balance_minor: number
          is_active: boolean
          last4_digits: string | null
          name: string
          sort_order: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_name?: string | null
          created_at?: string
          credit_limit_minor?: number
          currency?: string
          deleted_at?: string | null
          id?: string
          initial_balance_minor?: number
          is_active?: boolean
          last4_digits?: string | null
          name: string
          sort_order?: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_name?: string | null
          created_at?: string
          credit_limit_minor?: number
          currency?: string
          deleted_at?: string | null
          id?: string
          initial_balance_minor?: number
          is_active?: boolean
          last4_digits?: string | null
          name?: string
          sort_order?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          hint: string | null
          icon: string | null
          id: string
          is_passive: boolean
          kind: string
          monthly_limit_minor: number | null
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          hint?: string | null
          icon?: string | null
          id?: string
          is_passive?: boolean
          kind: string
          monthly_limit_minor?: number | null
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          hint?: string | null
          icon?: string | null
          id?: string
          is_passive?: boolean
          kind?: string
          monthly_limit_minor?: number | null
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          amount_minor: number
          comment: string
          counterparty: string
          created_at: string
          deleted_at: string | null
          direction: string
          due_date: string | null
          id: string
          manual_repaid_minor: number
          opened_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          comment?: string
          counterparty: string
          created_at?: string
          deleted_at?: string | null
          direction: string
          due_date?: string | null
          id?: string
          manual_repaid_minor?: number
          opened_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          comment?: string
          counterparty?: string
          created_at?: string
          deleted_at?: string | null
          direction?: string
          due_date?: string | null
          id?: string
          manual_repaid_minor?: number
          opened_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          admin_preview: boolean
          config: Json
          enabled: boolean
          ends_at: string | null
          key: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          admin_preview?: boolean
          config?: Json
          enabled?: boolean
          ends_at?: string | null
          key: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          admin_preview?: boolean
          config?: Json
          enabled?: boolean
          ends_at?: string | null
          key?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      goal_transfers: {
        Row: {
          amount_minor: number
          comment: string
          created_at: string
          deleted_at: string | null
          from_goal_id: string
          id: string
          occurred_at: string
          to_goal_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          comment?: string
          created_at?: string
          deleted_at?: string | null
          from_goal_id: string
          id?: string
          occurred_at: string
          to_goal_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          comment?: string
          created_at?: string
          deleted_at?: string | null
          from_goal_id?: string
          id?: string
          occurred_at?: string
          to_goal_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_transfers_from_goal_id_fkey"
            columns: ["from_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_transfers_to_goal_id_fkey"
            columns: ["to_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          initial_amount_minor: number
          is_archived: boolean
          monthly_plan_minor: number
          name: string
          priority: string
          sort_order: number
          storage_account_id: string | null
          target_amount_minor: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          initial_amount_minor?: number
          is_archived?: boolean
          monthly_plan_minor?: number
          name: string
          priority?: string
          sort_order?: number
          storage_account_id?: string | null
          target_amount_minor: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          initial_amount_minor?: number
          is_archived?: boolean
          monthly_plan_minor?: number
          name?: string
          priority?: string
          sort_order?: number
          storage_account_id?: string | null
          target_amount_minor?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_storage_account_id_fkey"
            columns: ["storage_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          note: string
          updated_at: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          note?: string
          updated_at?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          note?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          display_name: string
          id: string
          invite_redeemed_at: string | null
          locale: string
          onboarding_completed: boolean
          privacy_blur_default: boolean
          role: string
          theme: string
          updated_at: string
          wrapped_settings: Json
        }
        Insert: {
          base_currency?: string
          created_at?: string
          display_name?: string
          id: string
          invite_redeemed_at?: string | null
          locale?: string
          onboarding_completed?: boolean
          privacy_blur_default?: boolean
          role?: string
          theme?: string
          updated_at?: string
          wrapped_settings?: Json
        }
        Update: {
          base_currency?: string
          created_at?: string
          display_name?: string
          id?: string
          invite_redeemed_at?: string | null
          locale?: string
          onboarding_completed?: boolean
          privacy_blur_default?: boolean
          role?: string
          theme?: string
          updated_at?: string
          wrapped_settings?: Json
        }
        Relationships: []
      }
      recurring_payment_marks: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          marked_at: string
          period_key: string
          recurring_payment_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          marked_at?: string
          period_key: string
          recurring_payment_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          marked_at?: string
          period_key?: string
          recurring_payment_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_payment_marks_recurring_payment_id_fkey"
            columns: ["recurring_payment_id"]
            isOneToOne: false
            referencedRelation: "recurring_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_payments: {
        Row: {
          account_id: string | null
          amount_minor: number
          cadence: string
          category_id: string | null
          created_at: string
          day_of_month: number
          deleted_at: string | null
          id: string
          is_active: boolean
          match_keyword: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount_minor: number
          cadence?: string
          category_id?: string | null
          created_at?: string
          day_of_month: number
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          match_keyword?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount_minor?: number
          cadence?: string
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          match_keyword?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_payments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_rules: {
        Row: {
          account_id: string
          accrual_type: string
          base_rate: number
          capitalization: boolean
          created_at: string
          deleted_at: string | null
          id: string
          min_balance_override_minor: number | null
          promo_end_date: string | null
          promo_rate: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          accrual_type?: string
          base_rate?: number
          capitalization?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          min_balance_override_minor?: number | null
          promo_end_date?: string | null
          promo_rate?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          accrual_type?: string
          base_rate?: number
          capitalization?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          min_balance_override_minor?: number | null
          promo_end_date?: string | null
          promo_rate?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          admin_preview: boolean
          badge_en: string | null
          badge_ru: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          ends_at: string | null
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          starts_at: string | null
          title_en: string
          title_ru: string
          updated_at: string
        }
        Insert: {
          admin_preview?: boolean
          badge_en?: string | null
          badge_ru?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ends_at?: string | null
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          starts_at?: string | null
          title_en: string
          title_ru: string
          updated_at?: string
        }
        Update: {
          admin_preview?: boolean
          badge_en?: string | null
          badge_ru?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ends_at?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          starts_at?: string | null
          title_en?: string
          title_ru?: string
          updated_at?: string
        }
        Relationships: []
      }
      story_slides: {
        Row: {
          accent_token: string | null
          body_en: string
          body_ru: string
          created_at: string
          cta_href: string | null
          cta_label_en: string | null
          cta_label_ru: string | null
          id: string
          media_url: string | null
          slide_order: number
          story_id: string
          title_en: string
          title_ru: string
          updated_at: string
        }
        Insert: {
          accent_token?: string | null
          body_en?: string
          body_ru?: string
          created_at?: string
          cta_href?: string | null
          cta_label_en?: string | null
          cta_label_ru?: string | null
          id?: string
          media_url?: string | null
          slide_order?: number
          story_id: string
          title_en: string
          title_ru: string
          updated_at?: string
        }
        Update: {
          accent_token?: string | null
          body_en?: string
          body_ru?: string
          created_at?: string
          cta_href?: string | null
          cta_label_en?: string | null
          cta_label_ru?: string | null
          id?: string
          media_url?: string | null
          slide_order?: number
          story_id?: string
          title_en?: string
          title_ru?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_slides_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          story_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          story_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_from_id: string | null
          account_to_id: string | null
          amount_minor: number
          category_id: string | null
          comment: string
          created_at: string
          debt_id: string | null
          deleted_at: string | null
          external_hash: string | null
          goal_id: string | null
          id: string
          occurred_at: string
          recurring_payment_id: string | null
          source: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_from_id?: string | null
          account_to_id?: string | null
          amount_minor: number
          category_id?: string | null
          comment?: string
          created_at?: string
          debt_id?: string | null
          deleted_at?: string | null
          external_hash?: string | null
          goal_id?: string | null
          id?: string
          occurred_at: string
          recurring_payment_id?: string | null
          source?: string
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_from_id?: string | null
          account_to_id?: string | null
          amount_minor?: number
          category_id?: string | null
          comment?: string
          created_at?: string
          debt_id?: string | null
          deleted_at?: string | null
          external_hash?: string | null
          goal_id?: string | null
          id?: string
          occurred_at?: string
          recurring_payment_id?: string | null
          source?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_from_id_fkey"
            columns: ["account_from_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_to_id_fkey"
            columns: ["account_to_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_payment_id_fkey"
            columns: ["recurring_payment_id"]
            isOneToOne: false
            referencedRelation: "recurring_payments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_telemetry: { Args: never; Returns: Json }
      get_my_auth_state: {
        Args: never
        Returns: {
          current_aal: string
          mfa_enrolled: boolean
          mfa_required: boolean
          session_active: boolean
          session_id: string
        }[]
      }
      get_my_sessions: {
        Args: never
        Returns: {
          aal: string
          created_at: string
          id: string
          ip: string
          is_current: boolean
          not_after: string
          refreshed_at: string
          updated_at: string
          user_agent: string
        }[]
      }
      redeem_invite_code: { Args: { p_code: string }; Returns: string }
      revoke_my_session: { Args: { p_session_id: string }; Returns: boolean }
      revoke_other_sessions: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
