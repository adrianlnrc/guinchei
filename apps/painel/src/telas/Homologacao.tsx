import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ErroApi,
  type AlvoHomologacao,
  type EstadoHomologacao,
  type FrotaEmHomologacao,
  type ItemEmAlerta,
  type ItemHomologacao,
  type TipoItemHomologacao,
} from '@guinchei/api';
import { resumoDaAprovacaoDaCnh } from '@guinchei/cnh';
import { useApi } from '../api';
import { useOperacao } from '../operacao';

const TIPO: Record<TipoItemHomologacao, string> = {
  alvara: 'Alvará',
  apolice_rc: 'Apólice de RC por avaria',
  crlv: 'CRLV do veículo',
  foto_veiculo: 'Foto do veículo',
  cnh: 'CNH do Guincheiro',
  antecedentes: 'Certidão de antecedentes',
  selfie: 'Selfie do Guincheiro',
};

const ALVO: Record<AlvoHomologacao, string> = {
  frota: 'Frota',
  guincheiro: 'Guincheiro',
  veiculo: 'Veículo',
};

const ESTADO: Record<EstadoHomologacao, { texto: string; classe: string }> = {
  pendente: { texto: 'Pendente', classe: '' },
  aprovado: { texto: 'Aprovado', classe: ' etiqueta--ok' },
  recusado: { texto: 'Recusado', classe: '' },
  vencido: { texto: 'Vencido', classe: ' etiqueta--alerta' },
};

const TIPO_DO_VEICULO = {
  plataforma: 'Plataforma',
  asa_delta: 'Asa-delta',
  lanca: 'Lança',
} as const;

/** "PBX1D23" → "PBX-1D23" */
const placaComHifen = (placa: string) => `${placa.slice(0, 3)}-${placa.slice(3)}`;

/**
 * O nome do item na tela. Os de veículo levam a placa (e o número, nas fotos), para a operação
 * distinguir um veículo do outro; os demais, o nome do documento.
 */
function nomeDoItem(item: ItemHomologacao, frota: FrotaEmHomologacao): string {
  const veiculo = item.alvo === 'veiculo' && frota.veiculos.find((v) => v.id === item.alvoId);
  if (!veiculo) return TIPO[item.tipo];
  const placa = placaComHifen(veiculo.placa);
  if (item.tipo === 'foto_veiculo') {
    const fotos = frota.itens.filter((i) => i.tipo === 'foto_veiculo' && i.alvoId === item.alvoId);
    return `Foto ${fotos.findIndex((i) => i.id === item.id) + 1} do veículo ${placa}`;
  }
  return `${TIPO[item.tipo]} ${placa}`;
}

/** Linha de apoio do item: o alvo e, no veículo, o tipo e o PBT que a regra CNH × PBT usa. */
function detalheDoItem(item: ItemHomologacao, frota: FrotaEmHomologacao): string {
  const veiculo = item.alvo === 'veiculo' && frota.veiculos.find((v) => v.id === item.alvoId);
  const alvo = veiculo
    ? `Veículo ${placaComHifen(veiculo.placa)} (${TIPO_DO_VEICULO[veiculo.tipo]}, PBT ${new Intl.NumberFormat('pt-BR').format(veiculo.pbtKg)} kg)`
    : item.guincheiro
      ? `Guincheiro ${item.guincheiro}`
      : ALVO[item.alvo];
  return `${alvo} · ${item.validade ? `Validade ${dia(item.validade)}` : 'Sem validade'}`;
}

const mensagemDe = (erro: unknown, padrao: string) =>
  erro instanceof ErroApi ? erro.message : padrao;

/** AAAA-MM-DD → DD/MM/AAAA, sem passar por `Date` (a validade é um dia, não um instante). */
const dia = (validade: string) => validade.split('-').reverse().join('/');

const enviadoEm = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

const itensPendentes = (n: number) => `${n} ${n === 1 ? 'item pendente' : 'itens pendentes'}`;

// Empresa: CNPJ. Autônomo: CPF ou o CNPJ do MEI (ADR-0012).
const documentoDa = (f: { documento: string }) =>
  `${f.documento.length === 11 ? 'CPF' : 'CNPJ'} ${f.documento}`;

/** Rótulo curto do documento na lista de vencimentos. */
const TIPO_CURTO: Partial<Record<TipoItemHomologacao, string>> = {
  apolice_rc: 'Apólice de RC',
  cnh: 'CNH',
  antecedentes: 'Certidão de antecedentes',
};

const plural = (n: number, singular: string, mais: string) => `${n} ${n === 1 ? singular : mais}`;

/** "Vence em 12 dias", "Vence hoje", "Venceu há 3 dias": o prazo em palavras. */
export function prazoDoVencimento(diasRestantes: number): string {
  if (diasRestantes < 0) return `Venceu há ${plural(-diasRestantes, 'dia', 'dias')}`;
  if (diasRestantes === 0) return 'Vence hoje';
  if (diasRestantes === 1) return 'Vence amanhã';
  return `Vence em ${diasRestantes} dias`;
}

const nomeDoAlerta = (item: ItemEmAlerta) => {
  const nome = TIPO_CURTO[item.tipo] ?? TIPO[item.tipo];
  return item.guincheiro ? `${nome} · ${item.guincheiro}` : nome;
};

type Aba = 'fila' | 'vencendo';

export function Homologacao() {
  const { fila, erroFila, recarregarFila, frotasVencendo, homologacoesPendentes } = useOperacao();
  const [aba, setAba] = useState<Aba>('fila');
  const [escolhida, setEscolhida] = useState<string | null>(null);
  // Decidido o último item de uma Frota, ela sai da fila e a seguinte assume o detalhe.
  const ids = aba === 'fila' ? (fila?.map((f) => f.id) ?? []) : frotasVencendo.map((f) => f.id);
  const selecionada = ids.includes(escolhida ?? '') ? escolhida : (ids[0] ?? null);

  return (
    <>
      <aside
        aria-label={aba === 'fila' ? 'Fila de homologação' : 'Vencendo'}
        style={{
          width: 340,
          flex: 'none',
          borderRight: '1px solid var(--linha-suave)',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div className="homologacao__abas" role="tablist" aria-label="Listas de homologação">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'fila'}
            className="homologacao__aba"
            onClick={() => setAba('fila')}
          >
            Pendentes
            {homologacoesPendentes > 0 && (
              <span className="homologacao__aba-contagem">{homologacoesPendentes}</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'vencendo'}
            className="homologacao__aba"
            onClick={() => setAba('vencendo')}
          >
            Vencendo
            {frotasVencendo.length > 0 && (
              <span className="homologacao__aba-contagem homologacao__aba-contagem--alerta">
                {frotasVencendo.length}
              </span>
            )}
          </button>
        </div>
        {aba === 'fila'
          ? fila?.map((f) => (
              <button
                key={f.id}
                type="button"
                className="homologacao__fila-item"
                aria-current={f.id === selecionada}
                onClick={() => setEscolhida(f.id)}
              >
                <span style={{ font: '600 16px var(--fonte-titulo)' }}>{f.nome}</span>
                <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
                  {f.tipo === 'empresa' ? 'Empresa' : 'Autônomo'} ·{' '}
                  {f.pendentes === 0 ? 'completa desde' : 'enviado'} {enviadoEm(f.enviadoEm)}
                </span>
                {f.pendentes > 0 && (
                  <span style={{ font: '500 13px var(--fonte-texto)' }}>
                    {itensPendentes(f.pendentes)}
                  </span>
                )}
                {f.pronta && (
                  <span className="etiqueta etiqueta--ok" style={{ alignSelf: 'flex-start' }}>
                    Pronta para ativar
                  </span>
                )}
              </button>
            ))
          : frotasVencendo.map((f) => (
              <button
                key={f.id}
                type="button"
                className="homologacao__fila-item"
                aria-current={f.id === selecionada}
                aria-label={`${f.nome}: ${plural(f.itens.length, 'documento vencendo', 'documentos vencendo')}`}
                onClick={() => setEscolhida(f.id)}
              >
                <span style={{ font: '600 16px var(--fonte-titulo)' }}>{f.nome}</span>
                {f.itens.map((item) => (
                  <span key={item.itemId} className="homologacao__vencendo-item">
                    <span>{nomeDoAlerta(item)}</span>
                    <span
                      className={`etiqueta${item.diasRestantes < 0 ? ' etiqueta--alerta' : ' etiqueta--atencao'}`}
                    >
                      {prazoDoVencimento(item.diasRestantes)}
                    </span>
                  </span>
                ))}
              </button>
            ))}
      </aside>
      <main className="conteudo">
        {selecionada ? (
          <DetalheDaFrota key={selecionada} frotaId={selecionada} />
        ) : aba === 'fila' ? (
          <EstadoDaLista
            carregada={fila !== null}
            erro={erroFila}
            vazio="Nenhuma Frota aguardando homologação."
            carregando="Carregando a fila…"
            falha="Não foi possível carregar a fila."
            tentarDeNovo={recarregarFila}
          />
        ) : (
          <SemVencimentos />
        )}
      </main>
    </>
  );
}

/** Lista vazia, carregando ou com falha: nunca confunde falha de leitura com "nada a fazer". */
function EstadoDaLista({
  carregada,
  erro,
  vazio,
  carregando,
  falha,
  tentarDeNovo,
}: {
  carregada: boolean;
  erro: boolean;
  vazio: string;
  carregando: string;
  falha: string;
  tentarDeNovo: () => Promise<void>;
}) {
  return (
    <div style={{ padding: '32px' }}>
      {carregada ? (
        <p className="apoio" style={{ fontSize: 15 }}>
          {vazio}
        </p>
      ) : erro ? (
        <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
          <p className="apoio" style={{ fontSize: 15 }}>
            {falha}
          </p>
          <button type="button" className="acao acao--contorno" onClick={() => void tentarDeNovo()}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <p className="apoio" style={{ fontSize: 15 }}>
          {carregando}
        </p>
      )}
    </div>
  );
}

function SemVencimentos() {
  const { vencimentos, erroVencimentos, recarregarVencimentos } = useOperacao();
  const prazo = vencimentos?.prazoDias;
  return (
    <EstadoDaLista
      carregada={vencimentos !== null}
      erro={erroVencimentos}
      vazio={`Nenhuma apólice, certidão ou CNH vence${prazo ? ` nos próximos ${prazo} dias` : ' em breve'}, e nenhuma está vencida.`}
      carregando="Carregando os vencimentos…"
      falha="Não foi possível carregar os vencimentos."
      tentarDeNovo={recarregarVencimentos}
    />
  );
}

function DetalheDaFrota({ frotaId }: { frotaId: string }) {
  const api = useApi();
  const { recarregarFila, recarregarVencimentos, vencimentos, avisar } = useOperacao();
  const [frota, setFrota] = useState<FrotaEmHomologacao | null | undefined>(undefined);
  const [erro, setErro] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const montado = useRef(true);

  const recarregar = useCallback(async () => {
    try {
      const lida = await api.buscarFrotaHomologacao(frotaId);
      if (!montado.current) return;
      setFrota(lida);
      setErro(false);
    } catch {
      if (montado.current) setErro(true);
    }
  }, [api, frotaId]);

  useEffect(() => {
    montado.current = true;
    api.buscarFrotaHomologacao(frotaId).then(
      (lida) => {
        if (!montado.current) return;
        setFrota(lida);
        setErro(false);
      },
      () => {
        if (montado.current) setErro(true);
      },
    );
    return () => {
      montado.current = false;
    };
  }, [api, frotaId]);

  /** Roda a decisão; em qualquer caso relê o detalhe e a fila (o item pode ter mudado). */
  async function decidir(decisao: () => Promise<void>, sucesso: string) {
    setOcupado(true);
    try {
      await decisao();
      avisar(sucesso);
    } catch (e) {
      avisar(mensagemDe(e, 'Não foi possível salvar a decisão'));
    }
    await recarregar();
    await recarregarFila();
    await recarregarVencimentos();
    if (montado.current) setOcupado(false);
  }

  /** "Ativar": o banco só aceita se a regra vale agora; senão, a mensagem diz quantos itens faltam. */
  async function ativar() {
    setOcupado(true);
    try {
      await api.ativarFrota(frotaId);
      avisar(`${frota?.nome ?? 'Frota'} ativada.`);
    } catch (e) {
      avisar(mensagemDe(e, 'Não foi possível ativar a Frota'));
    }
    await recarregar();
    await recarregarFila();
    if (montado.current) setOcupado(false);
  }

  // O documento abre numa aba aberta já no clique (senão o navegador bloqueia o pop-up) e
  // vai para a URL assinada quando ela chega.
  async function verDocumento(item: ItemHomologacao) {
    const janela = window.open('about:blank', '_blank');
    if (!janela) {
      avisar('O navegador bloqueou a aba. Libere pop-ups para abrir o documento.');
      return;
    }
    try {
      const url = await api.urlDoDocumento(item.id);
      janela.opener = null;
      janela.location.href = url;
    } catch (e) {
      janela.close();
      avisar(mensagemDe(e, 'Documento indisponível'));
    }
  }

  if (frota === undefined) {
    return (
      <div style={{ padding: 32 }}>
        {erro ? (
          <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
            <p className="apoio" style={{ fontSize: 15 }}>
              Não foi possível carregar a Frota.
            </p>
            <button type="button" className="acao acao--contorno" onClick={() => void recarregar()}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <p className="apoio" style={{ fontSize: 15 }}>
            Carregando a Frota…
          </p>
        )}
      </div>
    );
  }
  if (frota === null) {
    return (
      <p className="apoio" style={{ padding: 32, fontSize: 15 }}>
        Frota não encontrada.
      </p>
    );
  }

  const pendentes = frota.itens.filter((i) => i.estado === 'pendente').length;
  const aprovados = frota.itens.filter((i) => i.estado === 'aprovado').length;

  return (
    <>
      <header className="topo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 className="topo__titulo" style={{ margin: 0 }}>
            {frota.nome}
          </h1>
          <span className="mono" style={{ fontSize: 13 }}>
            {documentoDa(frota)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`etiqueta${frota.ativa ? ' etiqueta--ok' : ''}`}>
            {frota.ativa ? 'Frota ativa' : 'Frota inativa'}
          </span>
          <span className="etiqueta">
            {aprovados} de {frota.itens.length} aprovados
          </span>
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0, padding: '20px 32px', overflow: 'auto' }}>
        <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AtivacaoDaFrota frota={frota} ocupado={ocupado} aoAtivar={() => void ativar()} />
          <span className="rotulo rotulo--12">
            Itens · {pendentes === 0 ? 'nenhum pendente' : itensPendentes(pendentes)}
          </span>
          <ul
            aria-label="Itens da Frota"
            className="cartao"
            style={{ borderRadius: 14, listStyle: 'none', margin: 0, padding: 0 }}
          >
            {frota.itens.map((item) => {
              const nome = nomeDoItem(item, frota);
              return (
                <ItemLinha
                  key={item.id}
                  item={item}
                  frota={frota}
                  nome={nome}
                  detalhe={detalheDoItem(item, frota)}
                  vencimento={vencimentos?.itens.find((a) => a.itemId === item.id) ?? null}
                  ocupado={ocupado}
                  aoVerDocumento={() => void verDocumento(item)}
                  aoAprovar={() => decidir(() => api.aprovarItem(item.id), `${nome} aprovado.`)}
                  aoRecusar={(motivo) =>
                    decidir(() => api.recusarItem(item.id, motivo), `${nome} recusado.`)
                  }
                />
              );
            })}
          </ul>
          <p className="apoio" style={{ fontSize: 13 }}>
            A Frota só entra no Match depois de ativada, e volta a inativa sozinha se um item
            obrigatório vencer ou for recusado.
          </p>
        </div>
      </div>
    </>
  );
}

const itensQueFaltam = (n: number) => (n === 1 ? 'Falta 1 item' : `Faltam ${n} itens`);

/**
 * A regra de ativação da Frota (issue #50): alvará e apólice aprovados e vigentes, um veículo
 * aprovado e um Guincheiro aprovado vinculado a ele com a CNH cobrindo o PBT. A lista é a que o
 * banco confere ao ativar, não uma estimativa da tela; "Ativar" só vale com a lista vazia.
 */
function AtivacaoDaFrota({
  frota,
  ocupado,
  aoAtivar,
}: {
  frota: FrotaEmHomologacao;
  ocupado: boolean;
  aoAtivar: () => void;
}) {
  const falta = frota.pendenciasDeAtivacao;
  const completa = falta.length === 0;
  const dica = useId();
  return (
    <section
      aria-label="Ativação da Frota"
      className="cartao"
      style={{ borderRadius: 14, padding: 18, display: 'grid', gap: 12 }}
    >
      {frota.ativa ? (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong style={{ font: '600 16px var(--fonte-titulo)' }}>Frota ativa</strong>
            <span className="etiqueta etiqueta--ok">No Match</span>
          </div>
          <p className="apoio" style={{ margin: 0, fontSize: 13 }}>
            Os Guincheiros disponíveis, homologados e vinculados a um veículo aprovado já recebem
            chamados.
          </p>
        </>
      ) : (
        <>
          <strong style={{ font: '600 16px var(--fonte-titulo)' }}>
            {completa
              ? 'Tudo aprovado: pode ativar'
              : `${itensQueFaltam(falta.length)} para ativar`}
          </strong>
          {!completa && (
            <ul
              aria-label="O que falta para ativar a Frota"
              style={{
                margin: 0,
                paddingLeft: 20,
                display: 'grid',
                gap: 4,
                font: '400 14px/1.5 var(--fonte-texto)',
              }}
            >
              {falta.map((p) => (
                <li key={p.descricao}>{p.descricao}</li>
              ))}
            </ul>
          )}
          <div className="homologacao__acoes">
            <button
              type="button"
              className="acao acao--tinta"
              disabled={!completa || ocupado}
              aria-describedby={completa ? undefined : dica}
              onClick={aoAtivar}
            >
              Ativar Frota
            </button>
            {!completa && (
              <span id={dica} className="apoio" style={{ fontSize: 13 }}>
                Libera quando a lista acima estiver completa.
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * O que a operação confere ao lado da foto: na CNH, número, categoria, validade e EAR; na
 * certidão, a emissão e a validade de 12 meses. Vem das colunas, não da imagem.
 */
function DadosDoDocumento({ item }: { item: ItemHomologacao }) {
  if (item.tipo === 'cnh' && item.alvo === 'guincheiro') {
    const cnh = item.cnh;
    return (
      <dl aria-label="Dados da CNH" className="homologacao__dados">
        {cnh ? (
          <>
            <dt>Número</dt>
            <dd className="mono">{cnh.numero}</dd>
            <dt>Categoria</dt>
            <dd>{cnh.categoria}</dd>
            <dt>Validade</dt>
            <dd>{dia(cnh.validade)}</dd>
            <dt>Observação EAR</dt>
            <dd>{cnh.ear ? 'Sim' : 'Não'}</dd>
          </>
        ) : (
          <dd>Dados da CNH não informados: confira na foto.</dd>
        )}
      </dl>
    );
  }
  if (item.tipo === 'antecedentes' && item.alvo === 'guincheiro') {
    return (
      <dl aria-label="Dados da certidão" className="homologacao__dados">
        <dt>Emissão</dt>
        <dd>{item.antecedentesEmissao ? dia(item.antecedentesEmissao) : 'Não informada'}</dd>
        <dt>Vale 12 meses, até</dt>
        <dd>{item.validade ? dia(item.validade) : 'Não informada'}</dd>
      </dl>
    );
  }
  return null;
}

/**
 * Ao aprovar uma CNH, a operação vê quais veículos da Frota a categoria cobre (CNH × PBT, CTB
 * art. 143) e quais vínculos do Guincheiro a aprovação derrubaria. Só aparece na CNH pendente.
 */
function AvisoCnhPbt({ item, frota }: { item: ItemHomologacao; frota: FrotaEmHomologacao }) {
  if (item.tipo !== 'cnh' || item.alvo !== 'guincheiro' || item.estado !== 'pendente') return null;
  const cnh = item.cnh;
  if (!cnh) return null;
  if (frota.veiculos.length === 0) {
    return (
      <div className="aviso-cnh" role="note" aria-label="Aviso CNH × PBT">
        <span className="aviso-cnh__titulo">CNH × PBT · categoria {cnh.categoria}</span>
        <span>A Frota ainda não tem veículos cadastrados: não há o que conferir por enquanto.</span>
      </div>
    );
  }
  const vinculados = frota.vinculos
    .filter((v) => v.guincheiroId === item.alvoId)
    .map((v) => v.veiculoId);
  const resumo = resumoDaAprovacaoDaCnh(cnh.categoria, frota.veiculos, vinculados);
  const placaDe = (id: string) => {
    const v = frota.veiculos.find((x) => x.id === id);
    return v ? placaComHifen(v.placa) : 'veículo';
  };
  const derruba = resumo.derrubaria.length > 0;
  return (
    <div
      className={`aviso-cnh${derruba ? ' aviso-cnh--alerta' : ''}`}
      role="note"
      aria-label="Aviso CNH × PBT"
    >
      <span className="aviso-cnh__titulo">CNH × PBT · categoria {cnh.categoria}</span>
      <ul className="aviso-cnh__lista" aria-label="Veículos da Frota e a categoria da CNH">
        {frota.veiculos.map((v) => {
          const cobre = resumo.cobertos.includes(v.id);
          return (
            <li key={v.id} className={cobre ? 'aviso-cnh__cobre' : 'aviso-cnh__nao-cobre'}>
              {placaComHifen(v.placa)} (PBT {new Intl.NumberFormat('pt-BR').format(v.pbtKg)} kg):{' '}
              {cobre ? 'a categoria cobre' : 'a categoria não cobre'}
              {vinculados.includes(v.id) ? ' · vinculado a este Guincheiro' : ''}
            </li>
          );
        })}
      </ul>
      {derruba ? (
        <strong role="alert">
          Aprovar derruba {resumo.derrubaria.length === 1 ? 'o vínculo' : 'os vínculos'} deste
          Guincheiro com {resumo.derrubaria.map(placaDe).join(', ')}: a categoria {cnh.categoria}{' '}
          não cobre o PBT. O representante é avisado e precisa vinculá-lo a outro veículo.
        </strong>
      ) : (
        <span>
          {vinculados.length > 0
            ? 'Aprovar mantém os vínculos existentes deste Guincheiro.'
            : 'Este Guincheiro ainda não está vinculado a nenhum veículo.'}
        </span>
      )}
    </div>
  );
}

function ItemLinha({
  item,
  frota,
  nome,
  detalhe,
  vencimento,
  ocupado,
  aoVerDocumento,
  aoAprovar,
  aoRecusar,
}: {
  item: ItemHomologacao;
  frota: FrotaEmHomologacao;
  nome: string;
  detalhe: string;
  /** O alerta deste item, quando ele está vencendo ou vencido. */
  vencimento: ItemEmAlerta | null;
  ocupado: boolean;
  aoVerDocumento: () => void;
  aoAprovar: () => Promise<void>;
  aoRecusar: (motivo: string) => Promise<void>;
}) {
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const campo = useId();
  // Vários Guincheiros na Frota têm CNH, certidão e selfie cada um: o nome desfaz a ambiguidade.
  const rotulo = item.guincheiro ? `${nome} · ${item.guincheiro}` : nome;
  const estado = ESTADO[item.estado];

  return (
    <li
      aria-label={rotulo}
      className={`homologacao__item${item.estado === 'vencido' ? ' homologacao__item--vencido' : ''}`}
    >
      <div className="homologacao__item-linha">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ font: '600 15px var(--fonte-texto)' }}>{nome}</span>
          <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
            {detalhe}
          </span>
        </div>
        <span className={`etiqueta${estado.classe}`}>{estado.texto}</span>
      </div>
      <DadosDoDocumento item={item} />
      <AvisoCnhPbt item={item} frota={frota} />
      {item.tipo === 'crlv' && item.estado === 'pendente' && (
        <p style={{ margin: 0, font: '400 13px/1.5 var(--fonte-texto)' }}>
          Conferir o registro do veículo como reboque no DETRAN.
        </p>
      )}
      {item.estado === 'recusado' && item.motivo && (
        <p style={{ margin: 0, font: '400 13px/1.5 var(--fonte-texto)' }}>Motivo: {item.motivo}</p>
      )}
      {item.estado === 'vencido' && (
        <p style={{ margin: 0, font: '400 13px/1.5 var(--fonte-texto)' }}>
          Aguardando novo envio do documento.
        </p>
      )}
      {item.estado === 'aprovado' && vencimento && (
        <p
          style={{
            margin: 0,
            font: '500 13px/1.5 var(--fonte-texto)',
            color: 'var(--alerta-texto)',
          }}
        >
          {prazoDoVencimento(vencimento.diasRestantes)} ({dia(vencimento.validade)}). Peça o
          documento novo antes que a validade passe.
        </p>
      )}
      {recusando ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <label htmlFor={campo} style={{ font: '500 13px var(--fonte-texto)' }}>
            Motivo da recusa
          </label>
          <textarea
            id={campo}
            className="homologacao__motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <div className="homologacao__acoes">
            <button
              type="button"
              className="acao acao--tinta"
              disabled={ocupado || motivo.trim() === ''}
              onClick={() => void aoRecusar(motivo.trim()).then(() => setRecusando(false))}
            >
              Confirmar recusa
            </button>
            <button
              type="button"
              className="acao acao--contorno"
              onClick={() => {
                setRecusando(false);
                setMotivo('');
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="homologacao__acoes">
          <button
            type="button"
            className="acao acao--contorno"
            aria-label={`Ver documento: ${rotulo}`}
            onClick={aoVerDocumento}
          >
            Ver documento
          </button>
          {item.estado === 'pendente' && (
            <>
              <button
                type="button"
                className="acao acao--tinta"
                aria-label={`Aprovar ${rotulo}`}
                disabled={ocupado}
                onClick={() => void aoAprovar()}
              >
                Aprovar
              </button>
              <button
                type="button"
                className="acao acao--contorno"
                aria-label={`Recusar ${rotulo}`}
                disabled={ocupado}
                onClick={() => setRecusando(true)}
              >
                Recusar
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
