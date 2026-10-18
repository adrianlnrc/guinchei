import { vi } from 'vitest';
import {
  ErroApi,
  type ApiGuinchei,
  type CadastroUrgente,
  type CotacaoPedido,
  type PagamentoAutorizado,
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

/**
 * Dublê de @guinchei/api em memória: guarda sessão e perfil, aceita só o CODIGO_CERTO e
 * recusa o CPF do Rafael como já cadastrado.
 */
export function apiFalsa({
  sessao = false,
  perfil = null,
}: { sessao?: boolean; perfil?: Perfil | null } = {}) {
  let logado = sessao;
  let meuPerfil = perfil;
  let telefoneLogado = perfil?.telefone ?? '5561900000006';

  return {
    enviarCodigo: vi.fn<(telefone: string) => Promise<void>>(async () => {}),
    confirmarCodigo: vi.fn(async (telefone: string, codigo: string) => {
      if (codigo !== CODIGO_CERTO) throw new ErroApi('codigo_invalido', 'Código incorreto');
      logado = true;
      telefoneLogado = telefone.replace(/\D/g, '');
    }),
    temSessao: vi.fn(async () => logado),
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
  } satisfies ApiGuinchei;
}
