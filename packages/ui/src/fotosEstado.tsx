import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Botao } from './componentes';
import { formatarHora } from './formato';

// Fotos de estado (ADR-0011): o que Cliente e Guincheiro veem e fazem na Corrida. Os
// componentes não conhecem o Supabase: recebem a API pelas duas funções abaixo (o
// `ApiGuinchei` e o `ApiGuincheiro` de @guinchei/api servem como estão).

export type EtapaDaFoto = 'antes' | 'depois';
export type PapelDoAutor = 'cliente' | 'guincheiro';

export interface FotoEstadoExibida {
  id: string;
  papelAutor: PapelDoAutor;
  tipo: 'foto' | 'video';
  etapa: EtapaDaFoto;
  /** ISO 8601, hora do servidor. */
  criadoEm: string;
  latitude: number | null;
  longitude: number | null;
  /** URL assinada; `null` se não foi gerada. */
  url: string | null;
}

export interface ApiDeFotos {
  listarFotosEstado(corridaId: string): Promise<FotoEstadoExibida[]>;
  registrarFotoEstado(
    corridaId: string,
    arquivo: File,
    opcoes: { etapa: EtapaDaFoto; latitude?: number; longitude?: number },
  ): Promise<unknown>;
}

const NOME_DO_AUTOR: Record<PapelDoAutor, string> = {
  cliente: 'Cliente',
  guincheiro: 'Guincheiro',
};

const NOME_DA_ETAPA: Record<EtapaDaFoto, string> = {
  antes: 'Antes do carregamento',
  depois: 'Carregado e entrega',
};

type Lista =
  { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'pronto'; fotos: FotoEstadoExibida[] };

/**
 * As Fotos de estado da Corrida (dos dois lados). `chave` muda quando a lista deve ser
 * relida por fora (ex.: a Corrida passou para outra etapa).
 */
export function useFotosEstado(
  api: Pick<ApiDeFotos, 'listarFotosEstado'>,
  corridaId: string | null,
  chave?: unknown,
) {
  const [lista, setLista] = useState<Lista>({ tipo: 'carregando' });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!corridaId) return;
    let vigente = true;
    api
      .listarFotosEstado(corridaId)
      .then((fotos) => vigente && setLista({ tipo: 'pronto', fotos }))
      .catch(() => vigente && setLista({ tipo: 'erro' }));
    return () => {
      vigente = false;
    };
  }, [api, corridaId, chave, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return {
    carregando: lista.tipo === 'carregando',
    erro: lista.tipo === 'erro',
    fotos: lista.tipo === 'pronto' ? lista.fotos : [],
    recarregar,
  };
}

/** Quantos itens deste autor já existem na etapa. */
export function contarFotosDoAutor(
  fotos: readonly FotoEstadoExibida[],
  papel: PapelDoAutor,
  etapa: EtapaDaFoto,
): number {
  return fotos.filter((f) => f.papelAutor === papel && f.etapa === etapa).length;
}

function lerDuracaoDoVideo(arquivo: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const video = document.createElement('video');
    const terminar = () => {
      clearTimeout(limite);
      URL.revokeObjectURL(url);
    };
    const limite = setTimeout(() => {
      terminar();
      reject(new Error('tempo esgotado'));
    }, 8000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      terminar();
      resolve(video.duration);
    };
    video.onerror = () => {
      terminar();
      reject(new Error('vídeo ilegível'));
    };
    video.src = url;
  });
}

/** Coordenadas do navegador; `null` se negadas ou indisponíveis (são opcionais). */
function lerPosicaoDoNavegador(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null),
      { timeout: 4000, maximumAge: 60_000 },
    );
  });
}

const ERROS_COM_MENSAGEM = new Set([
  'arquivo_invalido',
  'arquivo_grande',
  'limite_de_fotos',
  'etapa_mudou',
]);

function mensagemDoErro(e: unknown): string {
  const motivo = (e as { motivo?: string } | null)?.motivo;
  if (motivo && ERROS_COM_MENSAGEM.has(motivo) && e instanceof Error) return e.message;
  return 'Não foi possível enviar. Verifique a conexão e tente de novo.';
}

/**
 * Botão da câmera do celular e contagem do autor na etapa. Recusa vídeo com mais de
 * `duracaoMaximaSegundos` antes de enviar e trava no `limite` de itens do autor na etapa.
 * `lerDuracao` e `lerPosicao` existem para os testes trocarem o navegador por um dublê.
 */
export function RegistrarFotoEstado({
  api,
  corridaId,
  etapa,
  papel,
  fotos,
  limite,
  duracaoMaximaSegundos,
  aoRegistrar,
  escura,
  rotuloDoBotao = 'Tirar foto ou vídeo',
  lerDuracao = lerDuracaoDoVideo,
  lerPosicao = lerPosicaoDoNavegador,
}: {
  api: Pick<ApiDeFotos, 'registrarFotoEstado'>;
  corridaId: string;
  etapa: EtapaDaFoto;
  papel: PapelDoAutor;
  fotos: readonly FotoEstadoExibida[];
  limite: number;
  duracaoMaximaSegundos: number;
  aoRegistrar: () => void;
  escura?: boolean;
  rotuloDoBotao?: string;
  lerDuracao?: (arquivo: File) => Promise<number>;
  lerPosicao?: () => Promise<{ latitude: number; longitude: number } | null>;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const meus = contarFotosDoAutor(fotos, papel, etapa);
  const cheio = meus >= limite;

  async function escolhido(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!arquivo) return;
    setErro(null);
    if (cheio) {
      setErro(`Limite de ${limite} itens por etapa atingido.`);
      return;
    }
    setEnviando(true);
    try {
      if (arquivo.type.startsWith('video/')) {
        let duracao: number;
        try {
          duracao = await lerDuracao(arquivo);
        } catch {
          setErro('Não foi possível ler o vídeo. Grave de novo.');
          return;
        }
        if (!(duracao <= duracaoMaximaSegundos)) {
          setErro(`Vídeo com mais de ${duracaoMaximaSegundos} s. Grave um mais curto.`);
          return;
        }
      }
      const posicao = await lerPosicao();
      await api.registrarFotoEstado(corridaId, arquivo, { etapa, ...posicao });
      aoRegistrar();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        ref={campo}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        aria-label="Escolher foto ou vídeo"
        hidden
        onChange={escolhido}
      />
      <Botao
        grande
        variante={escura ? 'claro' : 'primario'}
        disabled={enviando || cheio}
        onClick={() => campo.current?.click()}
      >
        {enviando ? 'Enviando…' : rotuloDoBotao}
      </Botao>
      <span className="mono" style={{ color: escura ? 'var(--cinza-medio)' : undefined }}>
        Seus itens nesta etapa: {meus} de {limite}
      </span>
      {erro && (
        <p
          role="alert"
          style={{
            font: '500 14px/1.4 var(--fonte-texto)',
            color: escura ? 'var(--alerta-borda)' : 'var(--alerta-texto)',
            margin: 0,
          }}
        >
          {erro}
        </p>
      )}
    </div>
  );
}

/** As Fotos de estado agrupadas por etapa, com autor e hora do servidor. */
export function GaleriaFotosEstado({
  fotos,
  etapa,
  escura,
}: {
  fotos: readonly FotoEstadoExibida[];
  /** Só esta etapa; sem ela, mostra as duas. */
  etapa?: EtapaDaFoto;
  escura?: boolean;
}) {
  const etapas: EtapaDaFoto[] = etapa ? [etapa] : ['antes', 'depois'];
  const apagado = escura ? 'var(--cinza-claro)' : 'var(--tinta-2)';
  const vazia = etapas.every((e) => !fotos.some((f) => f.etapa === e));
  if (vazia) {
    return (
      <p className="apoio" style={{ fontSize: 14, margin: 0 }}>
        Nenhuma foto registrada ainda.
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {etapas.map((e) => {
        const itens = fotos.filter((f) => f.etapa === e);
        if (itens.length === 0) return null;
        return (
          <section key={e} aria-label={NOME_DA_ETAPA[e]}>
            <h3 style={{ font: '600 15px var(--fonte-titulo)', margin: '0 0 8px' }}>
              {NOME_DA_ETAPA[e]}
            </h3>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              {itens.map((f) => {
                const legenda = `${NOME_DO_AUTOR[f.papelAutor]} às ${formatarHora(new Date(f.criadoEm))}`;
                const miniatura = {
                  width: '100%',
                  height: 96,
                  objectFit: 'cover',
                  borderRadius: 10,
                } as const;
                return (
                  <li key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {f.url ? (
                      f.tipo === 'video' ? (
                        <video
                          src={f.url}
                          controls
                          preload="metadata"
                          aria-label={`Vídeo: ${legenda}`}
                          style={miniatura}
                        />
                      ) : (
                        <img
                          src={f.url}
                          alt={`Foto: ${legenda}`}
                          loading="lazy"
                          style={miniatura}
                        />
                      )
                    ) : (
                      <div
                        className="foto foto--pequena"
                        style={{ height: 96 }}
                        role="img"
                        aria-label={`Indisponível: ${legenda}`}
                      >
                        indisponível
                      </div>
                    )}
                    <span style={{ font: '500 12px/1.3 var(--fonte-texto)', color: apagado }}>
                      {legenda}
                    </span>
                    {f.latitude !== null && f.longitude !== null && (
                      <span className="mono" style={{ fontSize: 10, color: apagado }}>
                        {f.latitude.toFixed(4)}, {f.longitude.toFixed(4)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
