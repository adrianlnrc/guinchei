import { vi } from 'vitest';
import {
  ErroApi,
  LIMITE_FOTOS_POR_ETAPA,
  type Acompanhamento,
  type ApiGuinchei,
  type AvaliacaoDaCorrida,
  type DetalheDoPedido,
  type ResumoDoPedido,
  type ArquivoDeMidia,
  type FotoEstado,
  type OpcoesFotoEstado,
  type CadastroUrgente,
  type EtapaDoAcompanhamento,
  type CotacaoPedido,
  type OfertaAberta,
  type PagamentoAutorizado,
  type PagamentoEstornado,
  type Perfil,
  type RespostasPedido,
  type TrajetoPedido,
} from '@guinchei/api';
import type { MetodoPagamento } from '@guinchei/pagamento';

export const CODIGO_CERTO = '123456';

export const PERFIL_RAFAEL: Perfil = {
  id: '11111111-1111-4111-8111-111111111111',
  papel: 'cliente',
  nome: 'Rafael Souza',
  telefone: '5561900000001',
  cpf: '12345678062',
  aceite_termos_em: '2026-10-17T12:00:00Z',
  aceite_termos_versao: 'provisoria-2026-10',
  email: null,
  data_nascimento: null,
  telefone_secundario: null,
  criado_em: '2026-10-17T12:00:00Z',
};

/**
 * O que o servidor devolveria para um trecho de 3,87 km até o veículo e 12,5 km rebocado,
 * à noite: 110,00 + 19,35 + 75,00 = 204,35; +15% = 30,65; total 235,00. Diferente do
 * cenário do mock, para os testes provarem que a tela mostra o que veio do servidor.
 */
export const COTACAO_DO_SERVIDOR: CotacaoPedido = {
  kmAteVeiculo: 3.87,
  kmRebocado: 12.5,
  tabelaPrecosVersao: 1,
  adicionalNoturno: 0.15,
  adicionalFeriado: 0.2,
  preco: {
    taxaBase: 11000,
    deslocamento: 1935,
    reboque: 7500,
    adicionalNoturno: 3065,
    adicionalFeriado: 0,
    ajustePiso: 0,
    total: 23500,
  },
};

/** Um Acompanhamento na etapa dada; a Corrida (com o Wagner) existe do aceite em diante. */
export function acompanhamentoEm(
  etapa: EtapaDoAcompanhamento,
  parcial: Partial<Acompanhamento> = {},
): Acompanhamento {
  const naCorrida = ['aceita', 'a_caminho', 'no_local', 'carregado', 'entregue'].includes(etapa);
  return {
    pedidoId: 'pedido-novo',
    etapa,
    precoTotal: COTACAO_DO_SERVIDOR.preco.total,
    origemEndereco: 'Eixo Monumental, Brasília',
    destinoEndereco: 'QNA 12, Taguatinga Norte',
    recotacao: null,
    corrida: naCorrida
      ? {
          id: 'corrida-1',
          estado: etapa as Exclude<EtapaDoAcompanhamento, 'cotado' | 'em_match'>,
          guincheiro: { nome: 'Wagner Lopes', frota: 'Reboque Planalto' },
        }
      : null,
    ...parcial,
  } as Acompanhamento;
}

/** Uma Corrida entregue do Rafael, sem avaliação; o `parcial` troca o que o teste precisa. */
export function resumoDoPedido(parcial: Partial<ResumoDoPedido> = {}): ResumoDoPedido {
  return {
    pedidoId: 'pedido-1',
    etapa: 'entregue',
    criadoEm: '2026-10-20T17:30:00Z',
    origemEndereco: 'Eixo Monumental, Brasília',
    destinoEndereco: 'QNA 12, Taguatinga Norte',
    precoTotal: 23500,
    corridaId: 'corrida-1',
    nota: null,
    ...parcial,
  };
}

/** O detalhe correspondente a `resumoDoPedido`: preço de COTACAO_DO_SERVIDOR e o Wagner. */
export function detalheDoPedido(parcial: Partial<DetalheDoPedido> = {}): DetalheDoPedido {
  return {
    pedidoId: 'pedido-1',
    etapa: 'entregue',
    criadoEm: '2026-10-20T17:30:00Z',
    atualizadoEm: '2026-10-20T18:40:00Z',
    origemEndereco: 'Eixo Monumental, Brasília',
    destinoEndereco: 'QNA 12, Taguatinga Norte',
    kmAteVeiculo: 3.87,
    kmRebocado: 12.5,
    precoTotal: COTACAO_DO_SERVIDOR.preco.total,
    preco: {
      taxaBase: 11000,
      ateVeiculo: 1935,
      rebocado: 7500,
      adicionalNoturno: 3065,
      adicionalFeriado: 0,
      ajusteMinimo: 0,
    },
    corrida: {
      id: 'corrida-1',
      estado: 'entregue',
      aceitaEm: '2026-10-20T17:35:00Z',
      atualizadaEm: '2026-10-20T18:40:00Z',
      guincheiro: { nome: 'Wagner Lopes', frota: 'Reboque Planalto' },
    },
    avaliacao: null,
    ...parcial,
  };
}

/**
 * Dublê de @guinchei/api em memória: guarda sessão e perfil, aceita só o CODIGO_CERTO e
 * recusa o CPF do Rafael como já cadastrado.
 */
export function apiFalsa({
  sessao = false,
  perfil = null,
  fotos = [],
  corridas = [],
  detalhes = {},
}: {
  sessao?: boolean;
  perfil?: Perfil | null;
  fotos?: FotoEstado[];
  /** As Corridas do Cliente que `listarMinhasCorridas` devolve (mais recentes primeiro). */
  corridas?: ResumoDoPedido[];
  /** O detalhe de cada Pedido, pelo id; o que não está aqui é `null` (não é do Cliente). */
  detalhes?: Record<string, DetalheDoPedido>;
} = {}) {
  let logado = sessao;
  let meuPerfil = perfil;
  let telefoneLogado = perfil?.telefone ?? '5561900000006';
  const ouvintes = new Set<(acompanhamento: Acompanhamento) => void>();
  const registradas = [...fotos];
  const avaliacoes = new Map<string, AvaliacaoDaCorrida>();
  for (const d of Object.values(detalhes))
    if (d.avaliacao) avaliacoes.set(d.avaliacao.corridaId, d.avaliacao);

  const api = {
    enviarCodigo: vi.fn<(telefone: string) => Promise<void>>(async () => {}),
    confirmarCodigo: vi.fn(async (telefone: string, codigo: string) => {
      if (codigo !== CODIGO_CERTO) throw new ErroApi('codigo_invalido', 'Código incorreto');
      logado = true;
      telefoneLogado = telefone.replace(/\D/g, '');
    }),
    temSessao: vi.fn(async () => logado),
    sair: vi.fn(async () => {
      logado = false;
    }),
    buscarMeuPerfil: vi.fn(async () => (logado ? meuPerfil : null)),
    criarPerfilUrgente: vi.fn(async ({ nome, cpf, termosVersao }: CadastroUrgente) => {
      if (cpf === PERFIL_RAFAEL.cpf) throw new ErroApi('cpf_ja_cadastrado', 'CPF já cadastrado');
      meuPerfil = {
        ...PERFIL_RAFAEL,
        id: 'perfil-novo',
        nome,
        cpf,
        telefone: telefoneLogado,
        aceite_termos_versao: termosVersao,
      };
      return meuPerfil;
    }),
    abrirPedido: vi.fn(async () => 'pedido-novo'),
    atualizarPedido: vi.fn<(id: string, respostas: RespostasPedido) => Promise<void>>(
      async () => {},
    ),
    definirTrajeto: vi.fn<(id: string, trajeto: TrajetoPedido) => Promise<void>>(async () => {}),
    cotarPedido: vi.fn<(id: string) => Promise<CotacaoPedido>>(async () => COTACAO_DO_SERVIDOR),
    confirmarPedido: vi.fn<(id: string, metodo: MetodoPagamento) => Promise<PagamentoAutorizado>>(
      async () => ({
        id: 'pagamento-1',
        estado: 'autorizado',
        valor: COTACAO_DO_SERVIDOR.preco.total,
      }),
    ),
    tentarDeNovo: vi.fn<(pedidoId: string) => Promise<void>>(async () => {}),
    estornarPedido: vi.fn<(pedidoId: string) => Promise<PagamentoEstornado>>(async () => ({
      estado: 'estornado',
      valor: COTACAO_DO_SERVIDOR.preco.total,
    })),
    aprovarNovoPreco: vi.fn<(pedidoId: string) => Promise<void>>(async () => {}),
    desistirDoNovoPreco: vi.fn<(pedidoId: string) => Promise<void>>(async () => {}),
    buscarAcompanhamento: vi.fn<(pedidoId: string) => Promise<Acompanhamento | null>>(
      async (pedidoId) => acompanhamentoEm('em_match', { pedidoId }),
    ),
    buscarAcompanhamentoEmAndamento: vi.fn<() => Promise<Acompanhamento | null>>(async () => null),
    acompanharPedido: vi.fn<
      (pedidoId: string, aoMudar: (acompanhamento: Acompanhamento) => void) => () => void
    >((_pedidoId, aoMudar) => {
      ouvintes.add(aoMudar);
      return () => void ouvintes.delete(aoMudar);
    }),
    buscarOfertasAbertas: vi.fn<() => Promise<OfertaAberta[]>>(async () => []),
    aceitarOferta: vi.fn<(tentativaId: number) => Promise<string>>(async () => 'corrida-1'),
    recusarOferta: vi.fn<(tentativaId: number) => Promise<void>>(async () => {}),
    // Como o banco: até 6 itens por autor e etapa; o autor e a hora são do servidor.
    registrarFotoEstado: vi.fn(
      async (corridaId: string, arquivo: ArquivoDeMidia, opcoes: OpcoesFotoEstado) => {
        const meus = registradas.filter(
          (f) => f.papelAutor === 'cliente' && f.etapa === opcoes.etapa,
        );
        if (meus.length >= LIMITE_FOTOS_POR_ETAPA) {
          throw new ErroApi('limite_de_fotos', 'Limite de 6 itens por etapa atingido.');
        }
        const foto: FotoEstado = {
          id: `foto-${registradas.length + 1}`,
          corridaId,
          papelAutor: 'cliente',
          tipo: arquivo.type.startsWith('video/') ? 'video' : 'foto',
          etapa: opcoes.etapa,
          criadoEm: '2026-10-18T17:40:00Z',
          latitude: opcoes.latitude ?? null,
          longitude: opcoes.longitude ?? null,
          url: `https://armazenamento.teste/foto-${registradas.length + 1}`,
        };
        registradas.push(foto);
        return foto;
      },
    ),
    listarFotosEstado: vi.fn(async () => [...registradas]),
    listarMinhasCorridas: vi.fn<() => Promise<ResumoDoPedido[]>>(async () => [...corridas]),
    buscarDetalheDoPedido: vi.fn<(pedidoId: string) => Promise<DetalheDoPedido | null>>(
      async (pedidoId) => {
        const d = detalhes[pedidoId];
        if (!d) return null;
        const avaliacao = d.corrida ? (avaliacoes.get(d.corrida.id) ?? null) : null;
        return { ...d, avaliacao };
      },
    ),
    // Como o banco: só a Corrida entregue, uma vez, com nota de 1 a 5 e até 280 caracteres.
    avaliarCorrida: vi.fn(async (corridaId: string, nota: number, comentario?: string | null) => {
      if (avaliacoes.has(corridaId)) {
        throw new ErroApi('ja_avaliada', 'Esta Corrida já foi avaliada');
      }
      const gravada: AvaliacaoDaCorrida = {
        corridaId,
        nota,
        comentario: comentario?.trim() || null,
        criadoEm: '2026-10-26T18:00:00Z',
      };
      avaliacoes.set(corridaId, gravada);
      return gravada;
    }),
    buscarMinhaAvaliacao: vi.fn(async (corridaId: string) => avaliacoes.get(corridaId) ?? null),
  } satisfies ApiGuinchei;

  return {
    ...api,
    /** Faz o "Realtime" entregar este estado a quem assinou o acompanhamento. */
    emitir(acompanhamento: Acompanhamento) {
      for (const aoMudar of [...ouvintes]) aoMudar(acompanhamento);
    },
    /** O Guincheiro registrou uma foto (aparece na próxima leitura da galeria). */
    registrarDoGuincheiro(foto: FotoEstado) {
      registradas.push(foto);
    },
    /** Quantas assinaturas do Realtime estão abertas. */
    assinaturasAbertas: () => ouvintes.size,
  };
}
