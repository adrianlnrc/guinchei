import { vi } from 'vitest';
import { ErroApi, type ApiPainel, type MeuOperador, type Perfil } from '@guinchei/api';

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

/**
 * Dublê de @guinchei/api para o Painel, em memória: aceita só o CODIGO_CERTO e só devolve
 * operador se o perfil do login tem papel `operacao` (como a API real).
 */
export function apiFalsa({
  sessao = false,
  perfil = PERFIL_OPERACAO,
}: { sessao?: boolean; perfil?: Perfil | null } = {}) {
  let logado = sessao;

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
  } satisfies ApiPainel;

  return api;
}

export type ApiFalsa = ReturnType<typeof apiFalsa>;
