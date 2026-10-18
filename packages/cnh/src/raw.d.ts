// Import de texto do Vite/Vitest (`arquivo?raw`), usado no teste de sincronia com o SQL.
declare module '*?raw' {
  const conteudo: string;
  export default conteudo;
}
