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
      auditoria_homologacao: {
        Row: {
          de: Database['public']['Enums']['estado_homologacao'] | null;
          em: string;
          id: number;
          item_id: string;
          motivo: string | null;
          para: Database['public']['Enums']['estado_homologacao'];
          por: string | null;
        };
        ComputedFields: never;
        Insert: {
          de?: Database['public']['Enums']['estado_homologacao'] | null;
          em?: string;
          id?: never;
          item_id: string;
          motivo?: string | null;
          para: Database['public']['Enums']['estado_homologacao'];
          por?: string | null;
        };
        Update: {
          de?: Database['public']['Enums']['estado_homologacao'] | null;
          em?: string;
          id?: never;
          item_id?: string;
          motivo?: string | null;
          para?: Database['public']['Enums']['estado_homologacao'];
          por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'auditoria_homologacao_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'itens_homologacao';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'auditoria_homologacao_por_fkey';
            columns: ['por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      convites_guincheiro: {
        Row: {
          aceito_em: string | null;
          aceito_por: string | null;
          criado_em: string;
          criado_por: string | null;
          estado: Database['public']['Enums']['estado_convite'];
          frota_id: string;
          id: string;
          telefone: string;
          valido_ate: string;
        };
        ComputedFields: never;
        Insert: {
          aceito_em?: string | null;
          aceito_por?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          estado?: Database['public']['Enums']['estado_convite'];
          frota_id: string;
          id?: string;
          telefone: string;
          valido_ate?: string;
        };
        Update: {
          aceito_em?: string | null;
          aceito_por?: string | null;
          criado_em?: string;
          criado_por?: string | null;
          estado?: Database['public']['Enums']['estado_convite'];
          frota_id?: string;
          id?: string;
          telefone?: string;
          valido_ate?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'convites_guincheiro_aceito_por_fkey';
            columns: ['aceito_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'convites_guincheiro_criado_por_fkey';
            columns: ['criado_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'convites_guincheiro_frota_id_fkey';
            columns: ['frota_id'];
            isOneToOne: false;
            referencedRelation: 'frotas';
            referencedColumns: ['id'];
          },
        ];
      };
      corridas: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          estado: Database['public']['Enums']['estado_corrida'];
          guincheiro_id: string;
          id: string;
          pedido_id: string;
          repasse: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          estado?: Database['public']['Enums']['estado_corrida'];
          guincheiro_id: string;
          id?: string;
          pedido_id: string;
          repasse: number;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          estado?: Database['public']['Enums']['estado_corrida'];
          guincheiro_id?: string;
          id?: string;
          pedido_id?: string;
          repasse?: number;
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
      documentos_guincheiro: {
        Row: {
          antecedentes_emissao: string | null;
          atualizado_em: string;
          cnh_categoria: string | null;
          cnh_ear: boolean | null;
          cnh_numero: string | null;
          cnh_validade: string | null;
          criado_em: string;
          guincheiro_id: string;
        };
        ComputedFields: never;
        Insert: {
          antecedentes_emissao?: string | null;
          atualizado_em?: string;
          cnh_categoria?: string | null;
          cnh_ear?: boolean | null;
          cnh_numero?: string | null;
          cnh_validade?: string | null;
          criado_em?: string;
          guincheiro_id: string;
        };
        Update: {
          antecedentes_emissao?: string | null;
          atualizado_em?: string;
          cnh_categoria?: string | null;
          cnh_ear?: boolean | null;
          cnh_numero?: string | null;
          cnh_validade?: string | null;
          criado_em?: string;
          guincheiro_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'documentos_guincheiro_guincheiro_id_fkey';
            columns: ['guincheiro_id'];
            isOneToOne: true;
            referencedRelation: 'guincheiros';
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
          etapa: Database['public']['Enums']['etapa_foto'];
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
          etapa: Database['public']['Enums']['etapa_foto'];
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
          etapa?: Database['public']['Enums']['etapa_foto'];
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
          apolice_validade: string | null;
          ativa: boolean;
          base_bairro: string | null;
          base_cep: string | null;
          base_endereco: string | null;
          chave_pix: string | null;
          criado_em: string;
          documento: string;
          id: string;
          nome: string;
          representante_id: string | null;
          termos_prestador_em: string | null;
          termos_prestador_versao: string | null;
          tipo: Database['public']['Enums']['tipo_frota'];
        };
        ComputedFields: never;
        Insert: {
          apolice_validade?: string | null;
          ativa?: boolean;
          base_bairro?: string | null;
          base_cep?: string | null;
          base_endereco?: string | null;
          chave_pix?: string | null;
          criado_em?: string;
          documento: string;
          id?: string;
          nome: string;
          representante_id?: string | null;
          termos_prestador_em?: string | null;
          termos_prestador_versao?: string | null;
          tipo: Database['public']['Enums']['tipo_frota'];
        };
        Update: {
          apolice_validade?: string | null;
          ativa?: boolean;
          base_bairro?: string | null;
          base_cep?: string | null;
          base_endereco?: string | null;
          chave_pix?: string | null;
          criado_em?: string;
          documento?: string;
          id?: string;
          nome?: string;
          representante_id?: string | null;
          termos_prestador_em?: string | null;
          termos_prestador_versao?: string | null;
          tipo?: Database['public']['Enums']['tipo_frota'];
        };
        Relationships: [
          {
            foreignKeyName: 'frotas_representante_id_fkey';
            columns: ['representante_id'];
            isOneToOne: true;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
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
      itens_homologacao: {
        Row: {
          alvo: Database['public']['Enums']['alvo_homologacao'];
          alvo_id: string;
          arquivo: string;
          atualizado_em: string;
          criado_em: string;
          decidido_em: string | null;
          decidido_por: string | null;
          dono_id: string;
          enviado_em: string;
          estado: Database['public']['Enums']['estado_homologacao'];
          frota_id: string;
          id: string;
          motivo: string | null;
          tipo: Database['public']['Enums']['tipo_item_homologacao'];
          validade: string | null;
        };
        ComputedFields: never;
        Insert: {
          alvo: Database['public']['Enums']['alvo_homologacao'];
          alvo_id: string;
          arquivo: string;
          atualizado_em?: string;
          criado_em?: string;
          decidido_em?: string | null;
          decidido_por?: string | null;
          dono_id: string;
          enviado_em?: string;
          estado?: Database['public']['Enums']['estado_homologacao'];
          frota_id: string;
          id?: string;
          motivo?: string | null;
          tipo: Database['public']['Enums']['tipo_item_homologacao'];
          validade?: string | null;
        };
        Update: {
          alvo?: Database['public']['Enums']['alvo_homologacao'];
          alvo_id?: string;
          arquivo?: string;
          atualizado_em?: string;
          criado_em?: string;
          decidido_em?: string | null;
          decidido_por?: string | null;
          dono_id?: string;
          enviado_em?: string;
          estado?: Database['public']['Enums']['estado_homologacao'];
          frota_id?: string;
          id?: string;
          motivo?: string | null;
          tipo?: Database['public']['Enums']['tipo_item_homologacao'];
          validade?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'itens_homologacao_decidido_por_fkey';
            columns: ['decidido_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'itens_homologacao_dono_id_fkey';
            columns: ['dono_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'itens_homologacao_frota_id_fkey';
            columns: ['frota_id'];
            isOneToOne: false;
            referencedRelation: 'frotas';
            referencedColumns: ['id'];
          },
        ];
      };
      pagamentos: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          estado: Database['public']['Enums']['estado_pagamento'];
          id: string;
          metodo: Database['public']['Enums']['metodo_pagamento'];
          pedido_id: string;
          provedor: string;
          referencia_externa: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          estado: Database['public']['Enums']['estado_pagamento'];
          id?: string;
          metodo: Database['public']['Enums']['metodo_pagamento'];
          pedido_id: string;
          provedor: string;
          referencia_externa: string;
          valor: number;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          estado?: Database['public']['Enums']['estado_pagamento'];
          id?: string;
          metodo?: Database['public']['Enums']['metodo_pagamento'];
          pedido_id?: string;
          provedor?: string;
          referencia_externa?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'pagamentos_pedido_id_fkey';
            columns: ['pedido_id'];
            isOneToOne: false;
            referencedRelation: 'pedidos';
            referencedColumns: ['id'];
          },
        ];
      };
      parametros_homologacao: {
        Row: {
          alerta_vencimento_dias: number;
          atualizado_em: string;
          id: boolean;
        };
        ComputedFields: never;
        Insert: {
          alerta_vencimento_dias?: number;
          atualizado_em?: string;
          id?: boolean;
        };
        Update: {
          alerta_vencimento_dias?: number;
          atualizado_em?: string;
          id?: boolean;
        };
        Relationships: [];
      };
      parametros_match: {
        Row: {
          atualizado_em: string;
          id: boolean;
          limite_tentativas: number;
          prazo_aprovacao_preco_segundos: number;
          timeout_oferta_segundos: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          id?: boolean;
          limite_tentativas?: number;
          prazo_aprovacao_preco_segundos?: number;
          timeout_oferta_segundos?: number;
        };
        Update: {
          atualizado_em?: string;
          id?: boolean;
          limite_tentativas?: number;
          prazo_aprovacao_preco_segundos?: number;
          timeout_oferta_segundos?: number;
        };
        Relationships: [];
      };
      pedidos: {
        Row: {
          atualizado_em: string;
          cliente_id: string;
          cotado_em: string | null;
          criado_em: string;
          destino: unknown;
          destino_endereco: string | null;
          estado: Database['public']['Enums']['estado_pedido'];
          frota_cotada_id: string | null;
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
          rodada_match: number;
          rodas_giram: Database['public']['Enums']['rodas_giram'];
          situacao: Database['public']['Enums']['situacao_veiculo'];
          tabela_precos_versao: number | null;
          tipo_veiculo: Database['public']['Enums']['tipo_veiculo'];
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          cliente_id: string;
          cotado_em?: string | null;
          criado_em?: string;
          destino?: unknown;
          destino_endereco?: string | null;
          estado?: Database['public']['Enums']['estado_pedido'];
          frota_cotada_id?: string | null;
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
          rodada_match?: number;
          rodas_giram: Database['public']['Enums']['rodas_giram'];
          situacao: Database['public']['Enums']['situacao_veiculo'];
          tabela_precos_versao?: number | null;
          tipo_veiculo: Database['public']['Enums']['tipo_veiculo'];
        };
        Update: {
          atualizado_em?: string;
          cliente_id?: string;
          cotado_em?: string | null;
          criado_em?: string;
          destino?: unknown;
          destino_endereco?: string | null;
          estado?: Database['public']['Enums']['estado_pedido'];
          frota_cotada_id?: string | null;
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
          rodada_match?: number;
          rodas_giram?: Database['public']['Enums']['rodas_giram'];
          situacao?: Database['public']['Enums']['situacao_veiculo'];
          tabela_precos_versao?: number | null;
          tipo_veiculo?: Database['public']['Enums']['tipo_veiculo'];
        };
        Relationships: [
          {
            foreignKeyName: 'pedidos_frota_cotada_id_fkey';
            columns: ['frota_cotada_id'];
            isOneToOne: false;
            referencedRelation: 'frotas';
            referencedColumns: ['id'];
          },
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
      rascunhos_frota: {
        Row: {
          atualizado_em: string;
          dados: NonNullable<Json>;
          etapa: number;
          tipo: Database['public']['Enums']['tipo_frota'];
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          dados?: NonNullable<Json>;
          etapa?: number;
          tipo?: Database['public']['Enums']['tipo_frota'];
          usuario_id?: string;
        };
        Update: {
          atualizado_em?: string;
          dados?: NonNullable<Json>;
          etapa?: number;
          tipo?: Database['public']['Enums']['tipo_frota'];
          usuario_id?: string;
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
      recotacoes_pedido: {
        Row: {
          criado_em: string;
          expira_em: string | null;
          frota_anterior_id: string;
          frota_nova_id: string;
          guincheiro_id: string;
          id: number;
          km_ate_veiculo: number;
          pedido_id: string;
          preco_adicional_feriado: number;
          preco_adicional_noturno: number;
          preco_ajuste_minimo: number;
          preco_anterior: number;
          preco_ate_veiculo: number;
          preco_novo: number;
          preco_rebocado: number;
          preco_taxa_base: number;
          respondida_em: string | null;
          resultado: Database['public']['Enums']['resultado_recotacao'];
          rodada: number;
          tabela_precos_versao: number;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          expira_em?: string | null;
          frota_anterior_id: string;
          frota_nova_id: string;
          guincheiro_id: string;
          id?: never;
          km_ate_veiculo: number;
          pedido_id: string;
          preco_adicional_feriado?: number;
          preco_adicional_noturno?: number;
          preco_ajuste_minimo?: number;
          preco_anterior: number;
          preco_ate_veiculo: number;
          preco_novo: number;
          preco_rebocado: number;
          preco_taxa_base: number;
          respondida_em?: string | null;
          resultado: Database['public']['Enums']['resultado_recotacao'];
          rodada: number;
          tabela_precos_versao: number;
        };
        Update: {
          criado_em?: string;
          expira_em?: string | null;
          frota_anterior_id?: string;
          frota_nova_id?: string;
          guincheiro_id?: string;
          id?: never;
          km_ate_veiculo?: number;
          pedido_id?: string;
          preco_adicional_feriado?: number;
          preco_adicional_noturno?: number;
          preco_ajuste_minimo?: number;
          preco_anterior?: number;
          preco_ate_veiculo?: number;
          preco_novo?: number;
          preco_rebocado?: number;
          preco_taxa_base?: number;
          respondida_em?: string | null;
          resultado?: Database['public']['Enums']['resultado_recotacao'];
          rodada?: number;
          tabela_precos_versao?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'recotacoes_pedido_frota_anterior_id_fkey';
            columns: ['frota_anterior_id'];
            isOneToOne: false;
            referencedRelation: 'frotas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recotacoes_pedido_frota_nova_id_fkey';
            columns: ['frota_nova_id'];
            isOneToOne: false;
            referencedRelation: 'frotas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recotacoes_pedido_guincheiro_id_fkey';
            columns: ['guincheiro_id'];
            isOneToOne: false;
            referencedRelation: 'guincheiros';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recotacoes_pedido_pedido_id_fkey';
            columns: ['pedido_id'];
            isOneToOne: false;
            referencedRelation: 'pedidos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recotacoes_pedido_tabela_precos_versao_fkey';
            columns: ['tabela_precos_versao'];
            isOneToOne: false;
            referencedRelation: 'tabela_precos';
            referencedColumns: ['versao'];
          },
        ];
      };
      tentativas_match: {
        Row: {
          criado_em: string;
          expira_em: string | null;
          guincheiro_id: string;
          id: number;
          km_ate_veiculo: number;
          ordem: number;
          pedido_id: string;
          preco_recalculado: number;
          repasse_oferecido: number;
          respondida_em: string | null;
          resultado: Database['public']['Enums']['resultado_tentativa'];
          rodada: number;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          expira_em?: string | null;
          guincheiro_id: string;
          id?: never;
          km_ate_veiculo: number;
          ordem: number;
          pedido_id: string;
          preco_recalculado: number;
          repasse_oferecido: number;
          respondida_em?: string | null;
          resultado?: Database['public']['Enums']['resultado_tentativa'];
          rodada: number;
        };
        Update: {
          criado_em?: string;
          expira_em?: string | null;
          guincheiro_id?: string;
          id?: never;
          km_ate_veiculo?: number;
          ordem?: number;
          pedido_id?: string;
          preco_recalculado?: number;
          repasse_oferecido?: number;
          respondida_em?: string | null;
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
      veiculos: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          frota_id: string;
          id: string;
          pbt_kg: number;
          placa: string;
          renavam: string;
          tipo: Database['public']['Enums']['tipo_veiculo_guincho'];
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          frota_id: string;
          id?: string;
          pbt_kg: number;
          placa: string;
          renavam: string;
          tipo: Database['public']['Enums']['tipo_veiculo_guincho'];
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          frota_id?: string;
          id?: string;
          pbt_kg?: number;
          placa?: string;
          renavam?: string;
          tipo?: Database['public']['Enums']['tipo_veiculo_guincho'];
        };
        Relationships: [
          {
            foreignKeyName: 'veiculos_frota_id_fkey';
            columns: ['frota_id'];
            isOneToOne: false;
            referencedRelation: 'frotas';
            referencedColumns: ['id'];
          },
        ];
      };
      vinculos_encerrados: {
        Row: {
          detalhe: string | null;
          encerrado_em: string;
          frota_id: string;
          guincheiro_id: string;
          id: number;
          motivo: string;
          placa: string;
          veiculo_id: string;
        };
        ComputedFields: never;
        Insert: {
          detalhe?: string | null;
          encerrado_em?: string;
          frota_id: string;
          guincheiro_id: string;
          id?: never;
          motivo: string;
          placa: string;
          veiculo_id: string;
        };
        Update: {
          detalhe?: string | null;
          encerrado_em?: string;
          frota_id?: string;
          guincheiro_id?: string;
          id?: never;
          motivo?: string;
          placa?: string;
          veiculo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vinculos_encerrados_frota_id_fkey';
            columns: ['frota_id'];
            isOneToOne: false;
            referencedRelation: 'frotas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vinculos_encerrados_guincheiro_id_fkey';
            columns: ['guincheiro_id'];
            isOneToOne: false;
            referencedRelation: 'guincheiros';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vinculos_encerrados_veiculo_id_fkey';
            columns: ['veiculo_id'];
            isOneToOne: false;
            referencedRelation: 'veiculos';
            referencedColumns: ['id'];
          },
        ];
      };
      vinculos_veiculo: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          criado_por: string | null;
          frota_id: string;
          guincheiro_id: string;
          id: string;
          situacao: Database['public']['Enums']['situacao_vinculo'];
          veiculo_id: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          frota_id: string;
          guincheiro_id: string;
          id?: string;
          situacao?: Database['public']['Enums']['situacao_vinculo'];
          veiculo_id: string;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          criado_por?: string | null;
          frota_id?: string;
          guincheiro_id?: string;
          id?: string;
          situacao?: Database['public']['Enums']['situacao_vinculo'];
          veiculo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vinculos_veiculo_criado_por_fkey';
            columns: ['criado_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vinculos_veiculo_frota_id_fkey';
            columns: ['frota_id'];
            isOneToOne: false;
            referencedRelation: 'frotas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vinculos_veiculo_guincheiro_id_fkey';
            columns: ['guincheiro_id'];
            isOneToOne: true;
            referencedRelation: 'guincheiros';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vinculos_veiculo_veiculo_id_fkey';
            columns: ['veiculo_id'];
            isOneToOne: false;
            referencedRelation: 'veiculos';
            referencedColumns: ['id'];
          },
        ];
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
      abrir_rodada_match: { Args: { pedido_id: string }; Returns: number };
      aceitar_convite_guincheiro: {
        Args: { cpf: string; nome: string; termos_versao: string };
        Returns: string;
      };
      aceitar_oferta: { Args: { tentativa_id: number }; Returns: string };
      alvo_homologado: {
        Args: { alvo: Database['public']['Enums']['alvo_homologacao']; alvo_id: string };
        Returns: boolean;
      };
      aprovar_novo_preco: { Args: { pedido_id: string }; Returns: undefined };
      apolice_validade_aceitavel: { Args: { validade: string }; Returns: boolean };
      assinatura_do_trajeto: {
        Args: { destino: unknown; km_rebocado: number; origem: unknown };
        Returns: string;
      };
      ativar_frota: { Args: { frota_id: string }; Returns: undefined };
      atualizar_pedido_cotado: {
        Args: {
          pedido_id: string;
          rodas_giram: Database['public']['Enums']['rodas_giram'];
          situacao: Database['public']['Enums']['situacao_veiculo'];
          tipo_veiculo: Database['public']['Enums']['tipo_veiculo'];
        };
        Returns: undefined;
      };
      avaliar_vinculo: { Args: { guincheiro: string; veiculo: string }; Returns: string };
      cancelar_convite_guincheiro: { Args: { convite_id: string }; Returns: undefined };
      categoria_cnh_cobre_pbt: { Args: { categoria: string; pbt_kg: number }; Returns: boolean };
      cnh_dos_meus_guincheiros: {
        Args: Record<PropertyKey, never>;
        Returns: {
          categoria: string | null;
          estado: Database['public']['Enums']['estado_homologacao'] | null;
          guincheiro_id: string;
        }[];
      };
      cnpj_valido: { Args: { cnpj: string }; Returns: boolean };
      conferir_arquivo_homologacao: { Args: { arquivo: string; dono: string }; Returns: undefined };
      cadastrar_veiculo: {
        Args: {
          crlv_arquivo: string;
          fotos: string[];
          pbt_kg: number;
          placa: string;
          renavam: string;
          tipo: Database['public']['Enums']['tipo_veiculo_guincho'];
        };
        Returns: string;
      };
      contraparte_da_corrida: {
        Args: { corrida_id: string };
        Returns: {
          frota: string;
          nome: string;
        }[];
      };
      convidar_guincheiro: { Args: { telefone: string }; Returns: string };
      corrida_da_pasta: { Args: { nome_objeto: string }; Returns: string };
      cpf_valido: { Args: { cpf: string }; Returns: boolean };
      criar_meu_guincheiro: { Args: Record<PropertyKey, never>; Returns: string };
      dados_da_cotacao: { Args: { cliente_id: string; pedido_id: string }; Returns: Json };
      dados_do_match: { Args: { pedido_id: string }; Returns: Json };
      decidir_item_homologacao: {
        Args: {
          decisao: Database['public']['Enums']['estado_homologacao'];
          item_id: string;
          motivo?: string;
        };
        Returns: undefined;
      };
      definir_trajeto_pedido: {
        Args: {
          destino_endereco: string;
          destino_lat: number;
          destino_lng: number;
          km_rebocado: number;
          origem_endereco: string;
          origem_lat: number;
          origem_lng: number;
          pedido_id: string;
        };
        Returns: undefined;
      };
      desfazer_vinculo: { Args: { vinculo_id: string }; Returns: undefined };
      disparar_ofertar_proximo: { Args: { pedido_id: string }; Returns: number };
      eh_operacao: { Args: Record<PropertyKey, never>; Returns: boolean };
      encerrar_rodada_sem_guincheiro: {
        Args: { pedido_id: string; rodada: number; tentativas_lidas: number };
        Returns: undefined;
      };
      encerrar_vinculo: {
        Args: { detalhe?: string; motivo: string; vinculo_id: string };
        Returns: undefined;
      };
      enviar_antecedentes: { Args: { arquivo: string; emissao: string }; Returns: string };
      enviar_cadastro_frota: { Args: Record<PropertyKey, never>; Returns: string };
      enviar_cnh: {
        Args: {
          arquivo: string;
          categoria: string;
          ear: boolean;
          numero: string;
          validade: string;
        };
        Returns: string;
      };
      enviar_item_homologacao: {
        Args: {
          alvo: Database['public']['Enums']['alvo_homologacao'];
          alvo_id: string;
          arquivo: string;
          tipo: Database['public']['Enums']['tipo_item_homologacao'];
          validade?: string;
        };
        Returns: string;
      };
      desistir_do_novo_preco: { Args: { pedido_id: string }; Returns: undefined };
      encerrar_por_novo_preco: { Args: { pedido_id: string }; Returns: undefined };
      enviar_selfie: { Args: { arquivo: string }; Returns: string };
      feriados_perto_de: { Args: { dia: string }; Returns: Json };
      frota_pendencias: {
        Args: { frota: string };
        Returns: {
          alvo_id: string;
          categoria: string;
          descricao: string;
          ordem: number;
          tipo: Database['public']['Enums']['tipo_item_homologacao'];
        }[];
      };
      frota_pronta: { Args: { frota: string }; Returns: boolean };
      frotas_prontas_para_ativar: {
        Args: Record<PropertyKey, never>;
        Returns: {
          documento: string;
          id: string;
          nome: string;
          pronta_desde: string;
          tipo: Database['public']['Enums']['tipo_frota'];
        }[];
      };
      gravar_cotacao: {
        Args: {
          cliente_id: string;
          frota_cotada_id?: string;
          instante?: string;
          km_ate_veiculo: number;
          pedido_id: string;
          preco_adicional_feriado: number;
          preco_adicional_noturno: number;
          preco_ajuste_minimo: number;
          preco_ate_veiculo: number;
          preco_rebocado: number;
          preco_taxa_base: number;
          preco_total: number;
          tabela_precos_versao: number;
          trajeto: string;
        };
        Returns: undefined;
      };
      guincheiro_elegivel: { Args: { guincheiro: string }; Returns: boolean };
      guincheiro_habilitado: { Args: { guincheiro: string }; Returns: boolean };
      guincheiros_da_minha_frota: {
        Args: Record<PropertyKey, never>;
        Returns: {
          criado_em: string;
          disponivel: boolean;
          id: string;
          nome: string;
          telefone: string;
        }[];
      };
      guincheiros_elegiveis_proximos: {
        Args: { latitude: number; limite?: number; longitude: number };
        Returns: {
          distancia_m: number;
          frota_id: string;
          guincheiro_id: string;
        }[];
      };
      hoje_em_brasilia: { Args: Record<PropertyKey, never>; Returns: string };
      hora_do_servidor: { Args: Record<PropertyKey, never>; Returns: string };
      item_vigente: {
        Args: { estado: Database['public']['Enums']['estado_homologacao']; validade: string };
        Returns: boolean;
      };
      itens_em_alerta_de_vencimento: {
        Args: Record<PropertyKey, never>;
        Returns: {
          alvo: Database['public']['Enums']['alvo_homologacao'];
          alvo_id: string;
          dias_restantes: number;
          estado: Database['public']['Enums']['estado_homologacao'];
          frota_id: string;
          frota_nome: string;
          guincheiro_nome: string;
          item_id: string;
          posso_reenviar: boolean;
          tipo: Database['public']['Enums']['tipo_item_homologacao'];
          validade: string;
        }[];
      };
      itens_nao_vigentes: {
        Args: { alvo: Database['public']['Enums']['alvo_homologacao']; alvo_id: string };
        Returns: { situacao: string; tipo: Database['public']['Enums']['tipo_item_homologacao'] }[];
      };
      limite_df: { Args: Record<PropertyKey, never>; Returns: unknown };
      marcar_itens_vencidos: { Args: Record<PropertyKey, never>; Returns: number };
      meu_convite_guincheiro: {
        Args: Record<PropertyKey, never>;
        Returns: {
          frota_nome: string;
          valido_ate: string;
        }[];
      };
      meu_veiculo: {
        Args: Record<PropertyKey, never>;
        Returns: {
          pbt_kg: number;
          placa: string;
          situacao: Database['public']['Enums']['situacao_vinculo'];
          tipo: Database['public']['Enums']['tipo_veiculo_guincho'];
          veiculo_id: string;
          vinculo_id: string;
        }[];
      };
      minha_elegibilidade: {
        Args: Record<PropertyKey, never>;
        Returns: { codigo: string; descricao: string }[];
      };
      nome_do_tipo: {
        Args: { tipo: Database['public']['Enums']['tipo_item_homologacao'] };
        Returns: string;
      };
      pagamento_para_estornar: { Args: { cliente_id: string; pedido_id: string }; Returns: Json };
      participo_da_corrida: { Args: { corrida_id: string }; Returns: boolean };
      pedido_oferecido_a_mim: { Args: { pedido_id: string }; Returns: boolean };
      pendencias_de_ativacao: {
        Args: { frota_id: string };
        Returns: {
          alvo_id: string;
          categoria: string;
          descricao: string;
          ordem: number;
          tipo: Database['public']['Enums']['tipo_item_homologacao'];
        }[];
      };
      perfil_tem_papel: {
        Args: { esperado: Database['public']['Enums']['papel']; perfil_id: string };
        Returns: boolean;
      };
      placa_valida: { Args: { placa: string }; Returns: boolean };
      prazo_alerta_vencimento_dias: { Args: Record<PropertyKey, never>; Returns: number };
      pode_cadastrar_frota: { Args: Record<PropertyKey, never>; Returns: boolean };
      pode_enviar_documento_de_prestador: { Args: Record<PropertyKey, never>; Returns: boolean };
      ponto_no_df: { Args: { latitude: number; longitude: number }; Returns: boolean };
      preco_para_confirmar: { Args: { cliente_id: string; pedido_id: string }; Returns: number };
      reavaliar_frota: { Args: { frota: string }; Returns: undefined };
      recusar_oferta: { Args: { tentativa_id: number }; Returns: undefined };
      reenviar_item_homologacao: {
        Args: { arquivo: string; item_id: string; validade?: string };
        Returns: undefined;
      };
      registrar_estorno: {
        Args: { cliente_id: string; pedido_id: string; referencia_externa: string };
        Returns: undefined;
      };
      registrar_pagamento: {
        Args: {
          cliente_id: string;
          estado: Database['public']['Enums']['estado_pagamento'];
          metodo: Database['public']['Enums']['metodo_pagamento'];
          pedido_id: string;
          provedor: string;
          referencia_externa: string;
          valor: number;
        };
        Returns: string;
      };
      registrar_recotacao: {
        Args: {
          exige_aprovacao: boolean;
          guincheiro_id: string;
          km_ate_veiculo: number;
          pedido_id: string;
          preco_adicional_feriado: number;
          preco_adicional_noturno: number;
          preco_ajuste_minimo: number;
          preco_ate_veiculo: number;
          preco_rebocado: number;
          preco_taxa_base: number;
          preco_total: number;
          rodada: number;
          tentativas_lidas: number;
        };
        Returns: Database['public']['Enums']['resultado_recotacao'];
      };
      registrar_tentativa: {
        Args: {
          guincheiro_id: string;
          km_ate_veiculo: number;
          ordem: number;
          pedido_id: string;
          preco_recalculado: number;
          repasse_oferecido: number;
          resultado: Database['public']['Enums']['resultado_tentativa'];
          rodada: number;
        };
        Returns: number;
      };
      situacao_do_item: {
        Args: { estado: Database['public']['Enums']['estado_homologacao']; validade: string };
        Returns: string;
      };
      sou_cliente_do_pedido: { Args: { pedido_id: string }; Returns: boolean };
      sou_representante_da_frota: { Args: { frota: string }; Returns: boolean };
      renavam_valido: { Args: { renavam: string }; Returns: boolean };
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
      tentar_de_novo: { Args: { pedido_id: string }; Returns: number };
      tipos_exigidos: {
        Args: { alvo: Database['public']['Enums']['alvo_homologacao'] };
        Returns: Database['public']['Enums']['tipo_item_homologacao'][];
      };
      transicao_homologacao_valida: {
        Args: {
          de: Database['public']['Enums']['estado_homologacao'];
          para: Database['public']['Enums']['estado_homologacao'];
        };
        Returns: boolean;
      };
      travar_aprovacao_pendente: {
        Args: { pedido_id: string };
        Returns: {
          criado_em: string;
          expira_em: string | null;
          frota_anterior_id: string;
          frota_nova_id: string;
          guincheiro_id: string;
          id: number;
          km_ate_veiculo: number;
          pedido_id: string;
          preco_adicional_feriado: number;
          preco_adicional_noturno: number;
          preco_ajuste_minimo: number;
          preco_anterior: number;
          preco_ate_veiculo: number;
          preco_novo: number;
          preco_rebocado: number;
          preco_taxa_base: number;
          respondida_em: string | null;
          resultado: Database['public']['Enums']['resultado_recotacao'];
          rodada: number;
          tabela_precos_versao: number;
        };
        SetofOptions: {
          from: '*';
          to: 'recotacoes_pedido';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      travar_match_lido: {
        Args: { pedido_id: string; rodada: number; tentativas_lidas: number };
        Returns: undefined;
      };
      travar_oferta_aberta: {
        Args: { tentativa_id: number };
        Returns: {
          criado_em: string;
          expira_em: string | null;
          guincheiro_id: string;
          id: number;
          km_ate_veiculo: number;
          ordem: number;
          pedido_id: string;
          preco_recalculado: number;
          repasse_oferecido: number;
          respondida_em: string | null;
          resultado: Database['public']['Enums']['resultado_tentativa'];
          rodada: number;
        };
        SetofOptions: {
          from: '*';
          to: 'tentativas_match';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      valer_recotacao: { Args: { recotacao_id: number }; Returns: undefined };
      varrer_aprovacoes_de_preco: { Args: Record<PropertyKey, never>; Returns: string[] };
      validade_antecedentes: { Args: { emissao: string }; Returns: string };
      revalidar_vinculos: {
        Args: { guincheiro?: string; veiculo?: string };
        Returns: number;
      };
      varrer_match: { Args: Record<PropertyKey, never>; Returns: string[] };
      vincular_guincheiro_veiculo: {
        Args: { guincheiro_id: string; veiculo_id: string };
        Returns: Database['public']['Enums']['situacao_vinculo'];
      };
    };
    Enums: {
      abrangencia_feriado: 'nacional' | 'df';
      alvo_homologacao: 'frota' | 'guincheiro' | 'veiculo';
      estado_convite: 'pendente' | 'aceito' | 'cancelado';
      estado_corrida: 'aceita' | 'a_caminho' | 'no_local' | 'carregado' | 'entregue';
      estado_homologacao: 'pendente' | 'aprovado' | 'recusado' | 'vencido';
      estado_pagamento: 'autorizado' | 'capturado' | 'estornado' | 'recusado';
      estado_pedido:
        | 'cotado'
        | 'confirmado'
        | 'em_match'
        | 'atribuido'
        | 'sem_guincheiro'
        | 'estornado'
        | 'aguardando_aprovacao_preco';
      etapa_foto: 'antes' | 'depois';
      metodo_pagamento: 'pix' | 'cartao';
      papel: 'cliente' | 'guincheiro' | 'operacao' | 'representante';
      resultado_recotacao: 'aplicada' | 'pendente' | 'aprovada' | 'desistida' | 'expirada';
      resultado_tentativa: 'oferecida' | 'aceita' | 'recusada' | 'expirada' | 'pulada_teto';
      rodas_giram: 'sim' | 'nao' | 'nao_sei';
      situacao_veiculo: 'nao_liga' | 'batida' | 'superaqueceu' | 'outro';
      situacao_vinculo: 'pendente' | 'ativo';
      tipo_frota: 'empresa' | 'autonomo';
      tipo_item_homologacao:
        'alvara' | 'apolice_rc' | 'crlv' | 'foto_veiculo' | 'cnh' | 'antecedentes' | 'selfie';
      tipo_midia: 'foto' | 'video';
      tipo_veiculo: 'carro' | 'suv' | 'moto' | 'van';
      tipo_veiculo_guincho: 'plataforma' | 'asa_delta' | 'lanca';
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
      alvo_homologacao: ['frota', 'guincheiro', 'veiculo'],
      estado_convite: ['pendente', 'aceito', 'cancelado'],
      estado_corrida: ['aceita', 'a_caminho', 'no_local', 'carregado', 'entregue'],
      estado_homologacao: ['pendente', 'aprovado', 'recusado', 'vencido'],
      estado_pagamento: ['autorizado', 'capturado', 'estornado', 'recusado'],
      estado_pedido: [
        'cotado',
        'confirmado',
        'em_match',
        'atribuido',
        'sem_guincheiro',
        'estornado',
        'aguardando_aprovacao_preco',
      ],
      etapa_foto: ['antes', 'depois'],
      metodo_pagamento: ['pix', 'cartao'],
      papel: ['cliente', 'guincheiro', 'operacao', 'representante'],
      resultado_recotacao: ['aplicada', 'pendente', 'aprovada', 'desistida', 'expirada'],
      resultado_tentativa: ['oferecida', 'aceita', 'recusada', 'expirada', 'pulada_teto'],
      rodas_giram: ['sim', 'nao', 'nao_sei'],
      situacao_veiculo: ['nao_liga', 'batida', 'superaqueceu', 'outro'],
      situacao_vinculo: ['pendente', 'ativo'],
      tipo_frota: ['empresa', 'autonomo'],
      tipo_item_homologacao: [
        'alvara',
        'apolice_rc',
        'crlv',
        'foto_veiculo',
        'cnh',
        'antecedentes',
        'selfie',
      ],
      tipo_midia: ['foto', 'video'],
      tipo_veiculo: ['carro', 'suv', 'moto', 'van'],
      tipo_veiculo_guincho: ['plataforma', 'asa_delta', 'lanca'],
    },
  },
} as const;
