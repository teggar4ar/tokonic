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
      login_rate_limit_buckets: {
        Row: {
          attempt_count: number
          bucket_type: string
          expires_at: string
          key_digest: string
          window_started_at: string
        }
        Insert: {
          attempt_count: number
          bucket_type: string
          expires_at: string
          key_digest: string
          window_started_at: string
        }
        Update: {
          attempt_count?: number
          bucket_type?: string
          expires_at?: string
          key_digest?: string
          window_started_at?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          bucket: string
          byte_size: number
          created_at: string
          display_order: number
          height: number | null
          id: string
          mime_type: string
          object_path: string
          product_id: string
          width: number | null
        }
        Insert: {
          bucket: string
          byte_size: number
          created_at?: string
          display_order: number
          height?: number | null
          id?: string
          mime_type: string
          object_path: string
          product_id: string
          width?: number | null
        }
        Update: {
          bucket?: string
          byte_size?: number
          created_at?: string
          display_order?: number
          height?: number | null
          id?: string
          mime_type?: string
          object_path?: string
          product_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string
          id: string
          is_published: boolean
          name: string
          price: number
          seller_id: string
          slug: string
          stock: number
          updated_at: string
          weight_grams: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          name: string
          price: number
          seller_id: string
          slug: string
          stock: number
          updated_at?: string
          weight_grams: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          name?: string
          price?: number
          seller_id?: string
          slug?: string
          stock?: number
          updated_at?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          auth_user_id: string
          business_timezone: string
          created_at: string
          id: string
          logo_bucket: string | null
          logo_path: string | null
          origin_address: string
          origin_label: string
          origin_rajaongkir_id: string
          origin_rajaongkir_level: string
          store_name: string
          store_slug: string
          updated_at: string
          whatsapp_phone: string
        }
        Insert: {
          auth_user_id: string
          business_timezone?: string
          created_at?: string
          id?: string
          logo_bucket?: string | null
          logo_path?: string | null
          origin_address: string
          origin_label: string
          origin_rajaongkir_id: string
          origin_rajaongkir_level: string
          store_name: string
          store_slug: string
          updated_at?: string
          whatsapp_phone: string
        }
        Update: {
          auth_user_id?: string
          business_timezone?: string
          created_at?: string
          id?: string
          logo_bucket?: string | null
          logo_path?: string | null
          origin_address?: string
          origin_label?: string
          origin_rajaongkir_id?: string
          origin_rajaongkir_level?: string
          store_name?: string
          store_slug?: string
          updated_at?: string
          whatsapp_phone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_login_rate_limit_buckets: {
        Args: { p_now: string }
        Returns: Json
      }
      consume_login_rate_limit: {
        Args: { p_email_digest: string; p_ip_digest: string; p_now: string }
        Returns: Json
      }
      delete_login_rate_limit_email_bucket: {
        Args: { p_email_digest: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
