import { vi } from 'vitest';
import {
  ErroApi,
  LIMITE_FOTOS_POR_ETAPA,
  LIMITE_FOTOS_VEICULO,
  PBT_MAXIMO_KG,
  PBT_MINIMO_KG,
  TAMANHO_MAXIMO_DOCUMENTO_BYTES,
  estadoDoVeiculo,
  type ApiGuincheiro,
  type ArquivoDeMidia,
  type DadosVeiculo,
  type VeiculoDaFrota,
  type FotoEstado,
  type OpcoesFotoEstado,
  type CorridaDoGuincheiro,
  type EstadoCorrida,
  type MeuGuincheiro,
  type MinhaFrota,
  type OfertaAberta,
  type Perfil,
  type RascunhoFrota,
} from '@guinchei/api';
import { podeTransitar } from '@guinchei/estados';
import {
  normalizarPlaca,
  normalizarRenavam,
  placaValida,
  renavamValido,
} from '@guinchei/documentos';

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

/** Quem acabou de cadastrar a Frota: representante, ainda sem linha em `guincheiros`. */
export const PERFIL_AURORA: Perfil = {
  ...PERFIL_MARCOS,
  id: '55555555-5555-4555-8555-555555555555',
  papel: 'representante',
  nome: 'Aurora Lima',
  telefone: '5561900000008',
  cpf: '52998224725',
  aceite_termos_versao: 'prestadores-provisoria-2026-10',
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

/** Um veículo já cadastrado pela Aurora, com o CRLV aprovado e as fotos em análise. */
export const VEICULO_APROVADO: VeiculoDaFrota = {
  id: 'veiculo-1',
  placa: 'ABC1D23',
  renavam: '63936443047',
  tipo: 'plataforma',
  pbtKg: 4500,
  estado: 'aprovado',
  itens: [
    {
      id: 'v1-crlv',
      alvo: 'veiculo',
      alvoId: 'veiculo-1',
      tipo: 'crlv',
      estado: 'aprovado',
      motivo: null,
      validade: null,
      enviadoEm: '2026-10-18T12:00:00Z',
    },
    {
      id: 'v1-foto-1',
      alvo: 'veiculo',
      alvoId: 'veiculo-1',
      tipo: 'foto_veiculo',
      estado: 'aprovado',
      motivo: null,
      validade: null,
      enviadoEm: '2026-10-18T12:00:01Z',
    },
  ],
};

/** Um veículo com a foto recusada e o CRLV ainda em análise. */
export const VEICULO_RECUSADO: VeiculoDaFrota = {
  id: 'veiculo-2',
  placa: 'XYZ9876',
  renavam: '12345678900',
  tipo: 'lanca',
  pbtKg: 3200,
  estado: 'recusado',
  itens: [
    {
      id: 'v2-crlv',
      alvo: 'veiculo',
      alvoId: 'veiculo-2',
      tipo: 'crlv',
      estado: 'pendente',
      motivo: null,
      validade: null,
      enviadoEm: '2026-10-18T13:00:00Z',
    },
    {
      id: 'v2-foto-1',
      alvo: 'veiculo',
      alvoId: 'veiculo-2',
      tipo: 'foto_veiculo',
      estado: 'recusado',
      motivo: 'Foto escura: refaça de dia',
      validade: null,
      enviadoEm: '2026-10-18T13:00:01Z',
    },
  ],
};

export const ITEM_ALVARA: MinhaFrota['itens'][number] = {
  id: 'item-alvara',
  alvo: 'frota',
  alvoId: 'frota-nova',
  tipo: 'alvara',
  estado: 'pendente',
  motivo: null,
  validade: null,
  enviadoEm: '2026-10-18T12:00:00Z',
};

export const ITEM_APOLICE: MinhaFrota['itens'][number] = {
  id: 'item-apolice',
  alvo: 'frota',
  alvoId: 'frota-nova',
  tipo: 'apolice_rc',
  estado: 'pendente',
  motivo: null,
  validade: '2027-10-18',
  enviadoEm: '2026-10-18T12:00:00Z',
};

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
  fotos = [],
  rascunho = null,
  frota = null,
  veiculos = [],
  telefone = '5561900000008',
}: {
  sessao?: boolean;
  perfil?: Perfil | null;
  disponivel?: boolean;
  corrida?: CorridaDoGuincheiro | null;
  ofertas?: OfertaAberta[];
  /** Fotos de estado que a Corrida já tem (dos dois lados). */
  fotos?: FotoEstado[];
  /** Cadastro de Frota em andamento, guardado no banco. */
  rascunho?: RascunhoFrota | null;
  /** A Frota que a pessoa logada já cadastrou. */
  frota?: MinhaFrota | null;
  /** Os veículos que a Frota já tem. */
  veiculos?: VeiculoDaFrota[];
  /** Telefone do login (dígitos, com o 55). */
  telefone?: string;
} = {}) {
  let logado = sessao;
  let perfilAtual = perfil;
  let rascunhoAtual = rascunho;
  let frotaAtual = frota;
  const veiculosAtuais = structuredClone(veiculos);
  const arquivosEnviados: string[] = [];
  let estaDisponivel = disponivel;
  let abertas = [...ofertas];
  let atual = corrida;
  const entregues = new Map<string, CorridaDoGuincheiro>();
  const ouvintes = new Set<() => void>();
  const registradas = [...fotos];

  const api = {
    enviarCodigo: vi.fn<(telefone: string) => Promise<void>>(async () => {}),
    confirmarCodigo: vi.fn(async (_telefone: string, codigo: string) => {
      if (codigo !== CODIGO_CERTO) throw new ErroApi('codigo_invalido', 'Código incorreto');
      logado = true;
    }),
    temSessao: vi.fn(async () => logado),
    buscarMeuPerfil: vi.fn(async () => (logado ? perfilAtual : null)),
    sair: vi.fn(async () => {
      logado = false;
    }),
    buscarMeuGuincheiro: vi.fn(async (): Promise<MeuGuincheiro | null> =>
      logado && perfilAtual?.papel === 'guincheiro'
        ? { nome: perfilAtual.nome, frota: 'Reboque Planalto', disponivel: estaDisponivel }
        : null,
    ),
    telefoneDaSessao: vi.fn(async () => (logado ? telefone : null)),
    buscarRascunhoFrota: vi.fn(async () => rascunhoAtual),
    salvarRascunhoFrota: vi.fn(async (novo: RascunhoFrota) => {
      rascunhoAtual = structuredClone(novo);
    }),
    // Como o servidor: PDF ou imagem de até 10 MiB, na pasta de quem envia.
    enviarDocumentoDaFrota: vi.fn(async (arquivo: ArquivoDeMidia) => {
      if (arquivo.type !== 'application/pdf' && !arquivo.type.startsWith('image/')) {
        throw new ErroApi('arquivo_invalido', 'Formato não aceito. Envie um PDF ou uma foto.');
      }
      if (arquivo.size > TAMANHO_MAXIMO_DOCUMENTO_BYTES) {
        throw new ErroApi('arquivo_grande', 'O arquivo passa de 10 MB.');
      }
      const caminho = `${PERFIL_AURORA.id}/documento-${arquivosEnviados.length + 1}.pdf`;
      arquivosEnviados.push(caminho);
      return caminho;
    }),
    enviarCadastroFrota: vi.fn(async () => {
      if (!rascunhoAtual) {
        throw new ErroApi('sem_cadastro_em_andamento', 'Não há cadastro em andamento');
      }
      const d = rascunhoAtual.dados;
      perfilAtual = {
        ...PERFIL_AURORA,
        nome: d.representanteNome ?? '',
        cpf: d.representanteCpf ?? '',
      };
      frotaAtual = {
        id: 'frota-nova',
        tipo: 'autonomo',
        documento: d.documento ?? '',
        nome: d.nome ?? '',
        ativa: false,
        baseCep: d.baseCep ?? null,
        baseEndereco: d.baseEndereco ?? null,
        baseBairro: d.baseBairro ?? null,
        chavePix: d.chavePix ?? null,
        apoliceValidade: d.apoliceValidade ?? null,
        termosPrestadorVersao: d.termosVersao ?? null,
        itens: [ITEM_ALVARA, { ...ITEM_APOLICE, validade: d.apoliceValidade ?? null }],
      };
      rascunhoAtual = null;
      return frotaAtual.id;
    }),
    buscarMinhaFrota: vi.fn(async () => (logado ? frotaAtual : null)),
    // Como o servidor: PDF só no CRLV, imagem nas fotos, até 10 MiB.
    enviarArquivoDoVeiculo: vi.fn(async (arquivo: ArquivoDeMidia, finalidade: 'crlv' | 'foto') => {
      const imagem = arquivo.type.startsWith('image/');
      if (!imagem && !(finalidade === 'crlv' && arquivo.type === 'application/pdf')) {
        throw new ErroApi('arquivo_invalido', 'Formato não aceito.');
      }
      if (arquivo.size > TAMANHO_MAXIMO_DOCUMENTO_BYTES) {
        throw new ErroApi('arquivo_grande', 'O arquivo passa de 10 MB.');
      }
      const caminho = `${PERFIL_AURORA.id}/veiculo-${arquivosEnviados.length + 1}.${imagem ? 'jpg' : 'pdf'}`;
      arquivosEnviados.push(caminho);
      return caminho;
    }),
    // Como o banco: placa e RENAVAM válidos e únicos, PBT na faixa, de 1 a 6 fotos.
    cadastrarVeiculo: vi.fn(async (dados: DadosVeiculo) => {
      const placa = normalizarPlaca(dados.placa);
      const renavam = normalizarRenavam(dados.renavam);
      if (!placaValida(placa)) throw new ErroApi('placa_invalida', 'Placa inválida.');
      if (!renavamValido(renavam)) throw new ErroApi('renavam_invalido', 'RENAVAM inválido.');
      if (dados.pbtKg < PBT_MINIMO_KG || dados.pbtKg > PBT_MAXIMO_KG) {
        throw new ErroApi('veiculo_dados_invalidos', 'PBT fora da faixa.');
      }
      if (dados.fotosArquivos.length < 1 || dados.fotosArquivos.length > LIMITE_FOTOS_VEICULO) {
        throw new ErroApi('fotos_do_veiculo', 'Envie de 1 a 6 fotos do veículo.');
      }
      if (veiculosAtuais.some((v) => v.placa === placa || v.renavam === renavam)) {
        throw new ErroApi(
          'veiculo_duplicado',
          'Já existe um veículo cadastrado com esta placa ou este RENAVAM.',
        );
      }
      const id = `veiculo-${veiculosAtuais.length + 1}-novo`;
      const itens = [
        { tipo: 'crlv' as const, arquivo: dados.crlvArquivo },
        ...dados.fotosArquivos.map((arquivo) => ({ tipo: 'foto_veiculo' as const, arquivo })),
      ].map((i, n) => ({
        id: `${id}-${n}`,
        alvo: 'veiculo' as const,
        alvoId: id,
        tipo: i.tipo,
        estado: 'pendente' as const,
        motivo: null,
        validade: null,
        enviadoEm: `2026-10-18T14:00:0${n}Z`,
      }));
      veiculosAtuais.push({
        id,
        placa,
        renavam,
        tipo: dados.tipo,
        pbtKg: dados.pbtKg,
        estado: estadoDoVeiculo(itens),
        itens,
      });
      return id;
    }),
    listarMeusVeiculos: vi.fn(async () => structuredClone(veiculosAtuais)),
    reenviarItemDeVeiculo: vi.fn(async (itemId: string, arquivo: string) => {
      if (!arquivo) throw new ErroApi('documento_ausente', 'Um arquivo não chegou ao servidor.');
      for (const v of veiculosAtuais) {
        const item = v.itens.find((i) => i.id === itemId);
        if (!item) continue;
        if (item.estado !== 'recusado' && item.estado !== 'vencido') {
          throw new ErroApi('transicao_invalida', 'Só se reenvia item recusado ou vencido');
        }
        item.estado = 'pendente';
        item.motivo = null;
        v.estado = estadoDoVeiculo(v.itens);
        return;
      }
      throw new ErroApi('item_indisponivel', 'Este item não existe mais');
    }),
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
    // Como o banco: até 6 itens por autor e etapa; a hora e o autor são do servidor.
    registrarFotoEstado: vi.fn(
      async (corridaId: string, arquivo: ArquivoDeMidia, opcoes: OpcoesFotoEstado) => {
        const meus = registradas.filter(
          (f) => f.papelAutor === 'guincheiro' && f.etapa === opcoes.etapa,
        );
        if (meus.length >= LIMITE_FOTOS_POR_ETAPA) {
          throw new ErroApi('limite_de_fotos', 'Limite de 6 itens por etapa atingido.');
        }
        const foto: FotoEstado = {
          id: `foto-${registradas.length + 1}`,
          corridaId,
          papelAutor: 'guincheiro',
          tipo: arquivo.type.startsWith('video/') ? 'video' : 'foto',
          etapa: opcoes.etapa,
          criadoEm: new Date(agoraNoServidor()).toISOString(),
          latitude: opcoes.latitude ?? null,
          longitude: opcoes.longitude ?? null,
          url: `https://armazenamento.teste/foto-${registradas.length + 1}`,
        };
        registradas.push(foto);
        return foto;
      },
    ),
    listarFotosEstado: vi.fn(async () => [...registradas]),
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
