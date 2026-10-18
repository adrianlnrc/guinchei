export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
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
      corridas: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          estado: Database['public']['Enums']['estado_corrida'];
          guincheiro_id: string;
          id: string;
          pedido_id: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          estado?: Database['public']['Enums']['estado_corrida'];
          guincheiro_id: string;
          id?: string;
          pedido_id: string;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          estado?: Database['public']['Enums']['estado_corrida'];
          guincheiro_id?: string;
          id?: string;
          pedido_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'corridas_guincheiro_id_fkey';
            columns: ['guincheiro_id'];
            isOneToOne: false;
            referencedRelation: 'guincheiros';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'corridas_pedido_id_fkey';
            columns: ['pedido_id'];
            isOneToOne: true;
            referencedRelation: 'pedidos';
            referencedColumns: ['id'];
          },
        ];
      };
      feriados: {
        Row: {
          abrangencia: Database['public']['Enums']['abrangencia_feriado'];
          data: string;
          nome: string;
        };
        ComputedFields: never;
        Insert: {
          abrangencia: Database['public']['Enums']['abrangencia_feriado'];
          data: string;
          nome: string;
        };
        Update: {
          abrangencia?: Database['public']['Enums']['abrangencia_feriado'];
          data?: string;
          nome?: string;
        };
        Relationships: [];
      };
      fotos_estado: {
        Row: {
          autor_id: string;
          caminho: string;
          corrida_id: string;
          criado_em: string;
          id: string;
          latitude: number | null;
          longitude: number | null;
          papel_autor: Database['public']['Enums']['papel'];
          tipo: Database['public']['Enums']['tipo_midia'];
        };
        ComputedFields: never;
        Insert: {
          autor_id?: string;
          caminho: string;
          corrida_id: string;
          criado_em?: string;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          papel_autor: Database['public']['Enums']['papel'];
          tipo: Database['public']['Enums']['tipo_midia'];
        };
        Update: {
          autor_id?: string;
          caminho?: string;
          corrida_id?: string;
          criado_em?: string;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          papel_autor?: Database['public']['Enums']['papel'];
          tipo?: Database['public']['Enums']['tipo_midia'];
        };
        Relationships: [
          {
            foreignKeyName: 'fotos_estado_autor_id_fkey';
            columns: ['autor_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fotos_estado_corrida_id_fkey';
            columns: ['corrida_id'];
            isOneToOne: false;
            referencedRelation: 'corridas';
            referencedColumns: ['id'];
          },
        ];
      };
      frotas: {
        Row: {
          ativa: boolean;
          criado_em: string;
          documento: string;
          id: string;
          nome: string;
          tipo: Database['public']['Enums']['tipo_frota'];
        };
        ComputedFields: never;
        Insert: {
          ativa?: boolean;
          criado_em?: string;
          documento: string;
          id?: string;
          nome: string;
          tipo: Database['public']['Enums']['tipo_frota'];
        };
        Update: {
          ativa?: boolean;
          criado_em?: string;
          documento?: string;
          id?: string;
          nome?: string;
          tipo?: Database['public']['Enums']['tipo_frota'];
        };
        Relationships: [];
      };
      guincheiros: {
        Row: {
          criado_em: string;
          disponivel: boolean;
          frota_id: string;
          id: string;
          posicao: unknown;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          disponivel?: boolean;
          frota_id: string;
          id: string;
          posicao: unknown;
        };
        Update: {
          criado_em?: string;
          disponivel?: boolean;
          frota_id?: string;
          id?: string;
          posicao?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: 'guincheiros_frota_id_fkey';
            columns: ['frota_id'];
            isOneToOne: false;
            referencedRelation: 'frotas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'guincheiros_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      pedidos: {
        Row: {
          atualizado_em: string;
          cliente_id: string;
          criado_em: string;
          destino: unknown;
          destino_endereco: string | null;
          estado: Database['public']['Enums']['estado_pedido'];
          id: string;
          km_ate_veiculo: number | null;
          km_rebocado: number | null;
          origem: unknown;
          origem_endereco: string | null;
          preco_adicional_feriado: number | null;
          preco_adicional_noturno: number | null;
          preco_ajuste_minimo: number | null;
          preco_ate_veiculo: number | null;
          preco_rebocado: number | null;
          preco_taxa_base: number | null;
          preco_total: number | null;
          rodas_giram: Database['public']['Enums']['rodas_giram'];
          situacao: Database['public']['Enums']['situacao_veiculo'];
          tabela_precos_versao: number | null;
          tipo_veiculo: Database['public']['Enums']['tipo_veiculo'];
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          cliente_id: string;
          criado_em?: string;
          destino?: unknown;
          destino_endereco?: string | null;
          estado?: Database['public']['Enums']['estado_pedido'];
          id?: string;
          km_ate_veiculo?: number | null;
          km_rebocado?: number | null;
          origem?: unknown;
          origem_endereco?: string | null;
          preco_adicional_feriado?: number | null;
          preco_adicional_noturno?: number | null;
          preco_ajuste_minimo?: number | null;
          preco_ate_veiculo?: number | null;
          preco_rebocado?: number | null;
          preco_taxa_base?: number | null;
          preco_total?: number | null;
          rodas_giram: Database['public']['Enums']['rodas_giram'];
          situacao: Database['public']['Enums']['situacao_veiculo'];
          tabela_precos_versao?: number | null;
          tipo_veiculo: Database['public']['Enums']['tipo_veiculo'];
        };
        Update: {
          atualizado_em?: string;
          cliente_id?: string;
          criado_em?: string;
          destino?: unknown;
          destino_endereco?: string | null;
          estado?: Database['public']['Enums']['estado_pedido'];
          id?: string;
          km_ate_veiculo?: number | null;
          km_rebocado?: number | null;
          origem?: unknown;
          origem_endereco?: string | null;
          preco_adicional_feriado?: number | null;
          preco_adicional_noturno?: number | null;
          preco_ajuste_minimo?: number | null;
          preco_ate_veiculo?: number | null;
          preco_rebocado?: number | null;
          preco_taxa_base?: number | null;
          preco_total?: number | null;
          rodas_giram?: Database['public']['Enums']['rodas_giram'];
          situacao?: Database['public']['Enums']['situacao_veiculo'];
          tabela_precos_versao?: number | null;
          tipo_veiculo?: Database['public']['Enums']['tipo_veiculo'];
        };
        Relationships: [
          {
            foreignKeyName: 'pedidos_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedidos_tabela_precos_versao_fkey';
            columns: ['tabela_precos_versao'];
            isOneToOne: false;
            referencedRelation: 'tabela_precos';
            referencedColumns: ['versao'];
          },
        ];
      };
      perfis: {
        Row: {
          aceite_termos_em: string;
          aceite_termos_versao: string;
          cpf: string;
          criado_em: string;
          data_nascimento: string | null;
          email: string | null;
          id: string;
          nome: string;
          papel: Database['public']['Enums']['papel'];
          telefone: string;
          telefone_secundario: string | null;
        };
        ComputedFields: never;
        Insert: {
          aceite_termos_em?: string;
          aceite_termos_versao: string;
          cpf: string;
          criado_em?: string;
          data_nascimento?: string | null;
          email?: string | null;
          id: string;
          nome: string;
          papel: Database['public']['Enums']['papel'];
          telefone: string;
          telefone_secundario?: string | null;
        };
        Update: {
          aceite_termos_em?: string;
          aceite_termos_versao?: string;
          cpf?: string;
          criado_em?: string;
          data_nascimento?: string | null;
          email?: string | null;
          id?: string;
          nome?: string;
          papel?: Database['public']['Enums']['papel'];
          telefone?: string;
          telefone_secundario?: string | null;
        };
        Relationships: [];
      };
      tabela_precos: {
        Row: {
          adicional_feriado: number;
          adicional_noturno: number;
          comissao: number;
          criado_em: string;
          noturno_ate: number;
          noturno_das: number;
          por_km_ate_veiculo: number;
          por_km_rebocado: number;
          preco_minimo: number;
          taxa_base: number;
          versao: number;
          vigente_desde: string;
        };
        ComputedFields: never;
        Insert: {
          adicional_feriado: number;
          adicional_noturno: number;
          comissao: number;
          criado_em?: string;
          noturno_ate: number;
          noturno_das: number;
          por_km_ate_veiculo: number;
          por_km_rebocado: number;
          preco_minimo: number;
          taxa_base: number;
          versao: number;
          vigente_desde: string;
        };
        Update: {
          adicional_feriado?: number;
          adicional_noturno?: number;
          comissao?: number;
          criado_em?: string;
          noturno_ate?: number;
          noturno_das?: number;
          por_km_ate_veiculo?: number;
          por_km_rebocado?: number;
          preco_minimo?: number;
          taxa_base?: number;
          versao?: number;
          vigente_desde?: string;
        };
        Relationships: [];
      };
      tentativas_match: {
        Row: {
          criado_em: string;
          guincheiro_id: string;
          id: number;
          ordem: number;
          pedido_id: string;
          preco_recalculado: number;
          repasse_oferecido: number;
          resultado: Database['public']['Enums']['resultado_tentativa'];
          rodada: number;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          guincheiro_id: string;
          id?: never;
          ordem: number;
          pedido_id: string;
          preco_recalculado: number;
          repasse_oferecido: number;
          resultado?: Database['public']['Enums']['resultado_tentativa'];
          rodada: number;
        };
        Update: {
          criado_em?: string;
          guincheiro_id?: string;
          id?: never;
          ordem?: number;
          pedido_id?: string;
          preco_recalculado?: number;
          repasse_oferecido?: number;
          resultado?: Database['public']['Enums']['resultado_tentativa'];
          rodada?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'tentativas_match_guincheiro_id_fkey';
            columns: ['guincheiro_id'];
            isOneToOne: false;
            referencedRelation: 'guincheiros';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tentativas_match_pedido_id_fkey';
            columns: ['pedido_id'];
            isOneToOne: false;
            referencedRelation: 'pedidos';
            referencedColumns: ['id'];
          },
        ];
      };
      transicoes_corrida: {
        Row: {
          de: Database['public']['Enums']['estado_corrida'];
          para: Database['public']['Enums']['estado_corrida'];
        };
        ComputedFields: never;
        Insert: {
          de: Database['public']['Enums']['estado_corrida'];
          para: Database['public']['Enums']['estado_corrida'];
        };
        Update: {
          de?: Database['public']['Enums']['estado_corrida'];
          para?: Database['public']['Enums']['estado_corrida'];
        };
        Relationships: [];
      };
      transicoes_pedido: {
        Row: {
          de: Database['public']['Enums']['estado_pedido'];
          para: Database['public']['Enums']['estado_pedido'];
        };
        ComputedFields: never;
        Insert: {
          de: Database['public']['Enums']['estado_pedido'];
          para: Database['public']['Enums']['estado_pedido'];
        };
        Update: {
          de?: Database['public']['Enums']['estado_pedido'];
          para?: Database['public']['Enums']['estado_pedido'];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      abrir_pedido: {
        Args: {
          rodas_giram: Database['public']['Enums']['rodas_giram'];
          situacao: Database['public']['Enums']['situacao_veiculo'];
          tipo_veiculo: Database['public']['Enums']['tipo_veiculo'];
        };
        Returns: string;
      };
      cnpj_valido: { Args: { cnpj: string }; Returns: boolean };
      corrida_da_pasta: { Args: { nome_objeto: string }; Returns: string };
      cpf_valido: { Args: { cpf: string }; Returns: boolean };
      eh_operacao: { Args: Record<PropertyKey, never>; Returns: boolean };
      guincheiros_elegiveis_proximos: {
        Args: { latitude: number; limite?: number; longitude: number };
        Returns: {
          distancia_m: number;
          frota_id: string;
          guincheiro_id: string;
        }[];
      };
      participo_da_corrida: { Args: { corrida_id: string }; Returns: boolean };
      pedido_oferecido_a_mim: { Args: { pedido_id: string }; Returns: boolean };
      perfil_tem_papel: {
        Args: { esperado: Database['public']['Enums']['papel']; perfil_id: string };
        Returns: boolean;
      };
      sou_cliente_do_pedido: { Args: { pedido_id: string }; Returns: boolean };
      tabela_precos_vigente: {
        Args: { em?: string };
        Returns: {
          adicional_feriado: number;
          adicional_noturno: number;
          comissao: number;
          criado_em: string;
          noturno_ate: number;
          noturno_das: number;
          por_km_ate_veiculo: number;
          por_km_rebocado: number;
          preco_minimo: number;
          taxa_base: number;
          versao: number;
          vigente_desde: string;
        };
        SetofOptions: {
          from: '*';
          to: 'tabela_precos';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      abrangencia_feriado: 'nacional' | 'df';
      estado_corrida: 'aceita' | 'a_caminho' | 'no_local' | 'carregado' | 'entregue';
      estado_pedido:
        'cotado' | 'confirmado' | 'em_match' | 'atribuido' | 'sem_guincheiro' | 'estornado';
      papel: 'cliente' | 'guincheiro' | 'operacao';
      resultado_tentativa: 'oferecida' | 'aceita' | 'recusada' | 'expirada' | 'pulada_teto';
      rodas_giram: 'sim' | 'nao' | 'nao_sei';
      situacao_veiculo: 'nao_liga' | 'batida' | 'superaqueceu' | 'outro';
      tipo_frota: 'empresa' | 'autonomo';
      tipo_midia: 'foto' | 'video';
      tipo_veiculo: 'carro' | 'suv' | 'moto' | 'van';
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      abrangencia_feriado: ['nacional', 'df'],
      estado_corrida: ['aceita', 'a_caminho', 'no_local', 'carregado', 'entregue'],
      estado_pedido: [
        'cotado',
        'confirmado',
        'em_match',
        'atribuido',
        'sem_guincheiro',
        'estornado',
      ],
      papel: ['cliente', 'guincheiro', 'operacao'],
      resultado_tentativa: ['oferecida', 'aceita', 'recusada', 'expirada', 'pulada_teto'],
      rodas_giram: ['sim', 'nao', 'nao_sei'],
      situacao_veiculo: ['nao_liga', 'batida', 'superaqueceu', 'outro'],
      tipo_frota: ['empresa', 'autonomo'],
      tipo_midia: ['foto', 'video'],
      tipo_veiculo: ['carro', 'suv', 'moto', 'van'],
    },
  },
} as const;
