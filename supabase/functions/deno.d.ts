// O pouco do runtime do Deno que as Edge Functions usam, para o tsc do `pnpm typecheck`
// (o host não tem Deno). No Supabase, o runtime fornece os tipos de verdade.
declare namespace Deno {
  function serve(tratar: (req: Request) => Response | Promise<Response>): unknown;
  const env: { get(nome: string): string | undefined };
}
