import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErroApi } from '@guinchei/api';
import {
  CENTRO_DF,
  dentroDoDF,
  type Endereco,
  type Ponto,
  type Rota,
  type ServicoMapas,
} from '@guinchei/geo';
import { TRECHO } from '@guinchei/mock';
import { Botao, IndicadorHome, Mapa, Tela, Trecho, formatarKm } from '@guinchei/ui';
import { useApi } from '../api';
import { useFluxo } from '../fluxo';
import { localizarAparelho, useMapas, type Mapas } from '../mapas';

// Origem e destino do Pedido (RF04). Com VITE_MAPBOX_TOKEN, mapa e busca reais; sem ele, o
// mapa esquemático do protótipo, para o protótipo continuar navegável.

const SO_NO_DF = 'O Guinchei atende só no Distrito Federal por enquanto.';

export function Local() {
  const mapas = useMapas();
  return mapas ? <LocalComMapa mapas={mapas} /> : <LocalDoPrototipo />;
}

// ---------------------------------------------------------------------------
// Com o mapa real
// ---------------------------------------------------------------------------

/** Texto do ponto quando o geocoding reverso não acha endereço (ou falha). */
function rotuloDeCoordenadas({ lat, lng }: Ponto): string {
  return `Ponto marcado no mapa (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
}

const chaveDaRota = (o: Endereco | null, d: Endereco | null) =>
  o && d ? `${o.ponto.lat},${o.ponto.lng};${d.ponto.lat},${d.ponto.lng}` : null;

type ResultadoRota = { chave: string; rota: Rota | null };

function LocalComMapa({ mapas: { servico, MapaInterativo } }: { mapas: Mapas }) {
  const ir = useNavigate();
  const api = useApi();
  const { pedidoId, trajeto, setTrajeto, avisar } = useFluxo();
  const [origem, setOrigem] = useState<Endereco | null>(trajeto?.origem ?? null);
  const [destino, setDestino] = useState<Endereco | null>(trajeto?.destino ?? null);
  const [resultadoRota, setResultadoRota] = useState<ResultadoRota | null>(() =>
    trajeto ? { chave: chaveDaRota(trajeto.origem, trajeto.destino)!, rota: trajeto.rota } : null,
  );
  const [nota, setNota] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  // Voltou do preço com o trajeto já gravado: não pede a localização de novo.
  const [pedirLocalizacao] = useState(() => trajeto === null);

  /** Marca o ponto na hora; o endereço chega depois, se o ponto ainda for o mesmo. */
  async function marcar(definir: typeof setOrigem, ponto: Ponto) {
    definir({ ponto, rotulo: rotuloDeCoordenadas(ponto) });
    const endereco = await servico.enderecoDoPonto(ponto).catch(() => null);
    if (endereco) definir((atual) => (atual?.ponto === ponto ? endereco : atual));
  }

  function mover(qual: 'origem' | 'destino', ponto: Ponto) {
    if (!dentroDoDF(ponto)) {
      // Sem mudar o estado, o mapa devolve o pino ao lugar.
      setNota(`Esse ponto fica fora do DF. ${SO_NO_DF}`);
      return;
    }
    setNota(null);
    void marcar(qual === 'origem' ? setOrigem : setDestino, ponto);
  }

  function escolher(qual: 'origem' | 'destino', endereco: Endereco) {
    setNota(null);
    (qual === 'origem' ? setOrigem : setDestino)(endereco);
  }

  useEffect(() => {
    if (!pedirLocalizacao) return;
    let vigente = true;
    localizarAparelho().then(
      (ponto) => {
        if (!vigente) return;
        if (!dentroDoDF(ponto)) {
          setNota(`Sua localização está fora do DF. ${SO_NO_DF}`);
          return;
        }
        const provisorio = { ponto, rotulo: rotuloDeCoordenadas(ponto) };
        // Se o Cliente já escolheu a origem enquanto isso, fica a escolha dele.
        setOrigem((atual) => atual ?? provisorio);
        servico.enderecoDoPonto(ponto).then(
          (endereco) => {
            if (vigente && endereco) {
              setOrigem((atual) => (atual === provisorio ? endereco : atual));
            }
          },
          () => {},
        );
      },
      () => {
        if (vigente) {
          setNota(
            'Não conseguimos sua localização. Busque o endereço onde o carro está ou toque no mapa.',
          );
        }
      },
    );
    return () => {
      vigente = false;
    };
  }, [servico, pedirLocalizacao]);

  const chave = chaveDaRota(origem, destino);
  const pontoOrigem = origem?.ponto;
  const pontoDestino = destino?.ponto;
  useEffect(() => {
    if (!chave || !pontoOrigem || !pontoDestino) return;
    let vigente = true;
    servico.rota(pontoOrigem, pontoDestino).then(
      (rota) => vigente && setResultadoRota({ chave, rota }),
      () => vigente && setResultadoRota({ chave, rota: null }),
    );
    return () => {
      vigente = false;
    };
    // A chave muda junto com os pontos; os objetos podem trocar só pelo endereço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico, chave]);

  const resultado = resultadoRota?.chave === chave ? resultadoRota : null;
  const rota = resultado?.rota ?? null;

  async function confirmar() {
    if (!pedidoId || !origem || !destino || !rota) return;
    setGravando(true);
    try {
      await api.definirTrajeto(pedidoId, { origem, destino, kmRebocado: rota.km });
      setTrajeto({ origem, destino, rota });
      ir('/preco');
    } catch (e) {
      setGravando(false);
      if (e instanceof ErroApi && e.motivo === 'fora_do_df') {
        setNota(`Origem ou destino fora do DF. ${SO_NO_DF}`);
      } else {
        avisar('Não foi possível gravar o trajeto. Tente de novo.');
      }
    }
  }

  if (!pedidoId) return <Navigate to="/pedido/1" replace />;

  return (
    <Tela mapa rotulo="Origem e destino">
      <Suspense fallback={<div className="mapa" />}>
        <MapaInterativo
          centro={origem?.ponto ?? CENTRO_DF}
          origem={origem?.ponto ?? null}
          destino={destino?.ponto ?? null}
          linha={rota?.linha ?? null}
          aoMoverOrigem={(p) => mover('origem', p)}
          aoMoverDestino={(p) => mover('destino', p)}
          // Tocar no mapa marca a origem enquanto não há uma; depois, o destino.
          aoTocarMapa={(p) => mover(origem ? 'destino' : 'origem', p)}
        />
      </Suspense>
      <div className="folha" style={{ gap: 12 }}>
        <CampoEndereco
          servico={servico}
          rotulo="Onde o carro está"
          valor={origem}
          perto={origem?.ponto}
          aoEscolher={(e) => escolher('origem', e)}
        />
        <CampoEndereco
          servico={servico}
          rotulo="Para onde levamos o carro"
          valor={destino}
          perto={origem?.ponto}
          aoEscolher={(e) => escolher('destino', e)}
        />
        {nota && (
          <p role="alert" style={estiloNota}>
            {nota}
          </p>
        )}
        <div style={estiloApoio}>
          {rota
            ? `${formatarKm(rota.km)} de reboque · ~${rota.minutos} min`
            : resultado
              ? 'Não encontramos uma rota de carro entre os dois pontos. Ajuste os pinos no mapa.'
              : 'Arraste os pinos ou toque no mapa para ajustar. Atendemos origem e destino dentro do DF.'}
        </div>
        <Botao disabled={!origem || !destino || !rota || gravando} onClick={confirmar}>
          Ver preço fechado
        </Botao>
        <IndicadorHome />
      </div>
    </Tela>
  );
}

const MINIMO_BUSCA = 3;
const ESPERA_DIGITACAO_MS = 300;

type Sugestoes = { texto: string; lista: Endereco[] | 'erro' };

/** Campo com busca de endereço (só no DF) e sugestões; mostra o endereço escolhido. */
function CampoEndereco({
  servico,
  rotulo,
  valor,
  perto,
  aoEscolher,
}: {
  servico: ServicoMapas;
  rotulo: string;
  valor: Endereco | null;
  perto: Ponto | undefined;
  aoEscolher: (e: Endereco) => void;
}) {
  // O que o Cliente digitou sobre o endereço `base`; se o endereço mudar (pino arrastado),
  // o campo volta a mostrar o endereço.
  const [edicao, setEdicao] = useState<{ texto: string; base: Endereco | null } | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestoes | null>(null);
  const texto = edicao && edicao.base === valor ? edicao.texto : null;

  useEffect(() => {
    if (texto === null || texto.trim().length < MINIMO_BUSCA) return;
    let vigente = true;
    const id = setTimeout(() => {
      servico.buscarEnderecos(texto, perto).then(
        (lista) => vigente && setSugestoes({ texto, lista }),
        () => vigente && setSugestoes({ texto, lista: 'erro' }),
      );
    }, ESPERA_DIGITACAO_MS);
    return () => {
      vigente = false;
      clearTimeout(id);
    };
  }, [servico, texto, perto]);

  const mostradas = texto !== null && sugestoes?.texto === texto ? sugestoes.lista : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={estiloRotulo}>
        {rotulo}
        <input
          value={texto ?? valor?.rotulo ?? ''}
          placeholder="Buscar endereço no DF"
          autoComplete="off"
          onChange={(e) => setEdicao({ texto: e.target.value, base: valor })}
          style={estiloCampo}
        />
      </label>
      {mostradas === 'erro' && (
        <p style={estiloNota}>Busca indisponível agora. Tente de novo ou marque no mapa.</p>
      )}
      {Array.isArray(mostradas) && mostradas.length === 0 && (
        <p style={estiloNota}>Nenhum endereço encontrado. {SO_NO_DF}</p>
      )}
      {Array.isArray(mostradas) && mostradas.length > 0 && (
        <ul aria-label={`Sugestões: ${rotulo}`} style={estiloSugestoes}>
          {mostradas.map((e) => (
            <li key={`${e.ponto.lat},${e.ponto.lng},${e.rotulo}`}>
              <button
                type="button"
                className="opcao"
                style={estiloSugestao}
                onClick={() => {
                  setEdicao(null);
                  aoEscolher(e);
                }}
              >
                {e.rotulo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const estiloRotulo: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  font: '600 13px var(--fonte-texto)',
  color: 'var(--tinta-2)',
};
const estiloCampo: CSSProperties = {
  width: '100%',
  height: 48,
  padding: '0 14px',
  borderRadius: 12,
  background: '#fff',
  border: '1px solid var(--linha)',
  font: '500 15px var(--fonte-texto)',
  color: 'var(--tinta)',
};
const estiloSugestoes: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  maxHeight: 180,
  overflowY: 'auto',
};
const estiloSugestao: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  font: '500 14px/1.35 var(--fonte-texto)',
  textAlign: 'left',
};
const estiloNota: CSSProperties = {
  margin: 0,
  font: '500 14px/1.4 var(--fonte-texto)',
  color: 'var(--alerta-texto)',
};
const estiloApoio: CSSProperties = {
  font: '400 13px/1.45 var(--fonte-texto)',
  color: 'var(--tinta-2)',
};

// ---------------------------------------------------------------------------
// Sem VITE_MAPBOX_TOKEN: o mapa esquemático e os dados do protótipo
// ---------------------------------------------------------------------------

function LocalDoPrototipo() {
  const ir = useNavigate();
  return (
    <Tela mapa rotulo="Origem e destino">
      <Mapa
        ruas={[
          { top: 300, esp: 18, giro: -12 },
          { top: 150, esp: 10, giro: 6 },
          { left: 120, esp: 12, giro: 8 },
          { left: 290, esp: 10 },
        ]}
        quadras={[
          { left: 170, top: 190, w: 90, h: 60 },
          { left: 24, top: 360, w: 70, h: 90 },
        ]}
        rota="272,140 272,262 130,292 112,470 70,540"
        marcadores={[
          { left: 260, top: 128, tamanho: 24, tipo: 'origem' },
          { left: 58, top: 528, tamanho: 24, tipo: 'destino' },
        ]}
      />
      <div className="folha" style={{ gap: 14 }}>
        <div style={{ font: '700 22px var(--fonte-titulo)' }}>Para onde levamos o carro?</div>
        <label style={estiloRotulo}>
          Para onde levamos o carro
          <input disabled placeholder="Buscar endereço no DF" style={estiloCampo} />
        </label>
        <p className="apoio" style={{ fontSize: 13 }}>
          Mapa indisponível: configure VITE_MAPBOX_TOKEN
        </p>
        <Trecho
          rotuloOrigem="Pela sua localização"
          origem={TRECHO.origem}
          rotuloDestino="Destino"
          destino={TRECHO.destino}
        />
        <div style={estiloApoio}>
          {formatarKm(TRECHO.kmReboque)} de reboque · atendemos origem e destino dentro do DF
        </div>
        <Botao onClick={() => ir('/preco')}>Ver preço fechado</Botao>
        <IndicadorHome />
      </div>
    </Tela>
  );
}
