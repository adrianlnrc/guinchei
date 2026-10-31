import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MeuVeiculo as Veiculo, VinculoEncerrado } from '@guinchei/api';
import { mascararPlaca } from '@guinchei/documentos';
import { Botao } from '@guinchei/ui';
import { useApi } from '../api';
import { ROTA_VINCULOS } from '../rotas';
import { NOME_DO_TIPO, formatarPbt } from './veiculo/regras';

interface Carga {
  veiculo: Veiculo | null;
  /** O vínculo mais recente que a conferência da CNH derrubou, se não houver veículo agora. */
  derrubado: VinculoEncerrado | null;
  /** Quem representa uma Frota (o autônomo) escolhe o próprio veículo. */
  representante: boolean;
}

/**
 * No plantão, mostra em qual veículo o Guincheiro está vinculado. Sem vínculo, explica o que
 * fazer; se o vínculo caiu porque a CNH não cobre o PBT, diz isso. Some se a leitura falha, para
 * não atrapalhar o plantão.
 */
export function MeuVeiculo() {
  const api = useApi();
  const ir = useNavigate();
  const [carga, setCarga] = useState<Carga | null>(null);

  useEffect(() => {
    let vigente = true;
    (async () => {
      const veiculo = await api.buscarMeuVeiculo();
      const [encerrados, frota, perfil] = await Promise.all([
        veiculo ? Promise.resolve([]) : api.listarVinculosEncerrados(),
        veiculo ? Promise.resolve(null) : api.buscarMinhaFrota(),
        api.buscarMeuPerfil(),
      ]);
      // A lista do representante traz os de toda a Frota; aqui só interessa o próprio vínculo.
      const derrubado =
        encerrados.find((e) => e.motivo === 'cnh_nao_cobre' && e.guincheiroId === perfil?.id) ??
        null;
      return { veiculo, derrubado, representante: frota !== null };
    })().then(
      (lida) => vigente && setCarga(lida),
      () => {},
    );
    return () => {
      vigente = false;
    };
  }, [api]);

  if (!carga) return null;
  const { veiculo, derrubado, representante } = carga;

  return (
    <section
      aria-label="Meu veículo"
      className="cartao cartao--escuro"
      style={{ padding: 18, borderRadius: 16, display: 'grid', gap: 8 }}
    >
      <span style={{ font: '600 13px var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
        SEU VEÍCULO
      </span>
      {veiculo ? (
        <>
          <strong style={{ font: '700 22px var(--fonte-titulo)' }}>
            {mascararPlaca(veiculo.placa)}
          </strong>
          <span style={{ font: '400 14px var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
            {NOME_DO_TIPO[veiculo.tipo]} · {formatarPbt(veiculo.pbtKg)}
          </span>
          <span
            style={{
              font: '600 14px/1.5 var(--fonte-texto)',
              color: veiculo.situacao === 'ativo' ? 'var(--sucesso)' : 'var(--ambar)',
            }}
          >
            {veiculo.situacao === 'ativo'
              ? 'Vínculo ativo'
              : 'Vínculo pendente: vale quando a operação aprovar a sua CNH. Se a categoria não cobrir o peso deste veículo, o vínculo é desfeito.'}
          </span>
        </>
      ) : (
        <>
          <strong style={{ font: '600 16px var(--fonte-texto)' }}>
            Nenhum veículo vinculado a você
          </strong>
          {derrubado && (
            <span style={{ font: '400 14px/1.5 var(--fonte-texto)', color: 'var(--ambar)' }}>
              O vínculo com o veículo {mascararPlaca(derrubado.placa)} foi desfeito
              {derrubado.detalhe ? `: ${derrubado.detalhe}` : ''}.
            </span>
          )}
          <span style={{ font: '400 14px/1.5 var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
            {representante
              ? 'Escolha o veículo que você vai dirigir. A categoria da CNH precisa cobrir o peso dele.'
              : 'Peça ao representante da sua Frota para vincular você a um veículo. A categoria da sua CNH precisa cobrir o peso dele.'}
          </span>
          {representante && (
            <Botao variante="contorno-escuro" onClick={() => ir(ROTA_VINCULOS)}>
              Escolher meu veículo
            </Botao>
          )}
        </>
      )}
    </section>
  );
}
