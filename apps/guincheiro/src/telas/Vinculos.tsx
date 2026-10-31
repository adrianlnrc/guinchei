import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ErroApi,
  type CnhDoGuincheiro,
  type GuincheiroDaFrota,
  type VeiculoDaFrota,
  type VinculoDaFrota,
  type VinculoEncerrado,
} from '@guinchei/api';
import { avaliarVinculo, LIMITE_PBT_CATEGORIA_B_KG, type AvaliacaoDoVinculo } from '@guinchei/cnh';
import { mascararPlaca } from '@guinchei/documentos';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { MensagemDeErro } from '../MensagemDeErro';
import { ROTA_CONVITES, ROTA_DADOS_PESSOAIS } from '../rotas';
import { AVISO_NAO_E_GUINCHEIRO, useSessao } from '../sessao';
import { CampoDeSelecao } from './cadastro/campos';
import { NOME_DO_TIPO, formatarPbt } from './veiculo/regras';

interface Carga {
  guincheiros: GuincheiroDaFrota[];
  veiculos: VeiculoDaFrota[];
  vinculos: VinculoDaFrota[];
  cnhs: CnhDoGuincheiro[];
  encerrados: VinculoEncerrado[];
}

const NOME_DO_ESTADO_DA_CNH = {
  aprovado: 'aprovada',
  pendente: 'em análise pela operação',
  recusado: 'recusada, aguardando novo envio',
  vencido: 'vencida, aguardando novo envio',
} as const;

/** "CNH C · aprovada", "CNH B · em análise pela operação" ou "CNH ainda não enviada". */
function descricaoDaCnh(cnh: CnhDoGuincheiro | undefined): string {
  if (!cnh?.categoria) return 'CNH ainda não enviada';
  return `CNH ${cnh.categoria} · ${cnh.estado ? NOME_DO_ESTADO_DA_CNH[cnh.estado] : 'não enviada'}`;
}

/** O que o representante pode fazer quando o vínculo é recusado: sempre há uma saída. */
function saidaDoBloqueio(avaliacao: AvaliacaoDoVinculo, nome: string, categoria: string | null) {
  const limite = formatarPbt(LIMITE_PBT_CATEGORIA_B_KG);
  if (avaliacao.categoriaMinima === 'C') {
    return `Vincule a este veículo um Guincheiro com CNH C ou superior, ou escolha para ${nome} um veículo de até ${limite}.`;
  }
  if (avaliacao.categoriaMinima === 'B') {
    return `A CNH ${categoria ?? ''} não habilita conduzir guincho. Vincule a este veículo outro Guincheiro, com CNH B ou superior.`;
  }
  return `Peça a ${nome} que envie a CNH de novo, ou vincule a este veículo outro Guincheiro.`;
}

const placaDoVeiculo = (v: Pick<VeiculoDaFrota, 'placa'>) => mascararPlaca(v.placa);
const resumoDoVeiculo = (v: VeiculoDaFrota) =>
  `${placaDoVeiculo(v)} · ${NOME_DO_TIPO[v.tipo]} · ${formatarPbt(v.pbtKg)}`;

/** Vínculos Guincheiro × veículo da Frota (#48): só para o representante. */
export function Vinculos() {
  const estado = useSessao();
  if (estado === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (estado === 'nao_e_guincheiro') {
    return <Navigate to="/entrar" replace state={{ erro: AVISO_NAO_E_GUINCHEIRO }} />;
  }
  if (estado === 'convidado') return <Navigate to={ROTA_DADOS_PESSOAIS} replace />;
  if (estado === 'sem_perfil') return <Navigate to="/cadastro" replace />;
  if (estado === 'verificando') return <Tela rotulo="Carregando">{null}</Tela>;
  // O autônomo (`pronto`) também é representante da própria Frota; quem não é, sai em `Gestao`.
  return <Gestao />;
}

function Gestao() {
  const api = useApi();
  const ir = useNavigate();
  // undefined: lendo; null: quem está logado não representa uma Frota.
  const [carga, setCarga] = useState<Carga | null | undefined>(undefined);
  const [falhou, setFalhou] = useState(false);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [desfazendo, setDesfazendo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const buscar = useCallback(async (): Promise<Carga | null> => {
    const frota = await api.buscarMinhaFrota();
    if (!frota) return null;
    const [guincheiros, veiculos, vinculos, cnhs, encerrados] = await Promise.all([
      api.listarGuincheirosDaFrota(),
      api.listarMeusVeiculos(),
      api.listarVinculos(),
      api.listarCnhDosGuincheiros(),
      api.listarVinculosEncerrados(),
    ]);
    return { guincheiros, veiculos, vinculos, cnhs, encerrados };
  }, [api]);

  useEffect(() => {
    let vigente = true;
    buscar()
      .then((c) => vigente && setCarga(c))
      .catch(() => vigente && setFalhou(true));
    return () => {
      vigente = false;
    };
  }, [buscar]);

  async function recarregar() {
    try {
      setCarga(await buscar());
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }

  async function confirmar(g: GuincheiroDaFrota, v: VeiculoDaFrota) {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      const situacao = await api.vincularGuincheiro(g.id, v.id);
      setEscolhas({ ...escolhas, [g.id]: '' });
      setAviso(
        situacao === 'ativo'
          ? `${g.nome} vinculado ao veículo ${placaDoVeiculo(v)}.`
          : `${g.nome} vinculado ao veículo ${placaDoVeiculo(v)}, com vínculo pendente até a CNH ser aprovada.`,
      );
    } catch (e) {
      if (e instanceof ErroApi && e.motivo === 'vinculo_bloqueado') {
        // A CNH mudou depois de a tela abrir: o banco recusou, e a tela passa a mostrar o aviso.
        setErro(
          `O vínculo foi recusado: a CNH de ${g.nome} não cobre o PBT deste veículo. Atualizamos a tela.`,
        );
      } else if (e instanceof ErroApi && e.motivo !== 'falha') {
        setErro(e.message);
      } else {
        setErro('Não foi possível vincular. Tente de novo.');
      }
    }
    await recarregar();
    setOcupado(false);
  }

  async function desfazer(vinculo: VinculoDaFrota, g: GuincheiroDaFrota | undefined) {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      await api.desfazerVinculo(vinculo.id);
      setDesfazendo(null);
      setAviso(`Vínculo de ${g?.nome ?? 'Guincheiro'} desfeito.`);
    } catch (e) {
      setErro(
        e instanceof ErroApi && e.motivo === 'vinculo_indisponivel'
          ? 'Este vínculo já foi desfeito.'
          : 'Não foi possível desfazer o vínculo. Tente de novo.',
      );
      setDesfazendo(null);
    }
    await recarregar();
    setOcupado(false);
  }

  if (carga === null) return <Navigate to="/" replace />;
  if (carga === undefined && !falhou) return <Tela rotulo="Carregando">{null}</Tela>;

  const nomeDe = (id: string) => carga?.guincheiros.find((g) => g.id === id)?.nome ?? 'Guincheiro';
  const derrubados = (carga?.encerrados ?? [])
    .filter((e) => e.motivo === 'cnh_nao_cobre')
    .slice(0, 5);

  return (
    <Tela escura rotulo="Vínculos">
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <Link onClick={() => ir('/frota')}>Voltar</Link>
        <Rotulo style={{ marginTop: 8, color: 'var(--cinza-medio)' }}>Minha Frota</Rotulo>
        <h1 className="titulo">Quem dirige cada veículo</h1>
        <p className="apoio">
          Cada Guincheiro dirige um veículo da Frota. A categoria da CNH precisa cobrir o peso (PBT)
          do veículo: B até {formatarPbt(LIMITE_PBT_CATEGORIA_B_KG)}, C ou superior acima disso
          (CTB, art. 143). Se a CNH ainda não foi aprovada, o vínculo fica pendente e é conferido na
          aprovação.
        </p>
        {falhou && (
          <p role="alert" className="apoio">
            Não foi possível ler os vínculos. Tente de novo.
          </p>
        )}
        {aviso && (
          <p role="status" style={{ margin: 0, font: '500 15px var(--fonte-texto)' }}>
            {aviso}
          </p>
        )}
        <MensagemDeErro>{erro}</MensagemDeErro>

        {carga && derrubados.length > 0 && (
          <section
            aria-label="Vínculos desfeitos pela conferência da CNH"
            style={{ ...cartaoDeAviso, display: 'grid', gap: 6 }}
          >
            <strong style={{ font: '600 16px var(--fonte-texto)' }}>
              Vínculos desfeitos pela conferência da CNH
            </strong>
            <ul style={{ ...lista, gap: 6 }}>
              {derrubados.map((d) => (
                <li key={d.id} style={{ font: '400 14px/1.5 var(--fonte-texto)' }}>
                  {nomeDe(d.guincheiroId)} saiu do veículo {mascararPlaca(d.placa)}
                  {d.detalhe ? `: ${d.detalhe}` : ''}. Vincule-o a um veículo que a CNH cubra.
                </li>
              ))}
            </ul>
          </section>
        )}

        {carga && carga.guincheiros.length === 0 && (
          <div style={vazio}>
            <strong style={{ font: '600 16px var(--fonte-texto)' }}>
              A Frota ainda não tem Guincheiros
            </strong>
            <span style={{ font: '400 14px/1.5 var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
              Convide quem vai dirigir os seus veículos. Depois que entrarem, você os vincula aqui.
            </span>
            <Botao variante="claro" onClick={() => ir(ROTA_CONVITES)}>
              Convidar o primeiro Guincheiro
            </Botao>
          </div>
        )}
        {carga && carga.guincheiros.length > 0 && carga.veiculos.length === 0 && (
          <div style={vazio}>
            <strong style={{ font: '600 16px var(--fonte-texto)' }}>
              Cadastre um veículo para vincular
            </strong>
            <span style={{ font: '400 14px/1.5 var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
              Informe a placa e o PBT do guincho. A operação confere o CRLV, mas você já pode
              vincular os Guincheiros enquanto isso.
            </span>
            <Botao variante="claro" onClick={() => ir('/veiculos/novo')}>
              Cadastrar veículo
            </Botao>
          </div>
        )}

        {carga && carga.guincheiros.length > 0 && carga.veiculos.length > 0 && (
          <ul aria-label="Guincheiros e veículos" style={lista}>
            {carga.guincheiros.map((g) => {
              const cnh = carga.cnhs.find((c) => c.guincheiroId === g.id);
              const vinculo = carga.vinculos.find((v) => v.guincheiroId === g.id);
              const doVinculo = vinculo && carga.veiculos.find((v) => v.id === vinculo.veiculoId);
              const escolhido = carga.veiculos.find((v) => v.id === escolhas[g.id]);
              const avaliacao =
                escolhido &&
                avaliarVinculo(
                  { categoria: cnh?.categoria ?? null, aprovada: cnh?.estado === 'aprovado' },
                  escolhido.pbtKg,
                );
              return (
                <li key={g.id} aria-label={`Guincheiro ${g.nome}`} style={cartao}>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div style={{ font: '600 17px var(--fonte-texto)' }}>{g.nome}</div>
                    <div
                      style={{ font: '400 14px var(--fonte-texto)', color: 'var(--cinza-medio)' }}
                    >
                      {descricaoDaCnh(cnh)}
                    </div>
                  </div>

                  {vinculo && doVinculo ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ font: '500 15px var(--fonte-texto)' }}>
                        Veículo: {resumoDoVeiculo(doVinculo)}
                      </div>
                      <div
                        style={{
                          font: '600 14px var(--fonte-texto)',
                          color: vinculo.situacao === 'ativo' ? 'var(--sucesso)' : 'var(--ambar)',
                        }}
                      >
                        {vinculo.situacao === 'ativo'
                          ? 'Vínculo ativo'
                          : 'Vínculo pendente: aguardando a aprovação da CNH'}
                      </div>
                      {desfazendo === vinculo.id ? (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <span style={{ font: '400 14px/1.5 var(--fonte-texto)' }}>
                            Desfazer o vínculo de {g.nome} com o veículo {placaDoVeiculo(doVinculo)}
                            ? Ele deixa de aparecer como motorista deste veículo.
                          </span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Botao
                              variante="claro"
                              disabled={ocupado}
                              aria-label={`Confirmar: desfazer vínculo de ${g.nome}`}
                              onClick={() => void desfazer(vinculo, g)}
                            >
                              Sim, desfazer
                            </Botao>
                            <Botao variante="contorno-escuro" onClick={() => setDesfazendo(null)}>
                              Manter
                            </Botao>
                          </div>
                        </div>
                      ) : (
                        <Link
                          aria-label={`Desfazer vínculo de ${g.nome}`}
                          disabled={ocupado}
                          onClick={() => setDesfazendo(vinculo.id)}
                          style={{ justifySelf: 'start' }}
                        >
                          Desfazer vínculo
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <CampoDeSelecao
                        rotulo={`Veículo de ${g.nome}`}
                        value={escolhas[g.id] ?? ''}
                        onChange={(e) => {
                          setErro(null);
                          setAviso(null);
                          setEscolhas({ ...escolhas, [g.id]: e.target.value });
                        }}
                      >
                        <option value="">Escolha um veículo</option>
                        {carga.veiculos.map((v) => (
                          <option key={v.id} value={v.id}>
                            {resumoDoVeiculo(v)}
                          </option>
                        ))}
                      </CampoDeSelecao>

                      {escolhido && avaliacao?.situacao === 'bloqueado' && (
                        <div
                          role="alert"
                          aria-label={`Vínculo não permitido para ${g.nome}`}
                          style={alerta}
                        >
                          <strong style={{ font: '600 16px var(--fonte-texto)' }}>
                            Não é possível vincular {g.nome} a este veículo
                          </strong>
                          <span style={{ font: '400 14px/1.5 var(--fonte-texto)' }}>
                            {avaliacao.motivo}.
                          </span>
                          <span style={{ font: '500 14px/1.5 var(--fonte-texto)' }}>
                            O que fazer:{' '}
                            {saidaDoBloqueio(avaliacao, g.nome, cnh?.categoria ?? null)}
                          </span>
                        </div>
                      )}
                      {escolhido && avaliacao?.situacao === 'pendente' && (
                        <div role="status" style={cartaoDeAviso}>
                          <strong style={{ font: '600 16px var(--fonte-texto)' }}>
                            O vínculo ficará pendente
                          </strong>
                          <span style={{ font: '400 14px/1.5 var(--fonte-texto)' }}>
                            {avaliacao.motivo} Se a categoria da CNH não cobrir{' '}
                            {formatarPbt(escolhido.pbtKg)}, o vínculo é desfeito na aprovação.
                          </span>
                        </div>
                      )}
                      {escolhido && avaliacao?.situacao === 'ativo' && (
                        <div
                          role="status"
                          style={{ ...cartaoDeAviso, borderColor: 'var(--sucesso)' }}
                        >
                          <span style={{ font: '400 14px/1.5 var(--fonte-texto)' }}>
                            {avaliacao.motivo}. O vínculo fica ativo.
                          </span>
                        </div>
                      )}
                      {escolhido && avaliacao && avaliacao.situacao !== 'bloqueado' && (
                        <Botao
                          variante="claro"
                          disabled={ocupado}
                          aria-label={`Confirmar vínculo de ${g.nome} com ${placaDoVeiculo(escolhido)}`}
                          onClick={() => void confirmar(g, escolhido)}
                        >
                          {avaliacao.situacao === 'pendente'
                            ? 'Confirmar vínculo pendente'
                            : 'Confirmar vínculo'}
                        </Botao>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="espaco" />
        <Link centro onClick={() => ir('/veiculos')}>
          Meus veículos
        </Link>
        <Link centro onClick={() => ir(ROTA_CONVITES)}>
          Convidar Guincheiros
        </Link>
      </Corpo>
    </Tela>
  );
}

const lista = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 } as const;

const cartao = {
  padding: 14,
  borderRadius: 14,
  background: 'var(--superficie-escura)',
  border: '1px solid var(--borda-escura)',
  display: 'grid',
  gap: 12,
} as const;

const vazio = {
  ...cartao,
  padding: 18,
  gap: 10,
} as const;

const cartaoDeAviso = {
  padding: 14,
  borderRadius: 14,
  background: 'var(--superficie-escura)',
  border: '1px solid var(--borda-escura)',
  display: 'grid',
  gap: 6,
} as const;

const alerta = {
  padding: 14,
  borderRadius: 14,
  background: 'var(--alerta-fundo)',
  border: '1px solid var(--alerta-borda)',
  color: 'var(--alerta-texto)',
  display: 'grid',
  gap: 6,
} as const;
