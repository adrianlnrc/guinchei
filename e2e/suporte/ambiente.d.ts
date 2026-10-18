// Só o que o e2e usa do Node; evita puxar @types/node, que muda os tipos dos apps.
declare const process: { env: Record<string, string | undefined> };
