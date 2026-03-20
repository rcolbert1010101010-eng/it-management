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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          asset_tag: string | null
          assigned_to_email: string | null
          assigned_to_name: string | null
          category: string
          created_at: string
          id: string
          is_consumable: boolean
          location: string | null
          manufacturer: string | null
          model: string | null
          notes: string | null
          purchase_date: string | null
          quantity_on_hand: number
          serial_number: string | null
          source_order_id: string | null
          source_order_line_item_id: string | null
          status: string
          updated_at: string
          warranty_end_date: string | null
        }
        Insert: {
          asset_tag?: string | null
          assigned_to_email?: string | null
          assigned_to_name?: string | null
          category: string
          created_at?: string
          id?: string
          is_consumable?: boolean
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          purchase_date?: string | null
          quantity_on_hand?: number
          serial_number?: string | null
          source_order_id?: string | null
          source_order_line_item_id?: string | null
          status?: string
          updated_at?: string
          warranty_end_date?: string | null
        }
        Update: {
          asset_tag?: string | null
          assigned_to_email?: string | null
          assigned_to_name?: string | null
          category?: string
          created_at?: string
          id?: string
          is_consumable?: boolean
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          purchase_date?: string | null
          quantity_on_hand?: number
          serial_number?: string | null
          source_order_id?: string | null
          source_order_line_item_id?: string | null
          status?: string
          updated_at?: string
          warranty_end_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_source_order"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_source_order_line_item"
            columns: ["source_order_line_item_id"]
            isOneToOne: false
            referencedRelation: "order_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          performed_by: string
          timestamp: string
        }
        Insert: {
          action: string
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          performed_by?: string
          timestamp?: string
        }
        Update: {
          action?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          performed_by?: string
          timestamp?: string
        }
        Relationships: []
      }
      order_line_items: {
        Row: {
          id: string
          item_name: string
          notes: string | null
          order_id: string
          quantity: number
          received_quantity: number | null
          sku: string | null
          unit_cost: number | null
        }
        Insert: {
          id?: string
          item_name: string
          notes?: string | null
          order_id: string
          quantity?: number
          received_quantity?: number | null
          sku?: string | null
          unit_cost?: number | null
        }
        Update: {
          id?: string
          item_name?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          received_quantity?: number | null
          sku?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_line_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_line_item_receipt_ledger: {
        Row: {
          order_line_item_id: string
          total_received_applied: number
          updated_at: string
        }
        Insert: {
          order_line_item_id: string
          total_received_applied?: number
          updated_at?: string
        }
        Update: {
          order_line_item_id?: string
          total_received_applied?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_line_item_receipt_ledger_order_line_item_id_fkey"
            columns: ["order_line_item_id"]
            isOneToOne: true
            referencedRelation: "order_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string | null
          order_number: string
          received_date: string | null
          requested_by_email: string | null
          requested_by_name: string | null
          shipping_tracking_number: string | null
          status: string
          updated_at: string
          vendor_contact: string | null
          vendor_name: string
        }
        Insert: {
          created_at?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          order_number: string
          received_date?: string | null
          requested_by_email?: string | null
          requested_by_name?: string | null
          shipping_tracking_number?: string | null
          status?: string
          updated_at?: string
          vendor_contact?: string | null
          vendor_name: string
        }
        Update: {
          created_at?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          order_number?: string
          received_date?: string | null
          requested_by_email?: string | null
          requested_by_name?: string | null
          shipping_tracking_number?: string | null
          status?: string
          updated_at?: string
          vendor_contact?: string | null
          vendor_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_admin: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_admin?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean
        }
        Relationships: []
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
    Enums: {},
  },
} as const
