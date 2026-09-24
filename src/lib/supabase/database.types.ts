export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      extraction_logs: {
        Row: {
          created_at: string
          id: string
          outcome: string
          url_normalized: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          outcome: string
          url_normalized: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          outcome?: string
          url_normalized?: string
          user_id?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          deadline: string | null
          deadline_type: Database["public"]["Enums"]["deadline_type"]
          eligibility: string[]
          field: string | null
          funding: string | null
          id: string
          is_hidden: boolean
          location: string | null
          opens_at: string | null
          organization: string | null
          status_override: Database["public"]["Enums"]["program_status"] | null
          submitter_id: string | null
          title: string
          type: Database["public"]["Enums"]["program_type"]
          updated_at: string
          url: string
          url_normalized: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          deadline_type?: Database["public"]["Enums"]["deadline_type"]
          eligibility?: string[]
          field?: string | null
          funding?: string | null
          id?: string
          is_hidden?: boolean
          location?: string | null
          opens_at?: string | null
          organization?: string | null
          status_override?: Database["public"]["Enums"]["program_status"] | null
          submitter_id?: string | null
          title: string
          type: Database["public"]["Enums"]["program_type"]
          updated_at?: string
          url: string
          url_normalized: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          deadline_type?: Database["public"]["Enums"]["deadline_type"]
          eligibility?: string[]
          field?: string | null
          funding?: string | null
          id?: string
          is_hidden?: boolean
          location?: string | null
          opens_at?: string | null
          organization?: string | null
          status_override?: Database["public"]["Enums"]["program_status"] | null
          submitter_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["program_type"]
          updated_at?: string
          url?: string
          url_normalized?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          program_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          reason: string
          reporter_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      programs_public: {
        Row: {
          created_at: string | null
          deadline: string | null
          deadline_type: Database["public"]["Enums"]["deadline_type"] | null
          eligibility: string[] | null
          field: string | null
          funding: string | null
          id: string | null
          location: string | null
          opens_at: string | null
          organization: string | null
          status: Database["public"]["Enums"]["program_status"] | null
          status_override: Database["public"]["Enums"]["program_status"] | null
          submitter_id: string | null
          title: string | null
          type: Database["public"]["Enums"]["program_type"] | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          deadline?: string | null
          deadline_type?: Database["public"]["Enums"]["deadline_type"] | null
          eligibility?: string[] | null
          field?: string | null
          funding?: string | null
          id?: string | null
          location?: string | null
          opens_at?: string | null
          organization?: string | null
          status?: never
          status_override?: Database["public"]["Enums"]["program_status"] | null
          submitter_id?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["program_type"] | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          deadline?: string | null
          deadline_type?: Database["public"]["Enums"]["deadline_type"] | null
          eligibility?: string[] | null
          field?: string | null
          funding?: string | null
          id?: string | null
          location?: string | null
          opens_at?: string | null
          organization?: string | null
          status?: never
          status_override?: Database["public"]["Enums"]["program_status"] | null
          submitter_id?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["program_type"] | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      deadline_type: "FIXED" | "ROLLING" | "UNKNOWN"
      program_status: "OPEN" | "CLOSED" | "UPCOMING"
      program_type: "INTERNSHIP" | "FELLOWSHIP" | "PROGRAM" | "OTHER"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      deadline_type: ["FIXED", "ROLLING", "UNKNOWN"],
      program_status: ["OPEN", "CLOSED", "UPCOMING"],
      program_type: ["INTERNSHIP", "FELLOWSHIP", "PROGRAM", "OTHER"],
    },
  },
} as const

