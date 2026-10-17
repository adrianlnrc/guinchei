// Cenário do protótipo: terça, 21:47, Rafael parado no Eixo Monumental.
// Nomes, valores e histórico são de exemplo (ver chats/ do handoff de design).
import type { EstadoCorrida } from '@guinchei/estados';
import { calcularPrecoFechado, calcularRepasse } from './simulacao';

export * from './simulacao';

export const QUANDO = new Date(2026, 9, 13, 21, 47);

export const CLIENTE = {
  nome: 'Rafael',
  nomeCurto: 'Rafael S.',
  iniciais: 'RS',
  celular: '(61) 99812-4470',
  veiculoDescricao: 'Sedã prata · ao lado do canteiro',
};

export const GUINCHEIRO = {
  nome: 'Marcos Alves',
  primeiroNome: 'Marcos',
  iniciais: 'MA',
  nota: '4,9',
  corridas: '1.284',
  frota: 'Reboque Planalto',
  plantao: 'Plantão 18:00–06:00 · desde 18:02',
  ganhoHoje: 41240,
  corridasHoje: 2,
  ganhoMinimo: 35000,
};

export const TRECHO = {
  origem: 'Eixo Monumental, próx. Torre de TV',
  destinoCurto: 'QNA 12, Taguatinga Norte',
  destino: 'Auto Mecânica Irmãos, QNA 12, Taguatinga Norte',
  oficina: 'Auto Mecânica Irmãos',
  bairroDestino: 'Taguatinga Norte',
  kmDeslocamento: 4.2,
  kmReboque: 21.3,
  minutosAteCliente: 14,
  coordenadas: '-15.7903, -47.8921',
};

export const PRECO = calcularPrecoFechado({
  kmDeslocamento: TRECHO.kmDeslocamento,
  kmReboque: TRECHO.kmReboque,
  quando: QUANDO,
});
export const REPASSE = calcularRepasse(PRECO.total);

export const VEICULOS = [
  { valor: 'carro', rotulo: 'Carro de passeio', curto: 'Carro' },
  { valor: 'suv', rotulo: 'SUV ou picape', curto: 'SUV/picape' },
  { valor: 'moto', rotulo: 'Moto', curto: 'Moto' },
  { valor: 'van', rotulo: 'Van ou utilitário', curto: 'Van' },
] as const;

export const SITUACOES = [
  { valor: 'nao_liga', rotulo: 'Parou e não liga', curto: 'Não liga' },
  { valor: 'batida', rotulo: 'Batida ou acidente', curto: 'Batida' },
  { valor: 'superaqueceu', rotulo: 'Superaqueceu', curto: 'Superaqueceu' },
  { valor: 'outro', rotulo: 'Outro motivo', curto: 'Outro' },
] as const;

export const RODAS = [
  { valor: 'sim', rotulo: 'Sim', chip: '4 rodas giram' },
  { valor: 'nao', rotulo: 'Não', chip: 'Rodas travadas' },
  { valor: 'nao_sei', rotulo: 'Não sei', chip: 'Rodas: não sabe' },
] as const;

export type Veiculo = (typeof VEICULOS)[number]['valor'];
export type Situacao = (typeof SITUACOES)[number]['valor'];
export type Rodas = (typeof RODAS)[number]['valor'];

export const LADOS = ['Frente', 'Traseira', 'Lateral esquerda', 'Lateral direita'] as const;

export interface CorridaHistorico {
  quando: string;
  trecho: string;
  pessoa: string;
  nota?: number;
  valor: number;
  estado: 'Entregue' | 'Cancelada';
  km?: string;
}

export const HISTORICO_CLIENTE: CorridaHistorico[] = [
  {
    quando: '02 jun 2026 · 07:40',
    trecho: 'Águas Claras → Asa Sul',
    pessoa: 'Jéssica Prado',
    nota: 5,
    valor: 21430,
    estado: 'Entregue',
  },
  {
    quando: '11 mar 2026 · 18:15',
    trecho: 'Taguatinga Sul → Ceilândia',
    pessoa: 'Taxa de cancelamento',
    valor: 3000,
    estado: 'Cancelada',
  },
];

export const HISTORICO_GUINCHEIRO: CorridaHistorico[] = [
  {
    quando: '20:05',
    km: '22,1 km',
    trecho: 'Guará II → Asa Norte',
    pessoa: 'Luciana M.',
    nota: 5,
    valor: 18840,
    estado: 'Entregue',
  },
  {
    quando: '18:40',
    km: '31,5 km',
    trecho: 'Sobradinho → Lago Norte',
    pessoa: 'Paulo T.',
    nota: 4,
    valor: 22400,
    estado: 'Entregue',
  },
];

// ---------- Painel de operação ----------

export interface CorridaMonitor {
  id: number;
  trecho: string;
  guincheiro?: string;
  detalhe?: string;
  estado: EstadoCorrida | 'sem_aceite';
  minutos: number;
}

export const MONITOR: CorridaMonitor[] = [
  {
    id: 2318,
    trecho: 'Ceilândia → Samambaia',
    detalhe: '3 recusas · broadcast enviado',
    estado: 'sem_aceite',
    minutos: 4,
  },
  {
    id: 2317,
    trecho: 'Eixo Monumental → Taguatinga N.',
    guincheiro: 'Marcos Alves · Reboque Planalto',
    estado: 'a_caminho',
    minutos: 6,
  },
  {
    id: 2315,
    trecho: 'Gama → Park Way',
    guincheiro: 'Diego Ramos · SOS Gama',
    estado: 'no_local',
    minutos: 19,
  },
  {
    id: 2314,
    trecho: 'Asa Norte → SIA',
    guincheiro: 'Jéssica Prado · Reboque Planalto',
    estado: 'carregado',
    minutos: 31,
  },
  {
    id: 2312,
    trecho: 'Sobradinho → Lago Norte',
    guincheiro: 'Paulo Lima · Guincho Norte',
    estado: 'carregado',
    minutos: 38,
  },
  {
    id: 2311,
    trecho: 'Guará II → Asa Sul',
    guincheiro: 'André Souza · SOS Gama',
    estado: 'aceita',
    minutos: 1,
  },
];

export const GUINCHEIROS_DISPONIVEIS = [
  { nome: 'Wagner Lopes', frota: 'Guincho Norte', km: 5.8 },
  { nome: 'Fábio Nunes', frota: 'SOS Gama', km: 7.1 },
  { nome: 'Rita Campos', frota: 'Reboque Planalto', km: 9.4 },
];

export const INDICADORES = {
  atendidos30: { pct: '86%', de: '25 de 29 Pedidos' },
  emCurso: 5,
  disponiveis: 9,
  notaMedia: '4,8',
};

export type SituacaoItem = 'Aprovado' | 'Revisar' | 'Pendente';

export interface FrotaHomologacao {
  id: string;
  nome: string;
  cnpj: string;
  cidade: string;
  enviado: string;
  resumo: string;
  itens: { nome: string; detalhe: string; status: string; situacao: SituacaoItem }[];
  emRevisao?: {
    documento: string;
    guincheiro: string;
    categoria: string;
    validade: string;
    nota: string;
  };
  emEnvio?: boolean;
  ativada?: boolean;
}

export const FILA_HOMOLOGACAO: FrotaHomologacao[] = [
  {
    id: 'cerrado',
    nome: 'Guincho Cerrado Ltda.',
    cnpj: '41.208.337/0001-52',
    cidade: 'Ceilândia, DF',
    enviado: 'Enviado há 2 dias',
    resumo: '3 guinchos · 4 Guincheiros',
    itens: [
      {
        nome: 'CNPJ ativo',
        detalhe: 'Consulta Receita Federal',
        status: 'Verificado 15/10',
        situacao: 'Aprovado',
      },
      {
        nome: 'Contrato assinado',
        detalhe: 'Termos de parceria v1.2',
        status: 'Assinado 15/10',
        situacao: 'Aprovado',
      },
      {
        nome: 'Registro DETRAN como reboque',
        detalhe: '3 veículos',
        status: '3 de 3 CRLV',
        situacao: 'Aprovado',
      },
      {
        nome: 'CNH dos Guincheiros',
        detalhe: '4 Guincheiros',
        status: '3 de 4 válidas',
        situacao: 'Revisar',
      },
      {
        nome: 'Apólice de responsabilidade civil',
        detalhe: 'Guinchei como cossegurada',
        status: 'Não enviada',
        situacao: 'Pendente',
      },
      {
        nome: 'Conta no PSP com split',
        detalhe: 'Recebedor cadastrado',
        status: 'Ativa',
        situacao: 'Aprovado',
      },
    ],
    emRevisao: {
      documento: 'CNH digitalizada',
      guincheiro: 'Wellington Dias',
      categoria: 'D',
      validade: '08/09/2026 · vencida',
      nota: 'A Frota pode ser ativada sem este Guincheiro. Ele fica bloqueado até enviar a CNH renovada.',
    },
  },
  {
    id: 'brasilia',
    nome: 'Brasília Reboques ME',
    cnpj: '52.117.904/0001-08',
    cidade: 'Taguatinga, DF',
    enviado: 'Enviado hoje',
    resumo: '1 guincho · 2 Guincheiros',
    emEnvio: true,
    itens: [
      {
        nome: 'CNPJ ativo',
        detalhe: 'Consulta Receita Federal',
        status: 'Verificado 17/10',
        situacao: 'Aprovado',
      },
      {
        nome: 'Contrato assinado',
        detalhe: 'Termos de parceria v1.2',
        status: 'Aguardando',
        situacao: 'Pendente',
      },
      {
        nome: 'Registro DETRAN como reboque',
        detalhe: '1 veículo',
        status: 'Não enviado',
        situacao: 'Pendente',
      },
      {
        nome: 'CNH dos Guincheiros',
        detalhe: '2 Guincheiros',
        status: 'Não enviadas',
        situacao: 'Pendente',
      },
      {
        nome: 'Apólice de responsabilidade civil',
        detalhe: 'Guinchei como cossegurada',
        status: 'Não enviada',
        situacao: 'Pendente',
      },
      {
        nome: 'Conta no PSP com split',
        detalhe: 'Recebedor cadastrado',
        status: 'Não criada',
        situacao: 'Pendente',
      },
    ],
  },
];

export const DISPUTA = {
  titulo: 'Disputa · avaria no para-choque traseiro',
  subtitulo: 'Corrida 2296 · aberta pelo Cliente em 16/10, 09:14 · prazo de resposta 48 h',
  fotos: {
    Traseira: {
      antes: { quando: 'Antes · 15/10 19:42', gps: '-15.8341, -48.0562 · Taguatinga Sul' },
      depois: { quando: 'Depois · 15/10 20:21', gps: '-15.8170, -48.1071 · Ceilândia' },
    },
  },
  lados: ['Traseira', 'Frente', 'Lateral esq.', 'Lateral dir.', 'Foto do Cliente'],
  relatoCliente: {
    autor: 'Ana C.',
    texto: 'O para-choque chegou com um amassado do lado direito que não tinha antes.',
  },
  relatoGuincheiro: {
    autor: 'Diego R.',
    texto: 'Amassado já existia. Anotei no checklist antes de carregar.',
  },
  linhaDoTempo: [
    ['Aceita', '19:21'],
    ['No local', '19:38'],
    ['Fotos antes · nota “amassado tras. dir.”', '19:42'],
    ['Carregado', '19:47'],
    ['Entregue · fotos depois', '20:21'],
  ] as [string, string][],
  precoFechado: 24690,
  guincheiroResumo: '4,8 · 412',
  decisoes: [
    'Improcedente · avaria registrada antes do carregamento',
    'Procedente · acionar apólice da Frota',
    'Pedir mais informações',
  ],
};

export const OPERADOR = 'Gabriel Porto · plantão';
