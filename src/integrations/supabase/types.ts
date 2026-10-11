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
      audit_configuracoes: {
        Row: {
          chave: string
          created_at: string
          id: string
          user_id: string
          valor_anterior: string | null
          valor_novo: string
        }
        Insert: {
          chave: string
          created_at?: string
          id?: string
          user_id: string
          valor_anterior?: string | null
          valor_novo: string
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          user_id?: string
          valor_anterior?: string | null
          valor_novo?: string
        }
        Relationships: []
      }
      audit_entidades: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      banco_horas: {
        Row: {
          created_at: string
          data: string
          id: string
          minutos_esperados: number
          minutos_trabalhados: number
          registro_ponto_id: string | null
          saldo_minutos: number
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          minutos_esperados?: number
          minutos_trabalhados?: number
          registro_ponto_id?: string | null
          saldo_minutos?: number
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          minutos_esperados?: number
          minutos_trabalhados?: number
          registro_ponto_id?: string | null
          saldo_minutos?: number
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "banco_horas_registro_ponto_id_fkey"
            columns: ["registro_ponto_id"]
            isOneToOne: false
            referencedRelation: "registros_ponto"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nivel: number
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nivel?: number
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nivel?: number
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes_ponto: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      configuracoes_sistema: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          id: string
          tipo: string
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string
          updated_at?: string
          valor?: string
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      escalas: {
        Row: {
          carga_horaria_diaria: string
          created_at: string
          descricao: string | null
          dias_semana: number[]
          hora_almoco_fim: string
          hora_almoco_inicio: string
          hora_entrada: string
          hora_saida: string
          id: string
          nome: string
          tipo_registro_id: string | null
          updated_at: string
        }
        Insert: {
          carga_horaria_diaria?: string
          created_at?: string
          descricao?: string | null
          dias_semana?: number[]
          hora_almoco_fim?: string
          hora_almoco_inicio?: string
          hora_entrada?: string
          hora_saida?: string
          id?: string
          nome: string
          tipo_registro_id?: string | null
          updated_at?: string
        }
        Update: {
          carga_horaria_diaria?: string
          created_at?: string
          descricao?: string | null
          dias_semana?: number[]
          hora_almoco_fim?: string
          hora_almoco_inicio?: string
          hora_entrada?: string
          hora_saida?: string
          id?: string
          nome?: string
          tipo_registro_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalas_tipo_registro_id_fkey"
            columns: ["tipo_registro_id"]
            isOneToOne: false
            referencedRelation: "tipos_registro"
            referencedColumns: ["id"]
          },
        ]
      }
      face_descriptors: {
        Row: {
          created_at: string
          descriptor: number[]
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descriptor: number[]
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descriptor?: number[]
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      funcionarios: {
        Row: {
          cargo_id: string | null
          created_at: string
          data_admissao: string
          data_demissao: string | null
          escala_id: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cargo_id?: string | null
          created_at?: string
          data_admissao?: string
          data_demissao?: string | null
          escala_id?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cargo_id?: string | null
          created_at?: string
          data_admissao?: string
          data_demissao?: string | null
          escala_id?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas"
            referencedColumns: ["id"]
          },
        ]
      }
      justificativas: {
        Row: {
          aprovado_por: string | null
          created_at: string
          data: string
          descricao: string
          id: string
          registro_ponto_id: string | null
          status: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aprovado_por?: string | null
          created_at?: string
          data: string
          descricao: string
          id?: string
          registro_ponto_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aprovado_por?: string | null
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          registro_ponto_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "justificativas_registro_ponto_id_fkey"
            columns: ["registro_ponto_id"]
            isOneToOne: false
            referencedRelation: "registros_ponto"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          aprovado_por: string | null
          created_at: string
          data: string
          descricao: string
          id: string
          status: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aprovado_por?: string | null
          created_at?: string
          data?: string
          descricao: string
          id?: string
          status?: string
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aprovado_por?: string | null
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          matricula: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          matricula?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          matricula?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      registros_ponto: {
        Row: {
          almoco_retorno: string | null
          almoco_saida: string | null
          created_at: string
          data: string
          entrada: string | null
          hash_registro: string | null
          horario_servidor: string | null
          id: string
          nsr: number | null
          observacao: string | null
          saida: string | null
          saldo_minutos: number | null
          status: string
          terminal_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          almoco_retorno?: string | null
          almoco_saida?: string | null
          created_at?: string
          data?: string
          entrada?: string | null
          hash_registro?: string | null
          horario_servidor?: string | null
          id?: string
          nsr?: number | null
          observacao?: string | null
          saida?: string | null
          saldo_minutos?: number | null
          status?: string
          terminal_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          almoco_retorno?: string | null
          almoco_saida?: string | null
          created_at?: string
          data?: string
          entrada?: string | null
          hash_registro?: string | null
          horario_servidor?: string | null
          id?: string
          nsr?: number | null
          observacao?: string | null
          saida?: string | null
          saldo_minutos?: number | null
          status?: string
          terminal_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessoes_ponto: {
        Row: {
          acao: string
          city: string | null
          country_code: string | null
          created_at: string
          id: string
          ip_address: string | null
          latitude: number | null
          longitude: number | null
          registro_ponto_id: string | null
          sistema_operacional: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acao: string
          city?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          registro_ponto_id?: string | null
          sistema_operacional?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          city?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          registro_ponto_id?: string | null
          sistema_operacional?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_ponto_registro_ponto_id_fkey"
            columns: ["registro_ponto_id"]
            isOneToOne: false
            referencedRelation: "registros_ponto"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_registro: {
        Row: {
          batidas: string[]
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          batidas?: string[]
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          batidas?: string[]
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
    }
    Enums: {
      app_role: "admin" | "gestor" | "colaborador"
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
      app_role: ["admin", "gestor", "colaborador"],
    },
  },
} as const
