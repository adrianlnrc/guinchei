import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ErroApi,
  type ConviteGuincheiro,
  type GuincheiroDaFrota,
  type MotivoErroApi,
} from '@guinchei/api';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { mascararCelular, telefoneE164 } from '../celular';
import { ROTA_DADOS_PESSOAIS } from '../rotas';
import { MensagemDeErro } from '../MensagemDeErro';
import { AVISO_NAO_E_GUINCHEIRO, useSessao } from '../sessao';
import { Campo } from './cadastro/campos';

/** "5561900000002" → "(61) 90000-0002" */
const celularDoBanco = (telefone: string) => mascararCelular(telefone.replace(/^55/, ''));

/** A mensagem que o representante lê quando o servidor recusa o convite. */
const MENSAGEM_DO_CONVITE: Partial<Record<MotivoErroApi, string>> = {
  telefone_invalido: 'Informe o celular com DDD.',
  convite_repetido: 'Este número já tem um convite pendente na sua Frota.',
  convidado_por_outra_frota: 'Este número já foi convidado por outra Frota.',
  numero_ja_tem_conta: 'Este número já tem conta no Guinchei.',
};

interface Carga {
  convites: ConviteGuincheiro[];
  guincheiros: GuincheiroDaFrota[];
}

/** Convites e Guincheiros da Frota (#46): só para o representante. */
export function Convites() {
  const estado = useSessao();
  if (estado === 'sem_sessao') return <Navigate to="/entrar" replace />;
  if (estado === 'nao_e_guincheiro') {
    return <Navigate to="/entrar" replace state={{ erro: AVISO_NAO_E_GUINCHEIRO }} />;
  }
  if (estado === 'convidado') return <Navigate to={ROTA_DADOS_PESSOAIS} replace />;
  if (estado === 'sem_perfil') return <Navigate to="/cadastro" replace />;
  if (estado === 'pronto') return <Navigate to="/" replace />;
  if (estado === 'verificando') return <Tela rotulo="Carregando">{null}</Tela>;
  return <Gestao />;
}

function Gestao() {
  const api = useApi();
  const ir = useNavigate();
  const [carga, setCarga] = useState<Carga | undefined>(undefined);
  const [falhou, setFalhou] = useState(false);
  const [celular, setCelular] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const buscar = useCallback(async (): Promise<Carga> => {
    const [convites, guincheiros] = await Promise.all([
      api.listarConvites(),
      api.listarGuincheirosDaFrota(),
    ]);
    return { convites, guincheiros };
  }, [api]);
  const recarregar = async () => setCarga(await buscar());

  useEffect(() => {
    let vigente = true;
    buscar()
      .then((c) => vigente && setCarga(c))
      .catch(() => vigente && setFalhou(true));
    return () => {
      vigente = false;
    };
  }, [buscar]);

  async function convidar() {
    setErro(null);
    setOcupado(true);
    try {
      await api.convidarGuincheiro(telefoneE164(celular));
      setCelular('');
      await recarregar();
    } catch (e) {
      setErro(
        (e instanceof ErroApi && MENSAGEM_DO_CONVITE[e.motivo]) ||
          'Não foi possível enviar o convite. Tente de novo.',
      );
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar(id: string) {
    setErro(null);
    setOcupado(true);
    try {
      await api.cancelarConvite(id);
      await recarregar();
    } catch (e) {
      setErro(
        e instanceof ErroApi && e.motivo === 'convite_indisponivel'
          ? 'Este convite já não está pendente.'
          : 'Não foi possível cancelar o convite. Tente de novo.',
      );
      await recarregar().catch(() => {});
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Tela escura rotulo="Convites">
      <Corpo style={{ padding: '16px 24px 32px', gap: 16 }}>
        <Link onClick={() => ir('/frota')}>Voltar</Link>
        <Rotulo style={{ marginTop: 8, color: 'var(--cinza-medio)' }}>Guincheiros</Rotulo>
        <h1 className="titulo">Convide um Guincheiro</h1>
        <p className="apoio">
          O Guincheiro entra no app com este celular, informa nome e CPF e passa a atender pela sua
          Frota. O convite vale por 7 dias.
        </p>
        <Campo
          rotulo="Celular com DDD"
          inputMode="tel"
          autoComplete="off"
          placeholder="(61) 99999-9999"
          value={mascararCelular(celular)}
          onChange={(e) => {
            setCelular(e.target.value.replace(/\D/g, '').slice(0, 11));
            setErro(null);
          }}
        />
        <MensagemDeErro>{erro}</MensagemDeErro>
        <Botao variante="claro" grande disabled={celular.length < 10 || ocupado} onClick={convidar}>
          Convidar
        </Botao>

        {falhou && (
          <p role="alert" className="apoio">
            Não foi possível ler os convites. Tente de novo.
          </p>
        )}
        {carga && (
          <>
            <Rotulo style={{ marginTop: 16, color: 'var(--cinza-medio)' }}>
              Convites pendentes
            </Rotulo>
            {carga.convites.length === 0 ? (
              <p className="apoio">Nenhum convite pendente.</p>
            ) : (
              <ul style={lista} aria-label="Convites pendentes">
                {carga.convites.map((c) => (
                  <li key={c.id} style={cartao}>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <div style={{ font: '600 16px var(--fonte-texto)' }}>
                        {celularDoBanco(c.telefone)}
                      </div>
                      <div
                        style={{
                          font: '400 14px var(--fonte-texto)',
                          color: c.vencido ? 'var(--alerta)' : 'var(--cinza-medio)',
                        }}
                      >
                        {c.vencido
                          ? 'Vencido: convide de novo'
                          : `Vale até ${new Date(c.validoAte).toLocaleDateString('pt-BR')}`}
                      </div>
                    </div>
                    <Link
                      aria-label={`Cancelar o convite de ${celularDoBanco(c.telefone)}`}
                      disabled={ocupado}
                      onClick={() => cancelar(c.id)}
                    >
                      Cancelar
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <Rotulo style={{ marginTop: 16, color: 'var(--cinza-medio)' }}>
              Guincheiros da Frota
            </Rotulo>
            {carga.guincheiros.length === 0 ? (
              <p className="apoio">Nenhum Guincheiro vinculado ainda.</p>
            ) : (
              <ul style={lista} aria-label="Guincheiros da Frota">
                {carga.guincheiros.map((g) => (
                  <li key={g.id} style={cartao}>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <div style={{ font: '600 16px var(--fonte-texto)' }}>{g.nome}</div>
                      <div
                        style={{ font: '400 14px var(--fonte-texto)', color: 'var(--cinza-medio)' }}
                      >
                        {celularDoBanco(g.telefone)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Corpo>
    </Tela>
  );
}

const lista = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 } as const;

const cartao = {
  padding: 14,
  borderRadius: 14,
  background: 'var(--superficie-escura)',
  border: '1px solid var(--borda-escura)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
} as const;
