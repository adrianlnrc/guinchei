// Passos de tela do cadastro de prestadores: o autônomo no app do Guincheiro (Frota, veículo,
// documentos e vínculo) e a operação no Painel (fila de homologação e ativação). Tudo pela
// interface; o banco só entra para conferir (suporte/banco.ts).
import type { Locator, Page } from '@playwright/test';
import { digitarCodigo, entrarNoPainel } from './fluxo';
import { expect, URL_GUINCHEIRO } from './navegadores';

export const DOCUMENTO = decodeURIComponent(new URL('documento.pdf', import.meta.url).pathname);
export const FOTO = decodeURIComponent(new URL('carro.png', import.meta.url).pathname);

// ---------------------------------------------------------------------------
// Dados do cenário
// ---------------------------------------------------------------------------

const digitoAleatorio = () => Math.floor(Math.random() * 10);
const sorteio = (quantos: number) => Array.from({ length: quantos }, digitoAleatorio);
const letrasAleatorias = (quantas: number) =>
  Array.from({ length: quantas }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26)));

/** CPF válido (dígitos verificadores corretos) e sorteado: nunca repete o de um cenário anterior. */
function cpfSorteado(): string {
  const d = sorteio(9);
  if (d.every((n) => n === d[0])) return cpfSorteado();
  const verificador = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += d[i]! * (n + 1 - i);
    return ((soma * 10) % 11) % 10;
  };
  d.push(verificador(9));
  d.push(verificador(10));
  return d.join('');
}

/** RENAVAM de 11 dígitos com o verificador certo (módulo 11, pesos 3 2 9 8 7 6 5 4 3 2). */
function renavamSorteado(): string {
  const d = sorteio(10);
  if (d.every((n) => n === d[0])) return renavamSorteado();
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = pesos.reduce((s, peso, i) => s + d[i]! * peso, 0);
  return [...d, ((soma * 10) % 11) % 10].join('');
}

/** AAAA-MM-DD, hoje mais `dias` (o servidor confere em Brasília; as margens aqui são de semanas). */
export function emDias(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export interface Autonomo {
  /** Celular de teste, como se digita no app. */
  celular: string;
  nome: string;
  cpf: string;
  cep: string;
  endereco: string;
  bairro: string;
  chavePix: string;
  apoliceValidade: string;
  cnhNumero: string;
  cnhValidade: string;
  antecedentesEmissao: string;
}

export interface Veiculo {
  /** Como se digita (Mercosul, sem hífen). */
  placa: string;
  /** A placa como as telas a escrevem. */
  placaNaTela: string;
  renavam: string;
  pbtKg: number;
  /** O PBT como as telas o escrevem ("3.200 kg"). */
  pbtNaTela: string;
}

/** Tudo o que o autônomo digita, sorteado a cada cenário: CPF, CNH, nome e Pix não se repetem. */
export function autonomoNovo(celular: string): Autonomo {
  const sufixo = letrasAleatorias(5).join('');
  return {
    celular,
    nome: `Aurora Teste ${sufixo}`,
    cpf: cpfSorteado(),
    cep: '70040010',
    endereco: 'SQN 308 Bloco A, loja 2',
    bairro: 'Asa Norte',
    chavePix: `aurora.${sufixo.toLowerCase()}@exemplo.com`,
    apoliceValidade: emDias(120),
    cnhNumero: sorteio(11).join(''),
    cnhValidade: emDias(400),
    antecedentesEmissao: emDias(-10),
  };
}

export function veiculoNovo(pbtKg: number): Veiculo {
  const [a, b, c, e] = letrasAleatorias(4);
  const placa = `${a}${b}${c}${digitoAleatorio()}${e}${digitoAleatorio()}${digitoAleatorio()}`;
  return {
    placa,
    placaNaTela: `${placa.slice(0, 3)}-${placa.slice(3)}`,
    renavam: renavamSorteado(),
    pbtKg,
    pbtNaTela: `${new Intl.NumberFormat('pt-BR').format(pbtKg)} kg`,
  };
}

// ---------------------------------------------------------------------------
// App do Guincheiro: o autônomo
// ---------------------------------------------------------------------------

/** Entra com o número novo: sem perfil nem convite, o app abre o cadastro de Frota. */
export async function entrarComoPessoaNova(page: Page, celular: string): Promise<void> {
  await page.goto(URL_GUINCHEIRO);
  await digitarCodigo(page, celular);
  await expect(page.getByRole('heading', { name: 'Cadastre a sua Frota' })).toBeVisible();
}

/** Cinco etapas do cadastro de Frota autônoma (CPF), até a tela "Minha Frota". */
export async function cadastrarFrotaAutonoma(page: Page, a: Autonomo): Promise<void> {
  await page.getByRole('button', { name: 'Cadastrar minha Frota' }).click();

  await expect(page.getByRole('heading', { name: 'Dados da sua Frota' })).toBeVisible();
  await page.getByLabel('CPF', { exact: true }).fill(a.cpf);
  await page.getByLabel('Nome completo').fill(a.nome);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Endereço da base' })).toBeVisible();
  await page.getByLabel('CEP').fill(a.cep);
  await page.getByLabel('Endereço da base (rua e número)').fill(a.endereco);
  await page.getByLabel('Bairro').fill(a.bairro);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Documentos da Frota' })).toBeVisible();
  await page.getByLabel('Alvará (PDF ou foto)').setInputFiles(DOCUMENTO);
  await page.getByLabel('Apólice de responsabilidade civil (PDF ou foto)').setInputFiles(DOCUMENTO);
  await expect(page.getByText('Documento enviado', { exact: true })).toHaveCount(2);
  await page.getByLabel('Validade da apólice').fill(a.apoliceValidade);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Chave Pix para receber' })).toBeVisible();
  await page.getByLabel('Chave Pix').fill(a.chavePix);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'Termos para prestadores' })).toBeVisible();
  await page.getByLabel('Li e aceito os termos para prestadores').check();
  await page.getByRole('button', { name: 'Enviar cadastro' }).click();

  await expect(page.getByRole('heading', { name: a.nome })).toBeVisible();
  await expect(page.getByText(/Em análise pela operação/)).toBeVisible();
}

/** De "Minha Frota" ao veículo na lista, com CRLV e uma foto. */
export async function cadastrarVeiculo(page: Page, v: Veiculo): Promise<void> {
  await page.getByRole('button', { name: 'Meus veículos' }).click();
  await expect(page.getByRole('heading', { name: 'Meus veículos' })).toBeVisible();
  await page.getByRole('button', { name: 'Cadastrar veículo' }).click();

  await expect(page.getByRole('heading', { name: 'Dados do veículo' })).toBeVisible();
  await page.getByLabel('Placa').fill(v.placa);
  await page.getByLabel('RENAVAM').fill(v.renavam);
  await page.getByLabel('PBT em kg').fill(String(v.pbtKg));
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'CRLV e fotos' })).toBeVisible();
  await page.getByLabel('CRLV (PDF ou foto)').setInputFiles(DOCUMENTO);
  await expect(page.getByText('CRLV enviado', { exact: true })).toBeVisible();
  await page.getByLabel('Adicionar foto do veículo').setInputFiles(FOTO);
  await expect(page.getByText(/^1 de \d+ foto enviada$/)).toBeVisible();
  await page.getByRole('button', { name: 'Cadastrar veículo' }).click();

  const cartao = page.getByRole('listitem', { name: `Veículo ${v.placaNaTela}`, exact: true });
  await expect(cartao).toBeVisible();
  await expect(cartao).toContainText(v.pbtNaTela);
  await expect(cartao).toContainText('Em análise');
}

/** Da Frota aos documentos de Guincheiro: CNH B, certidão de antecedentes e selfie. */
export async function enviarDocumentosDeGuincheiro(page: Page, a: Autonomo): Promise<void> {
  await page.getByRole('button', { name: 'Voltar para a Frota' }).click();
  await page.getByRole('button', { name: 'Meus documentos de Guincheiro' }).click();
  await expect(page.getByRole('heading', { name: 'Envie os seus documentos' })).toBeVisible();

  await page.getByRole('button', { name: 'Enviar CNH' }).click();
  await expect(page.getByRole('heading', { name: 'Sua CNH' })).toBeVisible();
  await page.getByLabel('Número da CNH').fill(a.cnhNumero);
  await page.getByLabel('Categoria').selectOption('B');
  await page.getByLabel('Validade da CNH').fill(a.cnhValidade);
  await page.getByLabel(/A minha CNH tem a observação EAR/).check();
  await page.getByLabel('Foto da CNH', { exact: true }).setInputFiles(DOCUMENTO);
  await page.getByRole('button', { name: 'Enviar CNH' }).click();
  await expect(page.getByText('CNH enviada. A operação vai conferir.')).toBeVisible();

  await page.getByRole('button', { name: 'Enviar Certidão de antecedentes' }).click();
  await expect(page.getByRole('heading', { name: 'Certidão de antecedentes' })).toBeVisible();
  await page.getByLabel('Data de emissão da certidão').fill(a.antecedentesEmissao);
  await page.getByLabel('Arquivo da certidão', { exact: true }).setInputFiles(DOCUMENTO);
  await page.getByRole('button', { name: 'Enviar certidão' }).click();
  await expect(page.getByText('Certidão enviada. A operação vai conferir.')).toBeVisible();

  await page.getByRole('button', { name: 'Enviar Selfie' }).click();
  await expect(page.getByRole('heading', { name: 'Sua selfie' })).toBeVisible();
  await page.getByLabel('Foto da selfie', { exact: true }).setInputFiles(FOTO);
  await page.getByRole('button', { name: 'Enviar selfie' }).click();
  await expect(page.getByText('Selfie enviada. A operação vai conferir.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Aguardando homologação' })).toBeVisible();
}

/** Abre "Quem dirige cada veículo" a partir dos documentos (via "Minha Frota"). */
export async function abrirVinculos(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ver a minha Frota' }).click();
  await page.getByRole('button', { name: 'Vincular Guincheiros a veículos' }).click();
  await expect(page.getByRole('heading', { name: 'Quem dirige cada veículo' })).toBeVisible();
}

/** Escolhe o veículo na lista do Guincheiro (a Frota é uma pessoa só: ele mesmo). */
export async function escolherVeiculoParaVincular(
  page: Page,
  a: Autonomo,
  v: Veiculo,
): Promise<Locator> {
  const cartao = page.getByRole('listitem', { name: `Guincheiro ${a.nome}`, exact: true });
  await expect(cartao).toBeVisible();
  await cartao
    .getByLabel(`Veículo de ${a.nome}`)
    .selectOption({ label: `${v.placaNaTela} · Plataforma · ${v.pbtNaTela}` });
  return cartao;
}

// ---------------------------------------------------------------------------
// Painel: a operação
// ---------------------------------------------------------------------------

/** Entra no Painel e abre a Frota na fila de homologação (o nome é único no cenário). */
export async function abrirFrotaNoPainel(painel: Page, nomeDaFrota: string): Promise<void> {
  await entrarNoPainel(painel);
  await painel.getByRole('link', { name: /Homologação/ }).click();
  const fila = painel.getByRole('complementary', { name: 'Fila de homologação' });
  await fila.getByRole('button', { name: new RegExp(nomeDaFrota) }).click();
  await expect(painel.getByRole('heading', { name: nomeDaFrota })).toBeVisible();
}

/** Aprova um item da Frota aberta (o nome é o da lista "Itens da Frota") e espera o estado. */
export async function aprovarItem(painel: Page, nomeDoItem: string | RegExp): Promise<void> {
  const item = painel.getByRole('listitem', { name: nomeDoItem });
  await item.getByRole('button', { name: /^Aprovar/ }).click();
  await expect(item.getByText('Aprovado', { exact: true })).toBeVisible();
}
