import { vi } from 'vitest';
import {
  ErroApi,
  type ApiGuincheiro,
  type CorridaDoGuincheiro,
  type EstadoCorrida,
  type MeuGuincheiro,
  type OfertaAberta,
  type Perfil,
} from '@guinchei/api';
import { podeTransitar } from '@guinchei/estados';

export const CODIGO_CERTO = '123456';

export const PERFIL_MARCOS: Perfil = {
  id: '22222222-2222-4222-8222-222222222201',
  papel: 'guincheiro',
  nome: 'Marcos Alves',
  telefone: '5561900000002',
  cpf: '23456789173',
  aceite_termos_em: '2026-10-17T12:00:00Z',
  aceite_termos_versao: 'provisoria-2026-10',
  email: null,
  data_nascimento: null,
  telefone_secundario: null,
  criado_em: '2026-10-17T12:00:00Z',
};

export const PERFIL_RAFAEL: Perfil = {
  ...PERFIL_MARCOS,
  id: '11111111-1111-4111-8111-111111111111',
  papel: 'cliente',
  nome: 'Rafael Souza',
  telefone: '5561900000001',
  cpf: '12345678062',
};

/** Diferença do relógio do servidor para o do aparelho nos testes: o aparelho está 1 h atrasado. */
export const DESVIO_DO_SERVIDOR_MS = 60 * 60 * 1000;
export const agoraNoServidor = () => Date.now() + DESVIO_DO_SERVIDOR_MS;

/**
 * Oferta com valores diferentes do cenário do mock, para os testes provarem que a tela
 * mostra o que veio do servidor: R$ 213,44 de repasse pela distância dele (5,1 km).
 */
export function ofertaDeTeste(segundosParaVencer = 25): OfertaAberta {
  return {
    tentativaId: 41,
    pedidoId: 'pedido-1',
    rodada: 1,
    kmAteVeiculo: 5.1,
    precoRecalculado: 26680,
    repasse: 21344,
    expiraEm: new Date(agoraNoServidor() + segundosParaVencer * 1000).toISOString(),
    pedido: {
      origemEndereco: 'SQS 308, Asa Sul',
      destinoEndereco: 'Oficina do Zé, QNM 40, Ceilândia',
      kmRebocado: 24.6,
      tipoVeiculo: 'suv',
      situacao: 'batida',
      rodasGiram: 'nao',
    },
  };
}

function corridaDaOferta(oferta: OfertaAberta, estado: EstadoCorrida): CorridaDoGuincheiro {
  return {
    id: 'corrida-1',
    pedidoId: oferta.pedidoId,
    estado,
    repasse: oferta.repasse,
    precoRecalculado: oferta.precoRecalculado,
    kmAteVeiculo: oferta.kmAteVeiculo,
    atualizadoEm: new Date(agoraNoServidor()).toISOString(),
    pedido: oferta.pedido,
  };
}

/**
 * Dublê de @guinchei/api para o app do Guincheiro, em memória: aceita só o CODIGO_CERTO,
 * confere as transições da Corrida com @guinchei/estados (como o banco) e deixa o teste
 * mandar ofertas "pelo Realtime" (`ofertar`).
 */
export function apiFalsa({
  sessao = false,
  perfil = PERFIL_MARCOS,
  disponivel = true,
  corrida = null,
  ofertas = [],
}: {
  sessao?: boolean;
  perfil?: Perfil | null;
  disponivel?: boolean;
  corrida?: CorridaDoGuincheiro | null;
  ofertas?: OfertaAberta[];
} = {}) {
  let logado = sessao;
  let estaDisponivel = disponivel;
  let abertas = [...ofertas];
  let atual = corrida;
  const entregues = new Map<string, CorridaDoGuincheiro>();
  const ouvintes = new Set<() => void>();

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
    buscarMeuGuincheiro: vi.fn(async (): Promise<MeuGuincheiro | null> =>
      logado && perfil?.papel === 'guincheiro'
        ? { nome: perfil.nome, frota: 'Reboque Planalto', disponivel: estaDisponivel }
        : null,
    ),
    definirDisponibilidade: vi.fn(async (valor: boolean) => {
      estaDisponivel = valor;
    }),
    horaDoServidor: vi.fn(async () => new Date(agoraNoServidor()).toISOString()),
    buscarOfertasAbertas: vi.fn(async () => abertas),
    aceitarOferta: vi.fn(async (tentativaId: number) => {
      const oferta = abertas.find((o) => o.tentativaId === tentativaId);
      if (!oferta) throw new ErroApi('oferta_indisponivel', 'Oferta indisponível');
      abertas = abertas.filter((o) => o !== oferta);
      atual = corridaDaOferta(oferta, 'aceita');
      estaDisponivel = false;
      return atual.id;
    }),
    recusarOferta: vi.fn(async (tentativaId: number) => {
      abertas = abertas.filter((o) => o.tentativaId !== tentativaId);
    }),
    minhaCorridaAtual: vi.fn(async () => atual),
    buscarCorrida: vi.fn(
      async (id: string) => (atual?.id === id ? atual : entregues.get(id)) ?? null,
    ),
    avancarCorrida: vi.fn(async (id: string, para: EstadoCorrida) => {
      if (!atual || atual.id !== id)
        throw new ErroApi('corrida_indisponivel', 'Corrida não encontrada');
      if (!podeTransitar('corrida', atual.estado, para)) {
        throw new ErroApi('transicao_invalida', 'A Corrida está em outra etapa');
      }
      atual = { ...atual, estado: para };
      if (para === 'entregue') {
        entregues.set(id, atual);
        atual = null;
        estaDisponivel = true;
      }
      return para;
    }),
    assinarOfertas: vi.fn((aoMudar: () => void) => {
      ouvintes.add(aoMudar);
      aoMudar();
      return () => void ouvintes.delete(aoMudar);
    }),
    assinarCorrida: vi.fn(
      (_id: string, _aoMudar: (estado: EstadoCorrida) => void, aoConectar?: () => void) => {
        aoConectar?.();
        return () => {};
      },
    ),
  } satisfies ApiGuincheiro;

  return {
    ...api,
    /** Uma oferta nova chega, como pelo Realtime. */
    ofertar(oferta: OfertaAberta) {
      abertas = [...abertas, oferta];
      ouvintes.forEach((avisar) => avisar());
    },
    /** A Corrida muda fora do app (outra aba): o próximo avanço vê o estado novo. */
    mudarCorrida(estado: EstadoCorrida) {
      if (atual) atual = { ...atual, estado };
    },
  };
}

export type ApiFalsa = ReturnType<typeof apiFalsa>;
export { corridaDaOferta };
