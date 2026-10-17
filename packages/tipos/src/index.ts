// Os tipos do banco serão gerados do schema do Supabase em F2 (#6).

export const PAPEIS = ['cliente', 'guincheiro', 'operacao'] as const;
export type Papel = (typeof PAPEIS)[number];
