import { vi } from 'vitest';
import {
  ErroApi,
  type ApiGuinchei,
  type CadastroUrgente,
  type Perfil,
  type RespostasPedido,
} from '@guinchei/api';

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
  } satisfies ApiGuinchei;
}
