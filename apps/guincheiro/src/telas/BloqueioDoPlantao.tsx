import { forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MotivoDeBloqueio } from '@guinchei/api';
import { Botao } from '@guinchei/ui';
import { ROTA_DOCUMENTOS } from '../rotas';

export const ID_DO_BLOQUEIO = 'bloqueio-do-plantao';

const itens = (n: number) => `${n} ${n === 1 ? 'item' : 'itens'}`;

/**
 * Explica por que o interruptor do plantão está bloqueado: o Guincheiro só entra no Match com os
 * documentos aprovados, vinculado a um veículo aprovado e com a Frota ativa (issue #50). A lista
 * é a que o banco usa para excluí-lo do Match, não um texto genérico.
 */
export const BloqueioDoPlantao = forwardRef<HTMLElement, { motivos: MotivoDeBloqueio[] }>(
  function BloqueioDoPlantao({ motivos }, ref) {
    const ir = useNavigate();
    const temDocumento = motivos.some((m) => m.codigo === 'documento');
    return (
      <section
        ref={ref}
        id={ID_DO_BLOQUEIO}
        tabIndex={-1}
        aria-label="Plantão bloqueado"
        className="cartao cartao--escuro"
        style={{
          padding: 18,
          borderRadius: 16,
          display: 'grid',
          gap: 10,
          border: '1px solid var(--ambar)',
          outline: 'none',
        }}
      >
        <strong style={{ font: '600 16px var(--fonte-texto)' }}>
          Plantão bloqueado até a homologação
        </strong>
        <span style={{ font: '400 14px/1.5 var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
          A operação só libera o plantão quando está tudo aprovado. Falta
          {motivos.length === 1 ? '' : 'm'} {itens(motivos.length)}:
        </span>
        <ul
          aria-label="O que falta para liberar o plantão"
          style={{
            margin: 0,
            paddingLeft: 20,
            display: 'grid',
            gap: 6,
            font: '400 14px/1.5 var(--fonte-texto)',
          }}
        >
          {motivos.map((m) => (
            <li key={`${m.codigo}-${m.descricao}`}>{m.descricao}</li>
          ))}
        </ul>
        {temDocumento && (
          <Botao variante="contorno-escuro" onClick={() => ir(ROTA_DOCUMENTOS)}>
            Ver meus documentos
          </Botao>
        )}
      </section>
    );
  },
);
