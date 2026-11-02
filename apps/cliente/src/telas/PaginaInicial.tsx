import { useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ResumoDoPedido } from '@guinchei/api';
import { Botao, Link, Ponto, Rotulo, formatarReais } from '@guinchei/ui';
import { useApi } from '../api';
import { TelaComAbas } from '../AbasDoCliente';
import { useCarregar } from '../carregar';
import { useFluxo } from '../fluxo';
import { MensagemDeErro } from '../MensagemDeErro';
import { dataEHora, pedidoAtivo, primeiroNome, rotuloDaEtapa } from '../rotulos';
import { ExigePerfil } from '../sessao';

// Página inicial do Cliente logado: o botão de pedir, o Pedido em andamento, a avaliação
// que falta e um resumo de como o Guinchei funciona.

const COMO_FUNCIONA = [
  ['Preço fechado antes de pagar', 'Você vê o valor total e só confirma se concordar.'],
  ['Guincho verificado', 'Toda Frota é conferida pela nossa operação antes de atender.'],
  ['Acompanhe pelo app', 'Você vê cada etapa, do aceite à entrega, e registra fotos do veículo.'],
] as const;

export function PaginaInicial() {
  return (
    <ExigePerfil>
      <Inicial />
    </ExigePerfil>
  );
}

function Inicial() {
  const api = useApi();
  const ir = useNavigate();
  const { perfil, novoPedido, setPedidoId } = useFluxo();
  const carregar = useCallback(() => api.listarMinhasCorridas(), [api]);
  const { estado, recarregar } = useCarregar(carregar);

  const corridas = estado.tipo === 'pronto' ? estado.dados : [];
  const ativo = corridas.find((c) => pedidoAtivo(c.etapa));
  // A última Corrida entregue é a que o Cliente ainda lembra: só ela pede avaliação aqui.
  const ultimaEntregue = corridas.find((c) => c.etapa === 'entregue');
  const semAvaliar = ultimaEntregue && ultimaEntregue.nota === null ? ultimaEntregue : null;

  return (
    <TelaComAbas aba="inicio" rotulo="Início" estiloDoCorpo={{ gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        <Rotulo>Reboque no Distrito Federal</Rotulo>
        <h1 className="titulo" style={{ font: '700 30px/1.12 var(--fonte-titulo)' }}>
          Olá, {perfil ? primeiroNome(perfil.nome) : ''}
        </h1>
        <p className="apoio">Carro parou? Respira. A gente vai até você.</p>
      </div>

      <Botao
        onClick={() => {
          novoPedido();
          ir('/pedido/1');
        }}
      >
        Pedir guincho
      </Botao>

      {estado.tipo === 'carregando' && (
        <p className="apoio" role="status" aria-live="polite">
          Carregando suas Corridas…
        </p>
      )}
      {estado.tipo === 'erro' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <MensagemDeErro>Não foi possível carregar suas Corridas.</MensagemDeErro>
          <Link onClick={recarregar}>Tentar de novo</Link>
        </div>
      )}

      {ativo && (
        <CartaoDoInicio
          destaque
          rotulo="Seu guincho"
          titulo={rotuloDaEtapa(ativo.etapa)}
          pedido={ativo}
          acao="Acompanhar"
          onClick={() => {
            setPedidoId(ativo.pedidoId);
            ir('/acompanhamento');
          }}
        />
      )}
      {semAvaliar && (
        <CartaoDoInicio
          rotulo="Avalie a corrida"
          titulo="Como foi o atendimento?"
          pedido={semAvaliar}
          acao="Avaliar"
          onClick={() => ir(`/corridas/${semAvaliar.pedidoId}/avaliar`)}
        />
      )}
      {estado.tipo === 'pronto' && corridas.length === 0 && (
        <p className="apoio">
          Você ainda não pediu nenhum guincho. Quando pedir, o andamento aparece aqui.
        </p>
      )}

      <section aria-label="Como funciona" style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ font: '600 18px var(--fonte-titulo)', margin: '4px 0 10px' }}>
          Como funciona
        </h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          {COMO_FUNCIONA.map(([titulo, texto]) => (
            <li key={titulo} className="cartao" style={{ padding: 14 }}>
              <div style={{ font: '600 16px var(--fonte-titulo)' }}>{titulo}</div>
              <div className="apoio" style={{ fontSize: 14, marginTop: 2 }}>
                {texto}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </TelaComAbas>
  );
}

function CartaoDoInicio({
  rotulo,
  titulo,
  pedido,
  acao,
  destaque,
  onClick,
}: {
  rotulo: string;
  titulo: string;
  pedido: ResumoDoPedido;
  acao: ReactNode;
  destaque?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="cartao"
      onClick={onClick}
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        border: destaque ? '2px solid var(--tinta)' : undefined,
      }}
    >
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Rotulo pequeno>{rotulo}</Rotulo>
        {destaque && <Ponto verde>Ao vivo</Ponto>}
      </span>
      <span style={{ font: '700 20px/1.2 var(--fonte-titulo)' }}>{titulo}</span>
      <span className="apoio" style={{ fontSize: 14 }}>
        {pedido.destinoEndereco ?? 'Destino não informado'}
      </span>
      <span
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          font: '500 14px var(--fonte-texto)',
          color: 'var(--tinta-2)',
        }}
      >
        <span>
          {dataEHora(pedido.criadoEm)}
          {pedido.precoTotal !== null && ` · ${formatarReais(pedido.precoTotal)}`}
        </span>
        <span style={{ font: '600 15px var(--fonte-titulo)', color: 'var(--tinta)' }}>
          {acao} →
        </span>
      </span>
    </button>
  );
}
