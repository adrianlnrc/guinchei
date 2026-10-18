/** Erro de formulário, anunciado ao leitor de tela. Sem texto, não aparece. */
export function MensagemDeErro({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      style={{ margin: 0, font: '500 15px var(--fonte-texto)', color: 'var(--alerta-texto)' }}
    >
      {children}
    </p>
  );
}
