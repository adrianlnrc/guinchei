import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AlertaDeVencimento, ItemEmAlerta } from '@guinchei/api';
import { Botao } from '@guinchei/ui';
import { useApi } from '../../api';
import { ROTA_DOCUMENTOS_ANTECEDENTES, ROTA_DOCUMENTOS_CNH, rotaDaApolice } from '../../rotas';
import { formatarData } from '../cadastro/regras';

const NOME_DO_DOCUMENTO: Partial<Record<ItemEmAlerta['tipo'], string>> = {
  apolice_rc: 'Apólice de responsabilidade civil',
  cnh: 'CNH',
  antecedentes: 'Certidão de antecedentes',
};

/** Para onde vai o botão "Enviar documento novo": a tela de cada documento. */
function rotaDoReenvio(item: ItemEmAlerta): string | null {
  if (item.tipo === 'apolice_rc' && item.alvo === 'frota') return rotaDaApolice(item.itemId);
  if (item.tipo === 'cnh' && item.alvo === 'guincheiro') return ROTA_DOCUMENTOS_CNH;
  if (item.tipo === 'antecedentes' && item.alvo === 'guincheiro') {
    return ROTA_DOCUMENTOS_ANTECEDENTES;
  }
  return null;
}

/** "Venceu há 3 dias, em 28/10/2026", "Vence hoje", "Vence em 12 dias, em 12/11/2026". */
export function prazoDoAviso(item: ItemEmAlerta): string {
  const dias = item.diasRestantes;
  const data = formatarData(item.validade);
  if (dias < 0) return `Venceu há ${-dias} ${dias === -1 ? 'dia' : 'dias'}, em ${data}`;
  if (dias === 0) return `Vence hoje, ${data}`;
  if (dias === 1) return `Vence amanhã, ${data}`;
  return `Vence em ${dias} dias, em ${data}`;
}

/**
 * Avisa o Guincheiro (e o representante) dos documentos que vencem em breve ou já venceram,
 * com o caminho para enviar o novo. Só aparece quando há o que avisar; se a leitura falha,
 * fica em silêncio (o aviso é um reforço, não pode atrapalhar o resto da tela).
 */
export function AvisosDeVencimento() {
  const api = useApi();
  const [alerta, setAlerta] = useState<AlertaDeVencimento | null>(null);

  useEffect(() => {
    let vigente = true;
    api.listarAvisosDeVencimento().then(
      (lido) => vigente && setAlerta(lido),
      () => {},
    );
    return () => {
      vigente = false;
    };
  }, [api]);

  if (!alerta || alerta.itens.length === 0) return null;
  const vencidos = alerta.itens.filter((i) => i.estado === 'vencido').length;

  return (
    <section
      aria-label="Documentos vencendo"
      className="cartao cartao--escuro"
      style={{
        padding: 18,
        borderRadius: 16,
        display: 'grid',
        gap: 12,
        border: '1px solid var(--alerta)',
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <strong style={{ font: '600 16px var(--fonte-texto)', color: 'var(--alerta-texto)' }}>
          {vencidos > 0
            ? vencidos === 1
              ? 'Documento vencido'
              : 'Documentos vencidos'
            : alerta.itens.length === 1
              ? 'Documento perto de vencer'
              : 'Documentos perto de vencer'}
        </strong>
        <span style={{ font: '400 14px/1.5 var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
          {vencidos > 0
            ? 'Documento vencido não vale para a homologação. Envie o novo para a operação aprovar de novo.'
            : `Avisamos ${alerta.prazoDias} dias antes do vencimento, para você renovar sem ficar parado.`}
        </span>
      </div>
      <ul
        aria-label="Documentos a renovar"
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}
      >
        {alerta.itens.map((item) => (
          <Aviso key={item.itemId} item={item} />
        ))}
      </ul>
    </section>
  );
}

function Aviso({ item }: { item: ItemEmAlerta }) {
  const ir = useNavigate();
  const nome = NOME_DO_DOCUMENTO[item.tipo] ?? item.tipo;
  const vencido = item.estado === 'vencido';
  const rota = rotaDoReenvio(item);
  // O representante vê o documento de um Guincheiro da Frota, mas quem reenvia é ele.
  const deOutraPessoa = item.guincheiro !== null && !item.podeReenviar;

  return (
    <li
      aria-label={deOutraPessoa ? `${nome} de ${item.guincheiro}` : nome}
      style={{
        padding: 14,
        borderRadius: 12,
        background: 'var(--superficie-escura)',
        border: '1px solid var(--borda-escura)',
        display: 'grid',
        gap: 6,
      }}
    >
      <span style={{ font: '600 16px var(--fonte-texto)' }}>
        {nome}
        {deOutraPessoa && ` · ${item.guincheiro}`}
      </span>
      <span
        style={{
          font: '600 14px var(--fonte-texto)',
          color: vencido ? 'var(--alerta-texto)' : 'var(--cinza-claro)',
        }}
      >
        {prazoDoAviso(item)}
      </span>
      {vencido && item.podeReenviar && rota && (
        <Botao
          variante="contorno-escuro"
          aria-label={`Enviar documento novo: ${nome}`}
          onClick={() => ir(rota)}
        >
          Enviar documento novo
        </Botao>
      )}
      {vencido && deOutraPessoa && (
        <span style={{ font: '400 14px/1.45 var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
          Peça para {item.guincheiro} enviar o documento novo pelo app dele.
        </span>
      )}
      {!vencido && (
        <span style={{ font: '400 14px/1.45 var(--fonte-texto)', color: 'var(--cinza-medio)' }}>
          {deOutraPessoa
            ? `Avise ${item.guincheiro} para providenciar o documento novo. O envio abre quando a validade passar.`
            : 'Providencie o documento novo. O envio abre aqui quando a validade passar.'}
        </span>
      )}
    </li>
  );
}
