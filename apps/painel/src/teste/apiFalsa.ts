import { vi } from 'vitest';
import {
  ErroApi,
  type AlertaDeVencimento,
  type ApiPainel,
  type FrotaEmHomologacao,
  type ItemHomologacao,
  type MeuOperador,
  type PedidoAguardandoAprovacao,
  type Perfil,
} from '@guinchei/api';

export const CODIGO_CERTO = '123456';

export const PERFIL_OPERACAO: Perfil = {
  id: '33333333-3333-4333-8333-333333333333',
  papel: 'operacao',
  nome: 'Operação Guinchei',
  telefone: '5561900000005',
  cpf: '56789123482',
  aceite_termos_em: '2026-10-17T12:00:00Z',
  aceite_termos_versao: 'provisoria-2026-10',
  email: null,
  data_nascimento: null,
  telefone_secundario: null,
  criado_em: '2026-10-17T12:00:00Z',
};

export const PERFIL_CLIENTE: Perfil = {
  ...PERFIL_OPERACAO,
  id: '11111111-1111-4111-8111-111111111111',
  papel: 'cliente',
  nome: 'Rafael Souza',
  telefone: '5561900000001',
  cpf: '12345678062',
};

export const PERFIL_GUINCHEIRO: Perfil = {
  ...PERFIL_OPERACAO,
  id: '22222222-2222-4222-8222-222222222201',
  papel: 'guincheiro',
  nome: 'Marcos Alves',
  telefone: '5561900000002',
  cpf: '23456789173',
};

function item(
  id: string,
  campos: Partial<ItemHomologacao> & Pick<ItemHomologacao, 'tipo' | 'enviadoEm'>,
): ItemHomologacao {
  return {
    id,
    alvo: 'frota',
    alvoId: 'f0000000-0000-4000-8000-000000000003',
    estado: 'pendente',
    motivo: null,
    validade: null,
    ...campos,
  };
}

const VEICULO_CAPITAL = 'b1000000-0000-4000-8000-000000000001';

/**
 * Frotas de exemplo da Homologação: "Guincho Capital" enviou primeiro (um item aprovado, dois
 * pendentes e uma CNH vencida), "Rebocadora Sul" depois, e "Reboque Planalto" não tem nada
 * pendente (fora da fila).
 */
export function frotasDeHomologacao(): FrotaEmHomologacao[] {
  return [
    {
      id: 'f0000000-0000-4000-8000-000000000003',
      nome: 'Guincho Capital',
      tipo: 'empresa',
      documento: '11444777000161',
      itens: [
        item('i-alvara', { tipo: 'alvara', estado: 'aprovado', enviadoEm: '2026-10-15T10:00:00Z' }),
        item('i-apolice', {
          tipo: 'apolice_rc',
          validade: '2027-10-15',
          enviadoEm: '2026-10-15T10:05:00Z',
        }),
        item('i-cnh', {
          tipo: 'cnh',
          alvo: 'guincheiro',
          estado: 'vencido',
          validade: '2026-09-30',
          enviadoEm: '2026-10-15T10:10:00Z',
        }),
        item('i-crlv', {
          tipo: 'crlv',
          alvo: 'veiculo',
          alvoId: VEICULO_CAPITAL,
          enviadoEm: '2026-10-16T09:00:00Z',
        }),
        item('i-foto-1', {
          tipo: 'foto_veiculo',
          alvo: 'veiculo',
          alvoId: VEICULO_CAPITAL,
          estado: 'aprovado',
          enviadoEm: '2026-10-16T09:00:01Z',
        }),
        item('i-foto-2', {
          tipo: 'foto_veiculo',
          alvo: 'veiculo',
          alvoId: VEICULO_CAPITAL,
          estado: 'recusado',
          motivo: 'Foto escura',
          enviadoEm: '2026-10-16T09:00:02Z',
        }),
      ],
      veiculos: [{ id: VEICULO_CAPITAL, placa: 'PBX1D23', tipo: 'plataforma', pbtKg: 4500 }],
    },
    {
      id: 'f0000000-0000-4000-8000-000000000004',
      nome: 'Rebocadora Sul',
      tipo: 'autonomo',
      documento: '45678912364',
      itens: [item('i-sul-alvara', { tipo: 'alvara', enviadoEm: '2026-10-17T08:00:00Z' })],
      veiculos: [],
    },
    {
      id: 'f0000000-0000-4000-8000-000000000001',
      nome: 'Reboque Planalto',
      tipo: 'empresa',
      documento: '11222333000181',
      itens: [
        item('i-plan-alvara', {
          tipo: 'alvara',
          estado: 'aprovado',
          enviadoEm: '2026-10-01T08:00:00Z',
        }),
      ],
      veiculos: [],
    },
  ];
}

/**
 * Dublê de @guinchei/api para o Painel, em memória: aceita só o CODIGO_CERTO e só devolve
 * operador se o perfil do login tem papel `operacao` (como a API real).
 */
export function apiFalsa({
  sessao = false,
  perfil = PERFIL_OPERACAO,
  frotas = frotasDeHomologacao(),
  vencimentos = { prazoDias: 30, itens: [] },
  aguardandoAprovacao = [],
}: {
  sessao?: boolean;
  perfil?: Perfil | null;
  frotas?: FrotaEmHomologacao[];
  vencimentos?: AlertaDeVencimento;
  aguardandoAprovacao?: PedidoAguardandoAprovacao[];
} = {}) {
  let logado = sessao;
  const todosOsItens = () => frotas.flatMap((f) => f.itens);
  const pendente = (id: string) => {
    const achado = todosOsItens().find((i) => i.id === id);
    if (!achado) throw new ErroApi('item_indisponivel', 'Este item não existe mais');
    if (achado.estado !== 'pendente') {
      throw new ErroApi('transicao_invalida', 'Este item já foi decidido ou aguarda reenvio');
    }
    return achado;
  };

  const api = {
    enviarCodigo: vi.fn<(telefone: string) => Promise<void>>(async () => {}),
    confirmarCodigo: vi.fn(async (_telefone: string, codigo: string) => {
      if (codigo !== CODIGO_CERTO) throw new ErroApi('codigo_invalido', 'Código incorreto');
      logado = true;
    }),
    temSessao: vi.fn(async () => logado),
    buscarMeuPerfil: vi.fn(async () => (logado ? perfil : null)),
    sair: vi.fn(async () => {
      logado = false;
    }),
    buscarMeuOperador: vi.fn(async (): Promise<MeuOperador | null> =>
      logado && perfil?.papel === 'operacao' ? { nome: perfil.nome } : null,
    ),
    listarPedidosAguardandoAprovacao: vi.fn(async () => aguardandoAprovacao),
    // Como o banco: a fila é das Frotas com item pendente, a de envio mais antigo primeiro.
    listarFilaHomologacao: vi.fn(async () =>
      frotas
        .map((f) => ({ f, pendentes: f.itens.filter((i) => i.estado === 'pendente') }))
        .filter(({ pendentes }) => pendentes.length > 0)
        .map(({ f, pendentes }) => ({
          id: f.id,
          nome: f.nome,
          tipo: f.tipo,
          documento: f.documento,
          pendentes: pendentes.length,
          enviadoEm: pendentes.map((i) => i.enviadoEm).sort()[0]!,
        }))
        .sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm)),
    ),
    buscarFrotaHomologacao: vi.fn(async (frotaId: string) => {
      const achada = frotas.find((f) => f.id === frotaId);
      return achada ? { ...achada, itens: achada.itens.map((i) => ({ ...i })) } : null;
    }),
    aprovarItem: vi.fn(async (itemId: string) => {
      pendente(itemId).estado = 'aprovado';
    }),
    recusarItem: vi.fn(async (itemId: string, motivo: string) => {
      const achado = pendente(itemId);
      if (!motivo.trim()) throw new ErroApi('motivo_obrigatorio', 'Diga o motivo da recusa');
      achado.estado = 'recusado';
      achado.motivo = motivo.trim();
    }),
    urlDoDocumento: vi.fn(async (itemId: string) => `https://documentos.exemplo/${itemId}?token=x`),
    listarVencimentos: vi.fn(async (): Promise<AlertaDeVencimento> => vencimentos),
  } satisfies ApiPainel;

  return api;
}

export type ApiFalsa = ReturnType<typeof apiFalsa>;
