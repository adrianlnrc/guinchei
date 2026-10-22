import { vi } from 'vitest';
import {
  ErroApi,
  LIMITE_FOTOS_POR_ETAPA,
  type Acompanhamento,
  type ApiGuinchei,
  type ArquivoDeMidia,
  type FotoEstado,
  type OpcoesFotoEstado,
  type CadastroCliente,
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
  cep: null,
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

/**
 * Dublê de @guinchei/api em memória: guarda sessão e perfil, aceita só o CODIGO_CERTO e
 * recusa o CPF do Rafael como já cadastrado.
 */
export function apiFalsa({
  sessao = false,
  perfil = null,
  fotos = [],
}: { sessao?: boolean; perfil?: Perfil | null; fotos?: FotoEstado[] } = {}) {
  let logado = sessao;
  let meuPerfil = perfil;
  let telefoneLogado = perfil?.telefone ?? '5561900000006';
  const ouvintes = new Set<(acompanhamento: Acompanhamento) => void>();
  const registradas = [...fotos];

  const api = {
    enviarCodigo: vi.fn<(telefone: string) => Promise<void>>(async () => {}),
    confirmarCodigo: vi.fn(async (telefone: string, codigo: string) => {
      if (codigo !== CODIGO_CERTO) throw new ErroApi('codigo_invalido', 'Código incorreto');
      logado = true;
      telefoneLogado = telefone.replace(/\D/g, '');
    }),
    temSessao: vi.fn(async () => logado),
    telefoneDaSessao: vi.fn(async () => (logado ? telefoneLogado : null)),
    buscarMeuPerfil: vi.fn(async () => (logado ? meuPerfil : null)),
    criarPerfilUrgente: vi.fn(async ({ nome, cpf, cep, termosVersao }: CadastroUrgente) => {
      if (cpf === PERFIL_RAFAEL.cpf) throw new ErroApi('cpf_ja_cadastrado', 'CPF já cadastrado');
      meuPerfil = {
        ...PERFIL_RAFAEL,
        id: 'perfil-novo',
        nome,
        cpf,
        cep,
        telefone: telefoneLogado,
        aceite_termos_versao: termosVersao,
      };
      return meuPerfil;
    }),
    // Como o banco: CPF e telefone ficam; o e-mail vazio apaga o que havia.
    atualizarMeuCadastro: vi.fn(async ({ nome, cep, email }: CadastroCliente) => {
      if (!meuPerfil) throw new ErroApi('sem_sessao', 'Entre com o celular antes');
      meuPerfil = { ...meuPerfil, nome: nome.trim(), cep, email: email?.trim() || null };
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
