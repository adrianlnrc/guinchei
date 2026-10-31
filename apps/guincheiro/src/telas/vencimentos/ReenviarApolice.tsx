import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErroApi, type MinhaFrota } from '@guinchei/api';
import { Botao, Corpo, Link, Rotulo, Tela } from '@guinchei/ui';
import { useApi } from '../../api';
import { MensagemDeErro } from '../../MensagemDeErro';
import { Campo } from '../cadastro/campos';
import { dataIso, erroDaValidadeDaApolice, formatarData } from '../cadastro/regras';
import { CampoDeArquivo } from '../documentos/comum';
import { ExigeSessaoDeFrota } from '../MinhaFrota';

/** Quem enviou a apólice vencida a reenvia aqui: arquivo novo e a nova validade. */
export function ReenviarApolice() {
  return (
    <ExigeSessaoDeFrota>
      {() => (
        <Tela escura rotulo="Reenviar apólice">
          <Corpo style={{ padding: '28px 24px 32px', gap: 16 }}>
            <Conteudo />
          </Corpo>
        </Tela>
      )}
    </ExigeSessaoDeFrota>
  );
}

function mensagemDoReenvio(e: unknown): string {
  if (e instanceof ErroApi) {
    switch (e.motivo) {
      case 'arquivo_invalido':
      case 'arquivo_grande':
      case 'documento_vencido':
      case 'documento_ausente':
      case 'transicao_invalida':
        return e.message;
      case 'item_indisponivel':
        return 'Não encontramos esta apólice. Volte à sua Frota e tente de novo.';
    }
  }
  return 'Não foi possível enviar a apólice. Use um PDF ou uma foto de até 10 MB e tente de novo.';
}

function Conteudo() {
  const api = useApi();
  const ir = useNavigate();
  const { itemId } = useParams();
  // undefined: lendo; null: não há Frota ou a leitura falhou.
  const [frota, setFrota] = useState<MinhaFrota | null | undefined>(undefined);

  useEffect(() => {
    let vigente = true;
    api.buscarMinhaFrota().then(
      (f) => vigente && setFrota(f),
      () => vigente && setFrota(null),
    );
    return () => {
      vigente = false;
    };
  }, [api]);

  if (frota === undefined) return <p className="apoio">Carregando…</p>;
  const item = frota?.itens.find((i) => i.id === itemId && i.tipo === 'apolice_rc') ?? null;

  return (
    <>
      <div className="marca">guinchei</div>
      <Rotulo style={{ marginTop: 8, color: 'var(--cinza-medio)' }}>Apólice de RC</Rotulo>
      <h1 className="titulo" style={{ font: '700 28px/1.12 var(--fonte-titulo)' }}>
        Enviar a apólice nova
      </h1>
      {!frota ? (
        <>
          <p role="alert" className="apoio">
            Não foi possível ler a sua Frota. Confira a conexão e tente de novo.
          </p>
          <div className="espaco" />
        </>
      ) : item?.estado === 'vencido' ? (
        <Formulario itemId={item.id} validadeAnterior={item.validade} />
      ) : (
        <>
          <p role="status" className="apoio">
            {item?.estado === 'pendente'
              ? 'A operação já está conferindo a sua apólice. Quando ela decidir, o resultado aparece na sua Frota.'
              : item
                ? 'Esta apólice ainda vale. O envio abre aqui quando a validade passar.'
                : 'Não encontramos esta apólice na sua Frota.'}
          </p>
          <div className="espaco" />
        </>
      )}
      <Botao
        variante={item?.estado === 'vencido' ? 'contorno-escuro' : 'claro'}
        grande
        onClick={() => ir('/frota')}
      >
        Voltar à minha Frota
      </Botao>
    </>
  );
}

function Formulario({
  itemId,
  validadeAnterior,
}: {
  itemId: string;
  validadeAnterior: string | null;
}) {
  const api = useApi();
  const ir = useNavigate();
  const [validade, setValidade] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Se o reenvio falhar depois do upload, tentar de novo não envia o mesmo arquivo outra vez.
  const enviado = useRef<{ arquivo: File; caminho: string } | null>(null);

  async function enviar() {
    const recusa = !validade
      ? 'Informe até quando a apólice nova vale.'
      : (erroDaValidadeDaApolice(validade) ?? (arquivo ? null : 'Anexe a apólice nova.'));
    if (recusa || !arquivo) {
      setErro(recusa);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const caminho =
        enviado.current?.arquivo === arquivo
          ? enviado.current.caminho
          : await api.enviarDocumentoDaFrota(arquivo);
      enviado.current = { arquivo, caminho };
      await api.reenviarItemDaFrota(itemId, caminho, validade);
      ir('/frota', { replace: true, state: { apoliceReenviada: true } });
    } catch (e) {
      setErro(mensagemDoReenvio(e));
      setEnviando(false);
    }
  }

  return (
    <>
      <p className="apoio" style={{ fontSize: 15 }}>
        {validadeAnterior
          ? `A apólice anterior venceu em ${formatarData(validadeAnterior)}. `
          : 'A apólice anterior venceu. '}
        Envie a apólice de responsabilidade civil renovada: a operação confere de novo antes de a
        sua Frota voltar a valer.
      </p>
      <Campo
        rotulo="Validade da apólice nova"
        type="date"
        min={dataIso(new Date())}
        value={validade}
        onChange={(e) => {
          setValidade(e.target.value);
          setErro(null);
        }}
      />
      <CampoDeArquivo
        rotulo="Arquivo da apólice nova"
        texto={arquivo ? 'Trocar o arquivo da apólice' : 'Escolher o arquivo da apólice'}
        aceita="application/pdf,image/*"
        arquivo={arquivo}
        desabilitado={enviando}
        aoEscolher={(a) => {
          setArquivo(a);
          setErro(null);
        }}
      />
      <MensagemDeErro>{erro}</MensagemDeErro>
      <div className="espaco" />
      <Botao variante="claro" grande disabled={enviando} onClick={() => void enviar()}>
        Enviar apólice
      </Botao>
      <Link centro onClick={() => ir('/frota')}>
        Voltar à minha Frota
      </Link>
    </>
  );
}
