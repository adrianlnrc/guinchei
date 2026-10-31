import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MeusDocumentos } from '@guinchei/api';
import { Botao } from '@guinchei/ui';
import { useApi } from '../../api';
import { ROTA_DOCUMENTOS } from '../../rotas';
import { resumoDosDocumentos } from './Documentos';

/**
 * No plantão, explica por que o Guincheiro ainda não recebe chamados: os documentos não foram
 * todos aprovados. A trava de Match em si é do ticket de elegibilidade; aqui só se explica.
 * Some quando os três documentos estão aprovados ou se a leitura falha.
 */
export function AvisoDeHomologacao() {
  const api = useApi();
  const ir = useNavigate();
  const [documentos, setDocumentos] = useState<MeusDocumentos | null>(null);

  useEffect(() => {
    let vigente = true;
    api.buscarMeusDocumentos().then(
      (lidos) => vigente && setDocumentos(lidos),
      () => {},
    );
    return () => {
      vigente = false;
    };
  }, [api]);

  if (!documentos) return null;
  const itens = [documentos.cnh, documentos.antecedentes, documentos.selfie];
  if (itens.every((i) => i?.estado === 'aprovado')) return null;

  const { titulo, texto } = resumoDosDocumentos(documentos);
  const nadaEnviado = itens.every((i) => i === null);
  return (
    <section
      aria-label="Homologação"
      className="cartao cartao--escuro"
      style={{ padding: 18, borderRadius: 16, display: 'grid', gap: 8 }}
    >
      <strong style={{ font: '600 16px var(--fonte-texto)' }}>{titulo}</strong>
      <span style={{ font: '400 14px/1.5 var(--fonte-texto)', color: 'var(--cinza-claro)' }}>
        {texto}
      </span>
      <Botao variante="contorno-escuro" onClick={() => ir(ROTA_DOCUMENTOS)}>
        {nadaEnviado ? 'Enviar documentos' : 'Ver meus documentos'}
      </Botao>
    </section>
  );
}
