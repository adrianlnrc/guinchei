import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ErroApi,
  type AlvoHomologacao,
  type EstadoHomologacao,
  type FrotaEmHomologacao,
  type ItemHomologacao,
  type TipoItemHomologacao,
} from '@guinchei/api';
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

export function Homologacao() {
  const { fila, erroFila, recarregarFila } = useOperacao();
  const [escolhida, setEscolhida] = useState<string | null>(null);
  // Decidido o último item de uma Frota, ela sai da fila e a seguinte assume o detalhe.
  const selecionada = fila?.find((f) => f.id === escolhida)?.id ?? fila?.[0]?.id ?? null;

  return (
    <>
      <aside
        aria-label="Fila de homologação"
        style={{
          width: 340,
          flex: 'none',
          borderRight: '1px solid var(--linha-suave)',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="topo__titulo"
          style={{
            height: 72,
            flex: 'none',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--linha-suave)',
          }}
        >
          Fila de homologação
        </div>
        {fila?.map((f) => (
          <button
            key={f.id}
            type="button"
            className="homologacao__fila-item"
            aria-current={f.id === selecionada}
            onClick={() => setEscolhida(f.id)}
          >
            <span style={{ font: '600 16px var(--fonte-titulo)' }}>{f.nome}</span>
            <span style={{ font: '400 13px var(--fonte-texto)', color: 'var(--tinta-2)' }}>
              {f.tipo === 'empresa' ? 'Empresa' : 'Autônomo'} · enviado {enviadoEm(f.enviadoEm)}
            </span>
            <span style={{ font: '500 13px var(--fonte-texto)' }}>
              {itensPendentes(f.pendentes)}
            </span>
          </button>
        ))}
      </aside>
      <main className="conteudo">
        {selecionada ? (
          <DetalheDaFrota key={selecionada} frotaId={selecionada} />
        ) : (
          <div style={{ padding: '32px' }}>
            {fila ? (
              <p className="apoio" style={{ fontSize: 15 }}>
                Nenhuma Frota aguardando homologação.
              </p>
            ) : erroFila ? (
              <div style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
                <p className="apoio" style={{ fontSize: 15 }}>
                  Não foi possível carregar a fila.
                </p>
                <button
                  type="button"
                  className="acao acao--contorno"
                  onClick={() => void recarregarFila()}
                >
                  Tentar de novo
                </button>
              </div>
            ) : (
              <p className="apoio" style={{ fontSize: 15 }}>
                Carregando a fila…
              </p>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function DetalheDaFrota({ frotaId }: { frotaId: string }) {
  const api = useApi();
  const { recarregarFila, avisar } = useOperacao();
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
        <span className="etiqueta">
          {aprovados} de {frota.itens.length} aprovados
        </span>
      </header>
      <div style={{ flex: 1, minHeight: 0, padding: '20px 32px', overflow: 'auto' }}>
        <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  nome={nome}
                  detalhe={detalheDoItem(item, frota)}
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
            Esta tela só decide itens. Ativar a Frota é outro passo.
          </p>
        </div>
      </div>
    </>
  );
}

function ItemLinha({
  item,
  nome,
  detalhe,
  ocupado,
  aoVerDocumento,
  aoAprovar,
  aoRecusar,
}: {
  item: ItemHomologacao;
  nome: string;
  detalhe: string;
  ocupado: boolean;
  aoVerDocumento: () => void;
  aoAprovar: () => Promise<void>;
  aoRecusar: (motivo: string) => Promise<void>;
}) {
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const campo = useId();
  const estado = ESTADO[item.estado];

  return (
    <li
      aria-label={nome}
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
            aria-label={`Ver documento: ${nome}`}
            onClick={aoVerDocumento}
          >
            Ver documento
          </button>
          {item.estado === 'pendente' && (
            <>
              <button
                type="button"
                className="acao acao--tinta"
                aria-label={`Aprovar ${nome}`}
                disabled={ocupado}
                onClick={() => void aoAprovar()}
              >
                Aprovar
              </button>
              <button
                type="button"
                className="acao acao--contorno"
                aria-label={`Recusar ${nome}`}
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
