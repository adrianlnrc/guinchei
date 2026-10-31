// Aceite do Incremento 1 (issue #51, parte de #24): cadastro de prestador, homologação item a
// item no Painel, Frota ativa e Match. O autônomo no app do Guincheiro, a operação no Painel e
// o Cliente no app do Cliente, em navegadores à parte, contra os apps em build de produção, o
// Supabase local e as Edge Functions. Simulados: o Mapbox (suporte/mapbox.ts) e o PSP (mock).
import {
  frotaDoRepresentante,
  GUINCHEIROS,
  itensDaFrota,
  guincheiroDisponivel,
  ofertasDoPedido,
  pedidoAtual,
  prepararBanco,
  definirPlantao,
  TELEFONES_DO_CADASTRO,
  tirarTodosDoPlantao,
  usuarioDoTelefone,
  vinculoDoGuincheiro,
} from './suporte/banco';
import {
  abrirFrotaNoPainel,
  abrirVinculos,
  aprovarItem,
  autonomoNovo,
  cadastrarFrotaAutonoma,
  cadastrarVeiculo,
  enviarDocumentosDeGuincheiro,
  entrarComoPessoaNova,
  escolherVeiculoParaVincular,
  veiculoNovo,
} from './suporte/cadastro';
import { abrirPedidoAtePreco, entrarComoCliente, pagarComPix } from './suporte/fluxo';
import { expect, test, URL_GUINCHEIRO } from './suporte/navegadores';

test.beforeEach(prepararBanco);
// Os cadastros do e2e não se apagam (a trilha de auditoria os guarda): o preparo liberta os
// telefones e tira os Guincheiros do plantão. Quem vem depois encontra o banco como o seed deixou.
test.afterEach(prepararBanco);

const CELULAR_AUTONOMO = '(61) 90000-0051';
const CELULAR_AUTONOMO_SEM_HOMOLOGACAO = '(61) 90000-0052';

/** Os sete itens que a Frota autônoma entrega à fila: Frota, veículo e Guincheiro. */
const ITENS_DA_FILA = [
  'Alvará',
  'Apólice de RC por avaria',
  'CRLV do veículo',
  'Foto 1 do veículo',
  'CNH do Guincheiro',
  'Certidão de antecedentes',
  'Selfie do Guincheiro',
];

test('autônomo se cadastra, a operação homologa item a item, ativa a Frota e a oferta do Match chega a ele', async ({
  guincheiro,
  painel,
  cliente,
}) => {
  test.setTimeout(240_000);
  const autonomo = autonomoNovo(CELULAR_AUTONOMO);
  // PBT dentro do que a CNH B cobre (até 3.500 kg).
  const veiculo = veiculoNovo(3200);
  let guincheiroId = '';
  let frotaId = '';

  await test.step('O autônomo entra com o número novo e cadastra a Frota: dados, endereço, documentos, Pix e termos', async () => {
    await entrarComoPessoaNova(guincheiro, autonomo.celular);
    await cadastrarFrotaAutonoma(guincheiro, autonomo);

    guincheiroId = (await usuarioDoTelefone(TELEFONES_DO_CADASTRO.autonomo))!;
    expect(guincheiroId).toBeTruthy();
    const frota = (await frotaDoRepresentante(guincheiroId))!;
    frotaId = frota.id;
    // A Frota nasce inativa; só a operação a ativa.
    expect(frota).toMatchObject({ nome: autonomo.nome, ativa: false });
    expect(await itensDaFrota(frotaId)).toEqual(
      expect.arrayContaining([
        { alvo: 'frota', tipo: 'alvara', estado: 'pendente' },
        { alvo: 'frota', tipo: 'apolice_rc', estado: 'pendente' },
      ]),
    );
  });

  await test.step('Cadastra um veículo de PBT até 3.500 kg, com CRLV e foto', async () => {
    await cadastrarVeiculo(guincheiro, veiculo);
    expect(await itensDaFrota(frotaId)).toEqual(
      expect.arrayContaining([
        { alvo: 'veiculo', tipo: 'crlv', estado: 'pendente' },
        { alvo: 'veiculo', tipo: 'foto_veiculo', estado: 'pendente' },
      ]),
    );
  });

  await test.step('Envia CNH B, certidão de antecedentes e selfie', async () => {
    await enviarDocumentosDeGuincheiro(guincheiro, autonomo);
    expect(await itensDaFrota(frotaId)).toEqual(
      expect.arrayContaining([
        { alvo: 'guincheiro', tipo: 'cnh', estado: 'pendente' },
        { alvo: 'guincheiro', tipo: 'antecedentes', estado: 'pendente' },
        { alvo: 'guincheiro', tipo: 'selfie', estado: 'pendente' },
      ]),
    );
  });

  await test.step('Vincula-se ao veículo: com a CNH em análise, o vínculo fica pendente', async () => {
    await abrirVinculos(guincheiro);
    const cartao = await escolherVeiculoParaVincular(guincheiro, autonomo, veiculo);
    await expect(cartao.getByRole('status')).toContainText('O vínculo ficará pendente');
    await cartao
      .getByRole('button', {
        name: `Confirmar vínculo de ${autonomo.nome} com ${veiculo.placaNaTela}`,
      })
      .click();
    await expect(cartao).toContainText('Vínculo pendente: aguardando a aprovação da CNH');
    expect(await vinculoDoGuincheiro(guincheiroId)).toMatchObject({ situacao: 'pendente' });
  });

  await test.step('Antes da homologação o plantão está bloqueado e não liga', async () => {
    await guincheiro.goto(URL_GUINCHEIRO);
    const bloqueio = guincheiro.getByRole('region', { name: 'Plantão bloqueado' });
    await expect(bloqueio).toContainText('Plantão bloqueado até a homologação');
    const plantao = guincheiro.getByRole('switch', { name: 'Disponível para chamados' });
    await expect(plantao).toHaveAttribute('aria-disabled', 'true');
    // O interruptor é `aria-disabled`: o toque leva à explicação em vez de ligar.
    await plantao.click({ force: true });
    await expect(guincheiro.getByText('Plantão bloqueado: veja abaixo o que falta.')).toBeVisible();
    await expect(plantao).toHaveAttribute('aria-checked', 'false');
    expect(await guincheiroDisponivel(guincheiroId)).toBe(false);
  });

  await test.step('A operação abre a Frota na fila do Painel e aprova cada um dos itens', async () => {
    await abrirFrotaNoPainel(painel, autonomo.nome);
    expect(await itensDaFrota(frotaId)).toHaveLength(ITENS_DA_FILA.length);
    // Sem tudo aprovado, "Ativar Frota" não vale (a regra é a do banco).
    await expect(painel.getByRole('button', { name: 'Ativar Frota' })).toBeDisabled();
    for (const item of ITENS_DA_FILA) await aprovarItem(painel, item);

    expect((await itensDaFrota(frotaId)).map((i) => i.estado)).toEqual(
      ITENS_DA_FILA.map(() => 'aprovado'),
    );
    // Aprovada a CNH B, o vínculo com o veículo de 3.200 kg passou a ativo.
    expect(await vinculoDoGuincheiro(guincheiroId)).toMatchObject({ situacao: 'ativo' });
  });

  await test.step('Tudo aprovado: a Frota fica "Pronta para ativar" e só entra no Match quando a operação clica', async () => {
    const fila = painel.getByRole('complementary', { name: 'Fila de homologação' });
    await expect(
      fila.getByRole('button', { name: autonomo.nome }).getByText('Pronta para ativar'),
    ).toBeVisible();
    // A Frota não ativa sozinha.
    expect((await frotaDoRepresentante(guincheiroId))?.ativa).toBe(false);

    await painel.getByRole('button', { name: 'Ativar Frota' }).click();
    await expect.poll(async () => (await frotaDoRepresentante(guincheiroId))?.ativa).toBe(true);
  });

  await test.step('O autônomo liga o plantão', async () => {
    await guincheiro.goto(URL_GUINCHEIRO);
    await expect(guincheiro.getByText('Fora do plantão')).toBeVisible();
    await expect(guincheiro.getByRole('region', { name: 'Meu veículo' })).toContainText(
      'Vínculo ativo',
    );
    const plantao = guincheiro.getByRole('switch', { name: 'Disponível para chamados' });
    await plantao.click();
    await expect(plantao).toHaveAttribute('aria-checked', 'true');
    await expect(guincheiro.getByText('Disponível', { exact: true })).toBeVisible();
    await expect.poll(() => guincheiroDisponivel(guincheiroId)).toBe(true);
    await expect(guincheiro.getByRole('region', { name: 'Plantão bloqueado' })).toHaveCount(0);
  });

  await test.step('O Cliente pede e paga; a oferta chega ao autônomo recém-homologado, o único no plantão', async () => {
    // Os três do seed saem do plantão: o autônomo (1,1 km do Eixo Monumental) é o único elegível.
    await tirarTodosDoPlantao();
    await entrarComoCliente(cliente);
    await abrirPedidoAtePreco(cliente);
    await pagarComPix(cliente);
    await expect(
      cliente.getByRole('heading', { name: /Chamando o guincho mais próximo/ }),
    ).toBeVisible();

    await expect(guincheiro.getByText('Novo chamado')).toBeVisible();
    const ofertas = await ofertasDoPedido((await pedidoAtual())!.id);
    expect(ofertas.map((o) => o.guincheiro_id)).toEqual([guincheiroId]);
  });
});

test('sem homologação o autônomo não recebe oferta, e a CNH B é bloqueada num veículo de 4.200 kg', async ({
  guincheiro,
  painel,
  cliente,
}) => {
  test.setTimeout(240_000);
  const autonomo = autonomoNovo(CELULAR_AUTONOMO_SEM_HOMOLOGACAO);
  // Acima do que a CNH B cobre.
  const veiculo = veiculoNovo(4200);
  let guincheiroId = '';

  await test.step('O autônomo cadastra a Frota, um veículo de 4.200 kg e a CNH B', async () => {
    await entrarComoPessoaNova(guincheiro, autonomo.celular);
    await cadastrarFrotaAutonoma(guincheiro, autonomo);
    await cadastrarVeiculo(guincheiro, veiculo);
    await enviarDocumentosDeGuincheiro(guincheiro, autonomo);
    guincheiroId = (await usuarioDoTelefone(TELEFONES_DO_CADASTRO.autonomoSemHomologacao))!;
    expect(guincheiroId).toBeTruthy();
  });

  await test.step('A operação aprova só a CNH e vê que a categoria B não cobre o veículo', async () => {
    await abrirFrotaNoPainel(painel, autonomo.nome);
    const cnh = painel.getByRole('listitem', { name: 'CNH do Guincheiro' });
    await expect(cnh.getByRole('note', { name: 'Aviso CNH × PBT' })).toContainText(
      'a categoria não cobre',
    );
    await aprovarItem(painel, 'CNH do Guincheiro');
    const frota = (await frotaDoRepresentante(guincheiroId))!;
    // Falta aprovar o resto, então a Frota continua inativa.
    expect(frota.ativa).toBe(false);
    await expect(painel.getByRole('button', { name: 'Ativar Frota' })).toBeDisabled();
  });

  await test.step('Com a CNH B aprovada, o vínculo com o veículo de 4.200 kg é bloqueado na tela', async () => {
    await guincheiro.goto(`${URL_GUINCHEIRO}/frota/vinculos`);
    await expect(
      guincheiro.getByRole('heading', { name: 'Quem dirige cada veículo' }),
    ).toBeVisible();
    const cartao = await escolherVeiculoParaVincular(guincheiro, autonomo, veiculo);
    await expect(cartao.getByText(/CNH B · aprovada/)).toBeVisible();
    const bloqueio = cartao.getByRole('alert', {
      name: `Vínculo não permitido para ${autonomo.nome}`,
    });
    await expect(bloqueio).toContainText(`Não é possível vincular ${autonomo.nome} a este veículo`);
    await expect(bloqueio).toContainText('O que fazer:');
    // Sem botão para confirmar, e nada gravado.
    await expect(cartao.getByRole('button', { name: /Confirmar vínculo/ })).toHaveCount(0);
    expect(await vinculoDoGuincheiro(guincheiroId)).toBeNull();
  });

  await test.step('Mesmo ligado à força, o autônomo não recebe a oferta: ela segue ao homologado', async () => {
    // Só o Marcos (seed) e o autônomo estão no plantão. O autônomo está mais perto do Cliente,
    // mas sem homologação o Match o ignora; a tela já não o deixaria ligar o plantão.
    await tirarTodosDoPlantao();
    await definirPlantao([GUINCHEIROS.marcos, guincheiroId], true);
    await entrarComoCliente(cliente);
    await abrirPedidoAtePreco(cliente);
    await pagarComPix(cliente);
    await expect(
      cliente.getByRole('heading', { name: /Chamando o guincho mais próximo/ }),
    ).toBeVisible();

    const pedidoId = (await pedidoAtual())!.id;
    await expect
      .poll(async () => (await ofertasDoPedido(pedidoId)).map((o) => o.guincheiro_id))
      .toEqual([GUINCHEIROS.marcos]);
  });
});
