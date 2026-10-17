import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Error boundary de cada app: um erro inesperado numa tela mostra um aviso com
 * saída em vez de deixar o app em branco.
 */
export class LimiteDeErro extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };

  static getDerivedStateFromError() {
    return { erro: true };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error(erro, info.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <main className="tela" role="alert">
        <div className="tela__corpo" style={{ padding: '48px 24px 32px', gap: 16 }}>
          <h1 className="titulo" style={{ fontSize: 28 }}>
            Algo deu errado nesta tela.
          </h1>
          <p className="apoio">Recomece pela tela inicial para continuar.</p>
          <div className="espaco" />
          <button
            type="button"
            className="botao botao--tinta"
            onClick={() => window.location.assign('/')}
          >
            Voltar ao início
          </button>
        </div>
      </main>
    );
  }
}
