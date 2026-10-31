import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ErroApi,
  type EstadoDoVeiculo,
  type ItemHomologacao,
  type VeiculoDaFrota,
} from '@guinchei/api';
import { mascararPlaca } from '@guinchei/documentos';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../api';
import { MensagemDeErro } from '../MensagemDeErro';
import { ExigeRepresentante } from '../sessao';
import { NOME_DO_TIPO, formatarPbt } from './veiculo/regras';

const NOME_DO_ESTADO: Record<EstadoDoVeiculo, string> = {
  pendente: 'Em análise',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  vencido: 'Vencido',
};

const COR_DO_ESTADO: Record<EstadoDoVeiculo, string> = {
  pendente: 'var(--cinza-medio)',
  aprovado: 'var(--sucesso)',
  recusado: 'var(--alerta)',
  vencido: 'var(--alerta)',
};

/** "CRLV" ou "Foto 2 do veículo" (a ordem é a do envio). */
function nomeDoItem(item: ItemHomologacao, itens: ItemHomologacao[]): string {
  if (item.tipo !== 'foto_veiculo') return 'CRLV';
  const fotos = itens.filter((i) => i.tipo === 'foto_veiculo');
  return `Foto ${fotos.indexOf(item) + 1} do veículo`;
}

/** Os veículos da Frota, com o estado da homologação de cada um e o que pode ser reenviado. */
export function Veiculos() {
  return (
    <ExigeRepresentante>
      <Lista />
    </ExigeRepresentante>
  );
}

function Lista() {
  const api = useApi();
  const ir = useNavigate();
  // undefined: lendo.
  const [veiculos, setVeiculos] = useState<VeiculoDaFrota[] | undefined>(undefined);
  const [falhou, setFalhou] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setVeiculos(await api.listarMeusVeiculos());
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }, [api]);

  useEffect(() => {
    let vigente = true;
    api
      .listarMeusVeiculos()
      .then((lidos) => vigente && setVeiculos(lidos))
      .catch(() => vigente && setFalhou(true));
    return () => {
      vigente = false;
    };
  }, [api]);

  async function reenviar(item: ItemHomologacao, arquivo: File) {
    setOcupado(true);
    setErro(null);
    try {
      const caminho = await api.enviarArquivoDoVeiculo(
        arquivo,
        item.tipo === 'crlv' ? 'crlv' : 'foto',
      );
      await api.reenviarItemDeVeiculo(item.id, caminho);
    } catch (e) {
      setErro(
        e instanceof ErroApi && e.motivo !== 'falha'
          ? e.message
          : 'Não foi possível reenviar. Tente de novo.',
      );
    }
    await carregar();
    setOcupado(false);
  }

  return (
    <Tela escura rotulo="Meus veículos">
      <Corpo style={{ padding: '28px 24px 32px', gap: 16 }}>
        <div className="marca">guinchei</div>
        <Rotulo style={{ marginTop: 16, color: 'var(--cinza-medio)' }}>Minha Frota</Rotulo>
        <h1 className="titulo">Meus veículos</h1>
        <p className="apoio">
          A operação confere o CRLV e as fotos de cada veículo antes de ele ser usado nas Corridas.
        </p>
        {falhou && (
          <p role="alert" className="apoio">
            Não foi possível ler os seus veículos. Tente de novo.
          </p>
        )}
        {veiculos?.length === 0 && <p className="apoio">Nenhum veículo cadastrado ainda.</p>}
        <MensagemDeErro>{erro}</MensagemDeErro>
        {veiculos && veiculos.length > 0 && (
          <ul
            aria-label="Veículos da Frota"
            style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}
          >
            {veiculos.map((v) => (
              <li
                key={v.id}
                aria-label={`Veículo ${mascararPlaca(v.placa)}`}
                data-estado={v.estado}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: 'var(--superficie-escura)',
                  border: '1px solid var(--borda-escura)',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ font: '700 20px var(--fonte-titulo)' }}>{mascararPlaca(v.placa)}</div>
                <div style={{ font: '400 14px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
                  {NOME_DO_TIPO[v.tipo]} · {formatarPbt(v.pbtKg)}
                </div>
                <div
                  style={{ font: '600 14px var(--fonte-texto)', color: COR_DO_ESTADO[v.estado] }}
                >
                  {NOME_DO_ESTADO[v.estado]}
                </div>
                <ul
                  aria-label={`Itens do veículo ${mascararPlaca(v.placa)}`}
                  style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}
                >
                  {v.itens.map((item) => {
                    const nome = nomeDoItem(item, v.itens);
                    return (
                      <li key={item.id} style={{ display: 'grid', gap: 4 }}>
                        <div style={{ font: '500 15px var(--fonte-texto)' }}>
                          {nome}:{' '}
                          <span style={{ color: COR_DO_ESTADO[item.estado] }}>
                            {NOME_DO_ESTADO[item.estado]}
                          </span>
                        </div>
                        {item.motivo && (
                          <div style={{ font: '400 14px var(--fonte-texto)' }}>
                            Motivo: {item.motivo}
                          </div>
                        )}
                        {(item.estado === 'recusado' || item.estado === 'vencido') && (
                          <input
                            type="file"
                            accept={item.tipo === 'crlv' ? 'application/pdf,image/*' : 'image/*'}
                            aria-label={`Reenviar ${nome} do veículo ${mascararPlaca(v.placa)}`}
                            disabled={ocupado}
                            onChange={(e) => {
                              const arquivo = e.target.files?.[0];
                              if (arquivo) void reenviar(item, arquivo);
                              e.target.value = '';
                            }}
                            style={{ font: '400 14px var(--fonte-texto)' }}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <div className="espaco" />
        <Botao variante="claro" grande onClick={() => ir('/veiculos/novo')}>
          Cadastrar veículo
        </Botao>
        <Link centro onClick={() => ir('/frota')}>
          Voltar para a Frota
        </Link>
      </Corpo>
    </Tela>
  );
}
